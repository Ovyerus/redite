/**
 * @file Custom Redis interface using ES6 Proxies, similar to Rebridge.
 * @author Ovyerus
 */

const redis = require('redis');
require('./entriesPolyfill');

const MUTATING_METHODS = ['push', 'remove', 'removeIndex', 'pop', 'shift', 'unshift'];
const NONMUTATING_METHODS = ['concat', 'find', 'findIndex', 'includes', 'indexOf', 'lastIndexOf', 'map', 'length', 'filter', 'join', 'forEach'];
const SUPPORTED_ARRAY_METHODS = MUTATING_METHODS.concat(NONMUTATING_METHODS);

// FIND A BETTER WAY DUMBASS
function promisify(func, thisArg, ...args) {
    return new Promise((resolve, reject) => { 
        func.apply(thisArg, [...args, (err, res) => {
            /* istanbul ignore next */
            if (err) reject(err);
            else resolve(res);
        }]);
    });
}

// Generates an empty tree from a list of keys.
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

/**
 * Just an intermediate object which stores a key stack.
 */
class ChildWrapper {
    constructor(parentObj, parentKey, stack=[]) {
        return new Proxy(this, {
            get(obj, key) {
                // Returns a Promise which should resolve with the stored value.
                if (['get', '_promise'].includes(key)) {
                    if (!stack.length) return parentObj.resolveStack(parentKey, []);
                    else return parentObj.resolveStack(stack.shift(), stack.concat(parentKey));
                }

                // Allow access to the key stack (primarily exposed for tests).
                if (key === '_stack') return stack.concat(parentKey);

                // Special methods, used in place of actually performing native operations.
                if (key === 'set') return value => parentObj.resolveSetStack(value, stack.concat(parentKey));
                if (key === 'has' || key === 'exists') return key => {
                    stack.push(parentKey);

                    if (key != null) stack.push(key);
                    return parentObj.resolveHasStack(stack.shift(), stack);
                };

                if (key === 'delete') return key => {
                    stack.push(parentKey);

                    if (key != null) stack.push(key);
                    return parentObj.resolveDeleteStack(stack.shift(), stack);
                };

                if (SUPPORTED_ARRAY_METHODS.includes(key)) return parentObj.resolveArrayHelpers(key, stack.concat(parentKey));

                // Continues the stack with another ChildWrapper.
                return new ChildWrapper(parentObj, key, stack.concat(parentKey));
            },

            /*
               Throw errors for other methods, as there are special keys that are used for these instead, since this is entirely async.
               I may find a way to handle these using a synchronous connection to Redis, if the end user so wishes to, but this will
               have to be done using an option so that it does not get accidentally done by someone who doesn't want this to block at all.
            */
            set() {
                throw new Error('Child objects do not support setting (foo.bar = baz).');
            },

            has() {
                throw new Error('Child objects do not support containment checks ("foo" in foo.bar).');
            },

            deleteProperty() {
                throw new Error('Child objects do not support deleting properties (delete foo.bar.baz).');
            }
        });
    }
}

/**
 * An interface for Redis that uses ES6 Proxies to simulate getting as actual objects.
 * The properties defined here are not private, and can be freely accessed by anyone at will.
 * They are only prefixed with an underscore (_) so that they have a less chance of conflicting with keys the end user may wish to set.
 * 
 * @extends Proxy
 * 
 * @prop {redis.RedisClient} _redis The Redis connection that is getting wrapped by the client.
 * @prop {Function} _serialise Serialisation function used to turn objects into strings to store into Redis.
 * @prop {Function} _parse Function used to parse strings returned from Redis, into JS objects.
 * @prop {String} _deletedString String used when deleting values from lists.
 */
