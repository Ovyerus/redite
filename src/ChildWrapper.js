const { SupportedArrayMethods } = require('./Constants');

/*
 * Since this type of thing is used in two places, its simpler to put it in a function so we don't have to
 * edit two places at once.
 */
function getFromStack(parentObj, parentKey, stack) {
  if (!stack.length) return parentObj.getStack(parentKey, []);
  else return parentObj.getStack(stack.shift(), stack.concat(parentKey));
}

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
  constructor(parentObj, parentKey, stack = []) {
    return new Proxy(this, {
      get(obj, key) {
        // Allow access to the key stack (primarily exposed for tests).
        if (key === '_stack') return stack.concat(parentKey);

        // Special methods, used in place of actually performing native operations.
        if (key === 'set')
          return value => parentObj.setStack(value, stack.concat(parentKey));
        if (key === 'has' || key === 'exists')
          return key => {
            stack.push(parentKey);

            if (key != null) stack.push(key);
            return parentObj.hasStack(stack.shift(), stack);
          };

        if (key === 'delete')
          return key => {
            stack.push(parentKey);

            if (key != null) stack.push(key);
            return parentObj.deleteStack(stack.shift(), stack);
          };

        if (SupportedArrayMethods.includes(key))
          return parentObj.arrayStack(key, stack.concat(parentKey));

        if (['then', 'catch', 'finally'].includes(key))
          // Allows object trees to simply be awaited when wishing to retrieve objects from Redis, without any funky syntax.
          // This may seem like magic (the bad kind), but that's the entire point of this library.
          return (...args) =>
            getFromStack(parentObj, parentKey, stack)[key](...args);
        else return new ChildWrapper(parentObj, key, stack.concat(parentKey));
      },

      /*
               Throw errors for other methods, as there are special keys that are used for these instead, since this is entirely async.
            */
      set() {
        throw new Error('ChildWrapper does not support setting (foo = bar)');
      },

      has() {
        throw new Error(
          'ChildWrapper does not support containment checks ("foo" in bar)'
        );
      },

      deleteProperty() {
        throw new Error(
          'ChildWrapper does not support deletion (delete foo.bar)'
        );
      }
    });
  }
}

module.exports = ChildWrapper;
