# redite
[![Maintainability](https://api.codeclimate.com/v1/badges/c7a9f823af212f693319/maintainability)](https://codeclimate.com/github/Ovyerus/redite/maintainability)
[![Build Status](https://travis-ci.org/Ovyerus/redite.svg?branch=master)](https://travis-ci.org/Ovyerus/redite)

(Named after the mineral [Reidite](https://en.wikipedia.org/wiki/Reidite))  
Redite is a [Redis](https://redis.io/) wrapper for Node.JS that uses ES6 Proxies, similar to [Rebridge](https://github.com/CapacitorSet/rebridge).  
Note that this library is not yet finished and still a bit buggy, so it is not advised to use this as of right now.

## Differences to Rebridge
 - Uses native Redis data types instead of a single hash (ie. lists for arrays, hashs for objects).
 - No synchronous capabilities.
 - Allows access to internal objects such as the internal Redis connection.
 - Minimal dependencies (only relies on node_redis).

## Installation
```
npm install redite
```

## Usage
```js
const Redite = require('redite');
const db = new Redite(); // If not passed a Redis connection to piggyback off of, it'll make its own.
                             // You can also pass a `url` parameter to the options object to connect using a Redis URL.

db.users[0].set({
    username: 'Ovyerus',
    email: 'Ovyerus@users.noreply.github.com'
}).then(() => db.users.get).then(([me]) => console.log('Me:', me)).catch(err => {
    console.error('An error occurred:', err);
});
```

With a user-made Redis connection.
```js
const redis = require('redis');
const Redite = require('redite');

const client = redis.createClient();
const db = new Redite({client});

client.hset('users', 'ovyerus', 'Ovyerus@users.noreply.github.com', err => {
    if (err) return console.error('An error occurred:', err);

    db.users.ovyerus.get.then(result => {
        console.log('My email:', result);
    }).catch(err => console.error('An error occurred:', err));
});
```

## API
### class Redite (extends `Proxy`)
> An interface for Redis created using ES6 Proxies.  
> The properties defined for this are not private and are only prefixed with an underscore (`_`) so as to not clash with things the user may want to set.


#### **Properties**
| Name       | Type              | Description                                                |
| ---------- | ----------------- | ---------------------------------------------------------- |
| _redis     | redis.RedisClient | The Redis connection that gets piggybacked by the wrapper. |
| _serialise | Function          | Function used to serialise data for Redis.                 |
| _parse     | Function          | Function used to parse data from Redis.                    |


#### **Constructor**  
`new Redite([options])`

| Name              | Type              | Default                                  | Description                                                                                               |
| ----------------- | ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| options.client    | redis.RedisClient | `redis.createClient({url: options.url})` | The Redis connection to piggyback off of.                                                                 |
| options.url       | String            |                                          | The Redis URL to use for the automatically created connection. Not used if a client is passed.            |
| options.serialise | Function          | `JSON.stringify`                         | Function that takes in a JS object and returns a string that can be sent to Redis.                        |
| options.parse     | Function          | `JSON.parse`                             | Function that takes in a string and returns the JS object that it represents.                             |
| options.dontUnref | Boolean           | `false`                                  | If false, `unref()` will be called on the Redis connection, allowing Node to close if nothing is running. |


#### **Accessing Objects**
To get an object using Redite, you just write a tree as if you were accessing a regular object,
however you must end it with `.get` or `._promise` (latter provided for compatibility with Rebridge).  
The tree can be as long as you wish, however it should be an object that exists in Redis.  
Example:
```js
const db = new Redite();

db.foo.bar.fizz.buzz.get.then(result => {
    // ...
}).catch(console.error);
```

This also works for arrays:
```js
const db = new Redite();

db.foo[0].bar[1]._promise.then(result => {
    // ...
}).catch(console.error);
```

#### **Setting Values**
You can set values in the same fashion as getting them, however instead of returning a direct promise,
it returns a function which must be passed the value to set.  
There is no need to worry about creating a tree before hand, as Redite will automatically generate a tree based on the keys given.

*(Side note: any keys which imply an array is being accessed (numbers) will result in an array at that location instead of a regular object. If the number is not zero, there will be that amount of `null`s before it)*

Example:
```js
const db = new Redite();

db.foo.bar.fizz.buzz.set('What a lovely day!').then(() => {
    return Promise.all([db.foo.bar.fizz.buzz.get, db.foo.bar.fizz.get]);
}).then(result => {
    console.log(result); // ["What a lovely day!", {buzz: "What a lovely day!"}];
});
```

```js
const db = new Redite();

db.foo[0].bar[1].set('What a lovely day!').then(() => {
    return Promise.all([db.foo[0].bar[1].get, db.foo[0].bar]);
}).then(result => {
    console.log(result) // ["What a lovely day!", [null, "What a lovely day!"]];
});
```

#### **Other Methods**
The library also has `.has` and `.delete` which work in the same fashion as `.set`, but check for existance or delete the tree, respectively.  
If a key is not given to these methods, they will be applied to the last key before them.

```js
const db = new Redite();

db.foo.bar.fizz.buzz.set('Hello world!').then(() => {
    return db.foo.exists('bar');
}).then(exists => {
    console.log(exists); // true
    return db.foo.bar.delete('fizz');
}).then(() => db.foo.bar.exists()).then(exists => {
    console.log(exists) // false;
}).catch(console.error);
```

`.has` and `.delete` are also the only methods that can be run on the main Redite object.

```js
const db = new Redite();

db.foo.set('Hello world!').then(() => db.exists('foo')).then(exists => {
    console.log(exists); // true
    return db.delete('foo');
}).then(() => db.exists('foo')).then(exists => {
    console.log(exists); // false
}).catch(console.error);
```

## To-Do
 - Fix deep key setting ([#1](https://github.com/Ovyerus/redite/issues/1))
 - Write tests for `.delete` and `.has`.
 - Allow deleting and existance checking without a given key.
 - Add helper methods for arrays that edit in place in the database, or return it edited (filter, push, concat, etc.).