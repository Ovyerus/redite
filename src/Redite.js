const redis = require('redis');
const util = require('util');
const {
    NonMutatingMethods,
    SupportedArrayMethods
} = require('./Constants');
const ChildWrapper = require('./ChildWrapper');

function genTree(stack) {
    let ret = isNaN(stack[0]) ? {} : [];
    let ref = ret;

    for (let i = 0; i < stack.length; i++) {
        let key = stack[i];
        let next = stack[i + 1];

        ref = ref[key] = isNaN(next) ? {} : [];
    }

    return ret;
}

class Redite {
    constructor(options={}) {
        this._redis = options.client || redis.createClient({url: options.url});
        this._serialise = options.serialise || JSON.stringify;
        this._parse = options.parse || JSON.parse;
        this._deletedString = options.deletedString || '@__DELETED__@';
        this._customInspection = options.customInspection || false;
        this._ignoreUndefinedValues = options.ignoreUndefinedValues || false;

        if (options.unref) this._redis.unref(); // Lets Node exit if nothing is happening.
        if (options.customInspection) {
            this[util.inspect.custom] = () => {
                let scope = this;
                
                return new (class Redite {
                    constructor() {
                        this._redis = '<hidden>';
                        this._serialise = scope._serialise;
                        this._parse = scope._parse;
                        this._deletedString = scope._deletedString;
                        this._customInspection = scope._customInspection;
                        this._ignoreUndefinedValues = scope._ignoreUndefinedValues;
                    }
                })();
            };
        }

        // (https://stackoverflow.com/a/40714458/8778928)
        return new Proxy(this, {
            get(obj, key) {
                if (obj.hasOwnProperty(key) || obj[key]) return obj[key];

                // "Special" methods
                if (key === 'set') throw new Error('You cannot use `.set` on the root object.');
                if (key === 'has') return key => obj._redis.pexists(key).then(val => !!val);
                if (key === 'delete') return key => obj._redis.pdel(key).then(() => {});

                // Continue the chain with a child object.
                return new ChildWrapper(obj, key);
            },

            /*
                Throw errors for other things users may try on the root object, as they are not supported.
            */
            set() {
                throw new Error('RedisInterface does not support setting (foo = bar).');
            },

            has() {
                throw new Error('RedisInterface does not support containment checks ("foo" in bar).');
            },

            deleteProperty() {
                throw new Error('RedisInterface does not support deleting properties (delete foo.bar).');
            }
        });
    }

    /**
     * Get an object from Redis.
     * You should probably get an object through a simulated object tree.
     * 
     * @param {String} key Root key to get.
     * @param {String[]} [stack=[]] Extra keys to apply for the final result.
     * @returns {Promise<*>} Redis value.
     */
    async getStack(key, stack=[]) {
        const client = this._redis;
        const type = await client.ptype(key);
        const hasStack = Array.isArray(stack) && stack.length;
        let result;

        if (type === 'none') return;

        if (type === 'hash') {
            result = hasStack
                ? await client.phget(key, stack.shift())
                : await client.phgetall(key);
                
            if (hasStack)
                result = this._parse(result);
            else
                result = Object.entries(result).reduce((map, [key, val]) => {
                    map[key] = this._parse(val);
                    return map;
                }, {});
        } else if (type === 'list') {
            result = hasStack
                ? await client.plindex(key, stack.shift())
                : await client.plrange(key, 0, -1);
            
            if (hasStack)
                result = this._parse(result);
            else
                result = result.map(val => this._parse(val));
        } else {
            result = await client.pget(key);
            result = this._parse(result);
        }

        stack.forEach(key => result = result[key]);

        return result;
    }