class Redite {
    /**
     * Constructs a new Redite instance.
     * By default, JSON functions are used to serialise and parse data, however you can provide your own if you wish.
     * 
     * @param {Object} [options] Options for the interface.
     * @param {redis.RedisClient} [options.client=redis.createClient({url: options.url})] Redis connection to wrap. Will create a new client by default.
     * @param {String} [options.url] Redis URL to connect to. This will be used if a client is not given.
     * @param {Function} [options.serialise=JSON.stringify] Function to serialise data to store into Redis.
     * @param {Function} [options.parse=JSON.parse] Function to parse data returned from Redis, into JS objects.
     * @param {String} [options.deletedString='@__DELETED__@'] String to use when deleting values from lists.
     * @param {Boolean} [options.unref=false] Whether to run `.unref` on the Redis client, which allows Node to exit if the connection is idle.
     */
    constructor(options={}) {
        this._redis = options.client || redis.createClient({url: options.url});
        this._serialise = options.serialise || JSON.stringify;
        this._parse = options.parse || JSON.parse;
        this._deletedString = options.deletedString || '@__DELETED__@';

        // THIS DOES GET TESTED YOU DUMBASS
        /* istanbul ignore next */
        if (options.unref) this._redis.unref(); // Lets Node exit if nothing is happening.

        /*
           According to this Stack Overflow post (https://stackoverflow.com/a/40714458/8778928), this is really the only way to "extend" a proxy,
           as they actually do not have a prototype chain like other objects do. 
        */
        return new Proxy(this, {
            get(obj, key) {
                if (obj[key]) return obj[key];

                // "Special" methods
                if (key === 'set') throw new Error('You cannot use `.set` on the root object.');
                if (key === 'has') return key => promisify(obj._redis.exists, obj._redis, key).then(val => !!val);
                if (key === 'delete') return key => promisify(obj._redis.del, obj._redis, key).then(() => {});

                // Continue the chain with a child object.
                return new ChildWrapper(obj, key);
            },

            /*
               Throw errors for other things users may try on the root object, as they are not supported.
               As with the child objects, I may implement these using a synchronous connection, along with an
               option to be able to use these.
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
     * Resolves a given key, and optional key stack, into a potential item from Redis.
     * 
     * @param {String} key Base key to get from Redis.
     * @param {String[]} [stack] Array of extra keys to apply to the object before it gets returned. Also used when retrieveing hashmap values.
     * @returns {Promise<*>} Returned value from Redis.
     */
    resolveStack(key, stack=[]) {
        return new Promise((resolve, reject) => {
            promisify(this._redis.type, this._redis, key).then(type => {
                if (type === 'hash') {
                    if (Array.isArray(stack) && stack.length) return promisify(this._redis.hget, this._redis, key, stack.shift());
                    else return promisify(this._redis.hgetall, this._redis, key);
                } else if (type === 'list') {
                    if (Array.isArray(stack) && stack.length) return promisify(this._redis.lindex, this._redis, key, stack.shift());
                    else return promisify(this._redis.lrange, this._redis, key, 0, -1);
                } else {
                    return promisify(this._redis.get, this._redis, key);
                }
            }).then(res => {
                if (res != null && typeof res === 'object' && !Array.isArray(res)) {
                    // HGETALL was run
                    res = Object.entries(res).reduce((map, [name, val]) => {
                        map[name] = this._parse(val);
                        return map;
                    }, {});
                } else if (Array.isArray(res)) {
                    // LRANGE was run
                    res = res.map(v => this._parse(v));
                } else {
                    // Single value
                    res = this._parse(res);
                }

                stack.forEach(key => res = res[key]);

                return res;
            }).then(resolve).catch(reject);
        });
    }

    /**
     * Serialises a value for Redis, and determines whether to store it in a special native Redis type, or a regular value.
     * 
     * @param {*} value Value to send to Redis.
     * @param {String[]} stack Stack of keys. Must have at least one.
     * @returns {Promise} .
     */
    resolveSetStack(value, stack=[]) {
        return new Promise((resolve, reject) => {
            if (!stack || !stack.length) return reject(new Error('At least one key is required in the stack'));

            // Handle arrays as native Redis lists.
            // If there's only one key in the stack, replace the entire list in the database with the new one.
            if (Array.isArray(value) && value.length && stack.length === 1) {
                return resolve(promisify(this._redis.del, this._redis, stack[0]).then(() => {
                    // RPUSH is used as it will put the elements in the order that I want.
                    return promisify(this._redis.rpush, this._redis, stack.concat(value.map(v => this._serialise(v))));
                }));
            } else if (Array.isArray(value) && !value.length && stack.length === 1) {
                return resolve();
            }

            // Handle objects as native Redis hashmaps.
            // If only one key is in the stack, replace the entire hashmap with serialised values.
            if (JSON.stringify(value).startsWith('{') && Object.keys(value).length && stack.length === 1) {
                return resolve(promisify(this._redis.del, this._redis, stack[0]).then(() => {
                    let arr = [].concat.apply(stack, Object.entries(value).map(([name, val]) => [name, this._serialise(val)]));

                    return promisify(this._redis.hmset, this._redis, arr);
                }));
            } else if (JSON.stringify(value).startsWith('{') && !Object.keys(value).length) {
                return resolve();
            }

            // Otherwise, handle as a regular redis value.
            promisify(this._redis.type, this._redis, stack[0]).then(type => {
                if (type === 'list') {
                    // If the given base key is a list, handle it properly.
                    if (stack.length === 2) {
                        return Promise.all([promisify(this._redis.lset, this._redis, stack.slice(0, 2).concat(this._serialise(value))), 'finish']);
                    } else {
                        return Promise.all([promisify(this._redis.lindex, this._redis, stack.slice(0, 2)), 'list']);
                    }
                } else if (type === 'hash') {
                    // If the given base key is a hash, handle it properly.
                    if (stack.length === 2) {
                        return Promise.all([promisify(this._redis.hset, this._redis, stack.slice(0, 2).concat(this._serialise(value))), 'finish']);
                    } else {
                        return Promise.all([promisify(this._redis.hget, this._redis, stack.slice(0, 2)), 'hash']);
                    }
                } else if (type === 'none' && stack.length > 1) {
                    // Construct a tree representing the key stack if the user tries to set it when it doesn't exist.
                    return [genTree(stack.slice(1)), 'faked'];
                } else {
                    // Otherwise handle it as a regular value.
                    return Promise.all([promisify(this._redis.set, this._redis, stack[0], this._serialise(value)), 'finish']);
                }
            }).then(res => {
                if (res[1] === 'finish') return;

                let type = res[1];
                res = type !== 'faked' ? this._parse(res[0]) : res[0];
                let ref = res; // Makes a reference to `res`.
                let slice = stack.slice(type === 'faked' ? 1 : 2, -1);

                // Traverse the key stack and continually make `ref` point to nested values.
                for (let i = 0; i < slice.length; i++) {
                    let key = slice[i];
                    let next = slice[i + 1];

                    if (!ref.hasOwnProperty(key)) ref = ref[key] = isNaN(next) ? {} : [];
                    else ref = ref[key];
                }

                ref[stack.slice(-1)[0]] = value; // Set the final nested value.

                if (type === 'list') {
                    return promisify(this._redis.lset, this._redis, stack[0], stack[1], this._serialise(res));
                } else if (type === 'hash') {
                    return promisify(this._redis.hset, this._redis, stack[0], stack[1], this._serialise(res));
                } else if (type === 'faked') {
                    if (Array.isArray(res)) {
                        return promisify(this._redis.rpush, this._redis, [stack[0]].concat(res.map(val => this._serialise(val))));
                    } else {
                        // Did someone say stupidly long one-liners?
                        let arr = [].concat.apply([stack[0]], Object.entries(res).map(([name, val]) => [name, this._serialise(val)]));

                        return promisify(this._redis.hmset, this._redis, arr);
                    }
                }
            }).then(() => resolve()).catch(reject);
            // ^^ Clear out the returned values.
        });
    }

    /**
     * Deletes a given key from Redis, or a property of a stored value.
     * 
     * @param {String} key Base key to delete.
     * @param {String[]} [stack] Key stack to follow and delete instead.
     * @returns {Promise} .
     */
    resolveDeleteStack(key, stack=[]) {
        return new Promise((resolve, reject) => {
            if (!stack || !stack.length) return resolve(promisify(this._redis.del, this._redis, key).then(() => {}));

            promisify(this._redis.type, this._redis, key).then(type => {
                if (type === 'hash' && stack.length === 1) {
                    // Handle hashes
                    return Promise.all([promisify(this._redis.hdel, this._redis, key, stack[0]), 'finish']);
                } else if (type === 'list' && stack.length === 1) {
                    // Handle lists
                    let p = promisify(this._redis.lset, this._redis, key, stack[0], this._deletedString).then(() => {
                        return promisify(this._redis.lrem, this._redis, key, 0, this._deletedString);
                    });

                    return Promise.all([p, 'finish']);
                } else if (type === 'none') {
                    // Doesn't exist
                    return [null, 'finish'];
                } else {
                    // Rest
                    return Promise.all([this.resolveStack(key, [stack[0]]), 'continue']);
                }
            }).then(res => {
                if (res[1] === 'finish') return;

                res = res[0];
                let ref = stack.slice(1, -1).reduce((obj, key) => obj[key], res);

                if (Array.isArray(ref)) ref.splice(stack.slice(-1), 1);
                else delete ref[stack.slice(-1)[0]];

                return this.resolveSetStack(res, [key, stack[0]]);
            }).then(resolve).catch(reject);
        });
    }

    /**
     * Checks if a key, and optional key stack, exists in Redis.
     * 
     * @param {String} key Base key to check.
     * @param {String[]} [stack] Optional stack of keys to follow and check if they exist.
     * @returns {Promise<Boolean>} Whether the key exists or not.
     */
    resolveHasStack(key, stack=[]) {
        return new Promise((resolve, reject) => {
            if (!stack || !stack.length) return resolve(promisify(this._redis.exists, this._redis, key).then(res => !!res));

            promisify(this._redis.type, this._redis, key).then(type => {
                if (type === 'list') {
                    return Promise.all([promisify(this._redis.lindex, this._redis, key, stack.shift()), 'list']);
                } else if (type === 'hash' && stack.length === 1) {
                    return Promise.all([promisify(this._redis.hexists, this._redis, key, stack[0]), 'finish']);
                } else if (type === 'hash') {
                    return Promise.all([promisify(this._redis.hget, this._redis, key, stack.shift()), 'hash']);
                } else {
                    return Promise.all([promisify(this._redis.get, this._redis, key), 'normal']);
                }
            }).then(res => {
                if (res[1] === 'finish') return !!res[0]; // Coerce to boolean since node_redis doesnt.
                if (res[0] == null) return false;

                res = this._parse(res[0]);

                for (let part of stack) {
                    if (!res.hasOwnProperty(part)) return false;
                    else res = res[part];
                }

                return true;
            }).then(resolve).catch(reject);
        });
    }

    resolveArrayHelpers(method, stack=[]) {
        if (!SUPPORTED_ARRAY_METHODS.includes(method)) throw new Error(`Method "${method}" is not supported.`);
        if (!stack || !stack.length) throw new Error('At least one key is required in the stack');

        return function(...args) {
            return new Promise((resolve, reject) => {
                promisify(this._redis.type, this._redis, stack[0]).then(type => {
                    if ((type === 'list' || type === 'none') && stack.length === 1) {
                        let p;
                        // Allow's lists to be mutated fast if just one key is given.
                        switch (method) {
                            case 'push':
                                p = promisify(this._redis.rpush, this._redis, [stack[0]].concat(args.map(val => this._serialise(val))));
                                break;
                            case 'pop':
                                p = promisify(this._redis.rpop, this._redis, stack[0]).then(res => this._parse(res));
                                break;
                            case 'unshift':
                                p = promisify(this._redis.lpush, this._redis, [stack[0]].concat(args.map(val => this._serialise(val))));
                                break;
                            case 'shift':
                                p = promisify(this._redis.lpop, this._redis, stack[0]).then(res => this._parse(res));
                                break;
                            case 'remove':
                                p = promisify(this._redis.lrem, this._redis, stack[0], !isNaN(args[1]) ? Number(args[1]) : 0, this._serialise(args[0]));
                                break;
                            case 'removeIndex':
                                p = promisify(this._redis.lset, this._redis, stack[0], args[0], this._deletedString).then(() => {
                                    return promisify(this._redis.lrem, this._redis, stack[0], 0, this._deletedString);
                                });
                                break;
                            case 'length':
                                p = promisify(this._redis.llen, this._redis, stack[0]);
                                break;
                        }

                        return Promise.all([p, 'finish']);
                    } else {
                        return Promise.all([this.resolveStack(stack[0], stack.slice(1)), 'continue']);
                    }
                }).then(res => {
                    if (res[1] === 'finish') return [res[0]];

                    if (!Array.isArray(res[0])) throw new TypeError(`Unable to apply array method "${method}" to a non-array (${typeof res[0]})`);

                    let val = res[0];
                    let write = true;
                    let ret;

                    // Handles the non-mutating and mutating methods easily, along with special handling for my added ones.
                    // This was much better than a giant switch/case block.
                    if (method === 'length') {
                        ret = val.length;
                        write = false;
                    } else if (NONMUTATING_METHODS.includes(method) && method !== 'forEach') {
                        ret = val[method].apply(val, args);
                        write = false;
                    } else if (method === 'forEach') {
                        val.forEach.apply(val, args);
                        ret = val;
                        write = false;
                    } else if (MUTATING_METHODS.includes(method) && !['remove', 'removeIndex'].includes(method)) {
                        ret = val[method].apply(val, args);
                    } else if (method === 'remove') {
                        if (!args.length) throw new Error('You must provide an item to remove.');
                        if (typeof args[1] !== 'number') args[1] = 0;

                        let i = args[1];

                        if (i > 0) {
                            for (; i > 0; i--) {
                                val.splice(val.indexOf(args[0]), 1);

                                if (val.indexOf(args[0]) === -1) break;
                            }
                        } else if (i < 0) {
                            for (; i < 0; i++) {
                                val.splice(val.lastIndexOf(args[0]), 1);

                                if (val.indexOf(args[0]) === -1) break;
                            }
                        } else while (val.indexOf(args[0]) !== -1) val.splice(val.indexOf(args[0]), 1);
                    } else if (method === 'removeIndex') {
                        if (typeof args[0] !== 'number') throw new Error('You must provide an index to remove.');

                        val.splice(args[0], 1);
                    }

                    return Promise.all([ret, write ? this.resolveSetStack(val, stack) : null]);
                }).then(res => resolve(res[0])).catch(reject);
            });
        }.bind(this);
    }
}

// Export the ChildWrapper class in-case someone wishes to do something with it for whatever reason.
Redite.ChildWrapper = ChildWrapper;
Redite.ARRAY_METHODS = {
    NONMUTATING_METHODS,
    MUTATING_METHODS,
    SUPPORTED_ARRAY_METHODS
};

module.exports = Redite;