const {SupportedArrayMethods} = require('./Constants');

/**
 * Intermediate object used to build up a key stack.
 */
class ChildWrapper {
    /**
     * Makes a new ChildWrapper.
     * 
     * @param {Redite} parentObj Parent Redite instance to use methods from.
     * @param {String} parentKey Current top most key.
     * @param {String[]} [stack=[]] Lower level keys, starting with the root key.
     */
    constructor(parentObj, parentKey, stack=[]) {
        return new Proxy(this, {
            get(obj, key) {
                // Returns a Promise which should resolve with the stored value.
                if (['get', '_promise'].includes(key)) {
                    if (!stack.length) return parentObj.getStack(parentKey, []);
                    else return parentObj.getStack(stack.shift(), stack.concat(parentKey));
                }

                // Allow access to the key stack (primarily exposed for tests).
                if (key === '_stack') return stack.concat(parentKey);

                // Special methods, used in place of actually performing native operations.
                if (key === 'set') return value => parentObj.setStack(value, stack.concat(parentKey));
                if (key === 'has' || key === 'exists') return key => {
                    stack.push(parentKey);

                    if (key != null) stack.push(key);
                    return parentObj.hasStack(stack.shift(), stack);
                };

                if (key === 'delete') return key => {
                    stack.push(parentKey);

                    if (key != null) stack.push(key);
                    return parentObj.deleteStack(stack.shift(), stack);
                };

                if (SupportedArrayMethods.includes(key)) return parentObj.arrayStack(key, stack.concat(parentKey));

                // Continues the stack with another ChildWrapper.
                return new ChildWrapper(parentObj, key, stack.concat(parentKey));
            },

            /*
               Throw errors for other methods, as there are special keys that are used for these instead, since this is entirely async.
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

module.exports = ChildWrapper;