    /**
     * Set an object in Redis, with special handling for native types.
     * 
     * @param {*} value Value to set.
     * @param {String[]} [stack=[]] Key stack to set to.
     */
    async setStack(value, stack=[]) {
        if (!stack || !stack.length) throw new Error('At least one key is required in the stack');
        if (value === undefined && this._ignoreUndefinedValues) return;

        const client = this._redis;
        const stackOneKey = stack.length === 1;
        const isObj = typeof value === 'object' && value.constructor === Object;

        if (Array.isArray(value) && value.length && stackOneKey) {
            await client.pdel(stack[0]);
            await client.prpush(stack.concat(value.map(val =>
                this._serialise(val)
            )));

            return;
        } else if (Array.isArray(value) && stackOneKey) return;


        if (isObj && Object.keys(value).length && stackOneKey) {
            // Merges the key stack (which is only 1 key long), with the user's value, mapped to the form of [key, serialisedValue]
            // This is done in order to meet HMSET's arguments of "key, hashKey1, hashValue1, hashKeyN, hashValueN".
            const hm = [].concat.apply(stack, Object.entries(value).map(([key, val]) =>
                [key, this._serialise(val)]
            ));

            await client.pdel(stack[0]);
            await client.phmset(hm);

            return;
        } else if (isObj && !Object.keys(value).length && stackOneKey) {
            // Redis doesn't support having empty values, which includes lists and hashmaps, and since hashmaps aren't order dependent, we can simulate an empty hash with a placeholder key.
            await this.setStack({
                __setting_empty_hash__: '__setting_empty_hash__'
            }, stack);
            return;
        }

        const type = await client.ptype(stack[0]);
        const stackTwoKeys = stack.length === 2;
        let result;

        if (type === 'list') {
            if (stackTwoKeys) {
                await client.plset(stack.concat(this._serialise(value)));
                return;
            }

            result = await client.plindex(stack.slice(0, 2));
        } else if (type === 'hash') {
            if (stackTwoKeys) {
                await client.phset(stack.concat(this._serialise(value)));
                return;
            }

            result = await client.phget(stack.slice(0, 2));
        } else if (type === 'none' && stack.length > 1)
            result = genTree(stack.slice(1));
        else {
            await client.pset(stack[0], this._serialise(value));
            return;
        }

        if (type !== 'none') result = this._parse(result);

        let ref = result;
        const keys = stack.slice(type === 'none' ? 1 : 2, -1);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const next = keys[i + 1];

            if (!ref.hasOwnProperty(key))
                ref = ref[key] = isNaN(next) ? {} : [];
            else ref = ref[key];
        }

        ref[stack.slice(-1)[0]] = value;

