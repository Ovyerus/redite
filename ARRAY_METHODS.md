# Array Helper Methods
Redite supports several array methods which can be run when receiving arrays from the database.
Methods which normally mutate arrays in place (e.g. `push`, `pop`) will edit the array in the 
database without returning that edited copy, however they will return what they normally do.  
Mutating methods can also be run on first level arrays (Redis lists).

Non-mutating methods will not change the value in the database, and will instead get the value,
run the method on the array, and then return the result as usual, with the exception of `forEach`,
which will still be run as normal, but will return the original array instead of nothing.

`length` is a method just for consistency, and is the only non-mutating method which can be run on a first level array.

Two extra mutating methods are added for convenience, `remove` and `removeIndex`.

### `remove`
Removes `amount` of occurences of `value`.  
If `amount` is:
 - `0` - all occurences will be removed.
 - `> 0` - the specified amount of occurances will be removed, starting from the beginning of the array.
 - `< 0` - the specified amount of occurances will be removed, starting from the end of the array.

### `removeIndex`
Removes the value at `index`.

## Mutating methods
 - `push(value1, [value2, [valueN]])`
 - `pop()`
 - `shift()`
 - `unshift(value1, [value2, [valueN]])`
 - `remove(value, [amount])`
 - `removeIndex(index)`

## Non-mutating methods
 - `concat([value1, [value2, [valueN]]])`
 - `find(callback(value, index, array), [thisArg])`
 - `findIndex(callback(value, index, array), [thisArg])`
 - `includes(value, [startIndex])`
 - `indexOf(value, [startIndex])`
 - `lastIndexOf(value, [startIndex])`
 - `map(callback(value, index, array), [thisArg])`
 - `filter(callback(value, index, array), [thisArg])`
 - `join([separator])`
 - `forEach(callback(value, index, array), [thisArg])`
 - `length()`