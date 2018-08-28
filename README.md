# redite
[![Maintainability](https://api.codeclimate.com/v1/badges/c7a9f823af212f693319/maintainability)](https://codeclimate.com/github/Ovyerus/redite/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/c7a9f823af212f693319/test_coverage)](https://codeclimate.com/github/Ovyerus/redite/test_coverage)
[![Build Status](https://travis-ci.org/Ovyerus/redite.svg?branch=master)](https://travis-ci.org/Ovyerus/redite)  
[![NPM Version](https://img.shields.io/npm/v/redite.svg)](https://npmjs.com/package/redite)
![Node Version](https://img.shields.io/node/v/redite.svg)
 
Redite is a [Redis](https://redis.io/) wrapper for Node.JS using ES6 Proxies, similar to [Rebridge](https://github.com/CapacitorSet/rebridge).

## Differences to Rebridge
 - Uses native Redis data types instead of a single hash (ie. lists for arrays, hashs for objects).
 - No "synchronous" capabilities.
 - Allows access to internal objects such as the internal Redis connection.
 - Minimal dependencies (only relies on node_redis).
 - Automatically creates an object tree when setting.
 - Array methods which can mutate objects in-database.

## Installation
```
npm install redite
```

## Usage
```js
const Redite = require('redite');
const db = new Redite(); // If not passed a Redis connection to piggyback off of, it'll make its own.
                         // You can also pass a `url` parameter to the options object to connect using a Redis URL.

await db.users.ovyerus.set({id: '1', email: 'Ovyerus@users.noreply.github.com'});
const me = await db.users.ovyerus();

console.log(me.id); // 1
console.log(me.email); // Ovyerus@users.noreply.github.com
```

With a user-made Redis connection.
```js
const redis = require('redis');
const Redite = require('redite');

const client = redis.createClient();
const db = new Redite({client});

client.hset('users', 'ovyerus', JSON.stringify({
    id: '1',
    email: 'Ovyerus@users.noreply.github.com'
}), async err => {
    if (err) throw err;

    const me = await db.users.ovyerus();

    console.log(me.id); // 1
    console.log(me.email); // Ovyerus@users.noreply.github.com
});
```

## API
### class Redite (extends `Proxy`)
> An interface for Redis created using ES6 Proxies.  
> The properties defined for this are not private and are only prefixed with an underscore (`_`) so as to not clash with things the user may want to set.


#### **Properties**
| Name | Type | Description |
| --- | --- | --- |
| _redis | redis.RedisClient | The Redis connection that gets piggybacked by the wrapper. |
| _serialise | Function | Function used to serialise data for Redis. |
| _parse | Function | Function used to parse data from Redis. |
| _deleteString | String | String used as a temporary placeholder when deleting list values. |


#### **Constructor**  
`new Redite([options])`

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| options.client | redis.RedisClient | `redis.createClient({url: options.url})` | The Redis connection to piggyback off of. |
| options.url | String | | The Redis URL to use for the automatically created connection. Not used if a client is passed. |
| options.serialise | Function | `JSON.stringify` | Function that takes in a JS object and returns a string that can be sent to Redis. |
| options.parse | Function | `JSON.parse` | Function that takes in a string and returns the JS object that it represents. |
| options.deleteString | String | `@__DELETED__@` | String to use as a temporary placeholder when deleting root indexes in a list. |
| options.unref | Boolean | `true` | Whether to run `.unref` on the Redis client, which allows Node to exit if the connection is idle. |
| options.customInspection | Boolean | `false` | Whether to use a custom inspection for the Redis URL and Redis connection to hide potentially sensitive data. |
| options.ignoreUndefinedValues | Boolean | `false` | Whether to ignore `undefined` as a base value when setting values. |
#### **Accessing Objects**
To get an object using Redite, you just write a tree as if you were accessing a regular object,
however you must end it as if you were calling a function, that is `db.foo()`.
The tree can be as long as you wish, however it should be an object that exists in Redis.  
Example:
```js
const db = new Redite();

const result = await db.foo.bar.fizz.buzz();
```

This also works for arrays:
```js
const db = new Redite();

const result = await db.foo[0].bar[1]();
```

#### **Setting Values**
You can set values in the same fashion as getting them, however instead of returning a direct promise,
it returns a function which must be passed the value to set.  
There is no need to worry about creating a tree before hand, as Redite will automatically generate a tree based on the keys given.

*(Side note: any keys which imply an array is being accessed (numbers) will result in an array at that location instead of a regular object. If the number is not zero, there will be that amount of `null`s before it)*

Example:
```js
const db = new Redite();

await db.foo.bar.fizz.buzz.set('What a lovely day!');
const result = await Promise.all([db.foo.bar.fizz.buzz(), db.foo.bar.fizz()]);

console.log(result); // ["What a lovely day!", {buzz: "What a lovely day!"}];
```

```js
const db = new Redite();

await db.foo[0].bar[1].set('What a lovely day!');
const result = await Promise.all([[db.foo[0].bar[1](), db.foo[0].bar()]);

console.log(result) // ["What a lovely day!", [null, "What a lovely day!"]];
```

#### **Other Methods**
The library also has `.has` and `.delete` which work in the same fashion as `.set`, but check for existance or delete the tree, respectively.  
If a key is not given to these methods, they will be applied to the last key before them.  
There is also `.exists` which is an alias for `.has`, which makes more sense when not passing a key to it.

```js
const db = new Redite();

await db.foo.bar.fizz.buzz.set('Hello world!');
const firstExists = await db.foo.has('bar');
console.log(firstExists); // true

await db.foo.bar.delete('fizz');
const secondExists = await db.foo.bar.exists();
console.log(secondExists); // false
```

`.has` and `.delete` are also the only methods that can be run on the main Redite object.

```js
const db = new Redite();

await db.foo.set('Hello world!')l
const firstExists = db.has('foo');
console.log(firstExists); // true

await db.delete('foo');
const secondExists = await db.has('foo');
console.log(secondExists); // falses
```

#### **Working with Arrays**
Redite has support for several methods that help when working with arrays.  
Documentation for these is available [here](./ARRAY_METHODS.md).

## Licence
The code contained within this repository is licenced under the MIT License. See [LICENSE](/LICENSE) for more information.