        if (type === 'list')
            await client.plset(stack[0], stack[1], this._serialise(result));
        else if (type === 'hash')
            await client.phset(stack[0], stack[1], this._serialise(result));
        else {
            if (Array.isArray(result))
                await client.prpush([stack[0]].concat(result.map(val =>
                    this._serialise(val)
                )));
            else {
                const hm = [].concat.apply([stack[0]], Object.entries(result).map(([key, val]) => 
                    [key, this._serialise(val)]
                ));

                await client.phmset(hm);
            }
        }
    }

    /**
     * Delete's a given tree from Redis.
     * Only deletes whatever happens to be the top level key.
     * 
     * @param {String} key Root key to delete from.
     * @param {String[]} [stack=[]] Key stack to follow and eventually delete. If left blank, the root key will be deleted.
     */
    async deleteStack(key, stack=[]) {
        if (!stack || !stack.length) {
            await this._redis.pdel(key);
            return;
        }

        const client = this._redis;
        const stackOneKey = stack.length === 1;
        const type = await client.ptype(key);

        if (type === 'hash' && stackOneKey) {
            await client.phdel(key, stack[0]);
            return;
        } else if (type === 'list' && stackOneKey) {
            await client.plset(key, stack[0], this._deletedString);
            await client.plrem(key, 0, this._deletedString);

            return;
        } else if (type === 'none') return;

        const result = await this.getStack(key, [stack[0]]);
        const ref = stack.slice(1, -1).reduce((obj, key) => obj[key], result);

        if (Array.isArray(ref)) ref.splice(stack.slice(-1), 1);
        else delete ref[stack.slice(-1)[0]];

        await this.setStack(result, [key, stack[0]]);
    }

    /**
     * Determines whether a tree exists in Redis.
     * 
     * @param {String} key Root key to check existance for.
     * @param {String[]} [stack=[]] Key stack to follow and check existance for.
     * @returns {Promise<Boolean>} Whether the key exists.
     */
    async hasStack(key, stack=[]) {
        if (!stack || !stack.length) return !!(await this._redis.pexists(key));

        const client = this._redis;
        const type = await client.ptype(key);
        let result;

        if (type === 'list')
            result = await client.plindex(key, stack.shift());
        else if (type === 'hash' && stack.length === 1)
            return !!(await client.phexists(key, stack[0]));
        else if (type === 'hash')
            result = await client.phget(key, stack.shift());
        else if (type === 'none')
            return false;
        else
            result = await client.pget(key);

        if (!result) return false;

        result = this._parse(result);

        for (const key of stack)
            if (!result.hasOwnProperty(key)) return false;
            else result = result[key];

        return true;
    }

    /**
     * @function ArrayMethodHandler
     * A function that handles array methods for Redis values.
     * @see {@link /ARRAY_METHODS.md}
     * 
     * @param {...*[]} [args] Arguments to pass to the method.
     * @returns {Promise<*>} Result from the method.
     */

    /**
     * Handles resolution of the various supported array methods.
     * 
     * @param {String} method Array method to run.
     * @param {String[]} stack Key stack to run the method on.
     * @returns {ArrayMethodHandler} Function emulating the specified method.
     */
    arrayStack(method, stack) {
        if (!SupportedArrayMethods.includes(method)) throw new Error(`Method "${method}" is not supported`);
        if (!stack || !stack.length) throw new Error('At least one key is required in the stack');

        const client = this._redis;

        return async function(...args) {
            const type = await client.ptype(stack[0]);

            //
            if ((type === 'list' || type === 'none') && stack.length === 1) {
                const serialisedArgs = args.map(val => this._serialise(val));
                let p;

                switch (method) {
                    case 'push':
                        p = client.prpush(stack.concat(serialisedArgs));
                        break;
                    case 'pop':
                        p = client.prpop(stack[0]).then(res => this._parse(res));
                        break;
                    case 'unshift':
                        p = client.plpush(stack.concat(serialisedArgs));
                        break;
                    case 'shift':
                        p = client.plpop(stack[0]).then(res => this._parse(res));
                        break;
                    case 'remove':
                        p = client.plrem(stack[0], !isNaN(args[1]) ? Number(args[1]) : 0, serialisedArgs[0]);
                        break;
                    case 'removeIndex':
                        p = client.plset(stack[0], args[0], this._deletedString).then(() => 
                            client.plrem(stack[0], 0, this._deletedString)
                        );
                        break;
                    case 'length':
                        p = client.pllen(stack[0]);
                        break;
                    default:
                        throw new Error(`Unable to apply method "${method}" on a first level value.`);
                }

                return p;
            }

            const result = await this.getStack(stack[0], stack.slice(1));

            if (!Array.isArray(result)) throw new TypeError(`Unable to apply method "${method}" to a non-array (${typeof result[0]})`);

            let write = true;
            let ret;

            if (method === 'length') {
                ret = result.length;
                write = false;
            } else if (method === 'remove') {
                if (!args.length) throw new Error('You must provide an item to remove');
                if (typeof args[1] !== 'number') args[1] = 0;

                let i = args[1];

                if (i > 0) {
                    for (; i > 0; i--) {
                        result.splice(result.indexOf(args[0]), 1);

                        if (result.indexOf(args[0]) === -1) break;
                    }
                } else if (i < 0) {
                    for (; i < 0; i++) {
                        result.splice(result.lastIndexOf(args[0]), 1);

                        if (result.indexOf(args[0]) === -1) break;
                    }
                } else while (result.indexOf(args[0]) !== -1) result.splice(result.indexOf(args[0]), 1);
            } else if (method === 'removeIndex') {
                if (typeof args[0] !== 'number') throw new Error('You must provide an index to remove.');

                result.splice(args[0], 1);
            } else {
                ret = result[method].apply(result, args);

                if (NonMutatingMethods.includes(method)) write = false;
            }

            if (write) await this.setStack(result, stack);

            return ret;
        }.bind(this);
    }
}

module.exports = Redite;