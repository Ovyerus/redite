const {RedisClient} = require('redis');

Object.entries(RedisClient.prototype).filter(v => typeof v[1] === 'function').forEach(([key, func]) => {
    if (RedisClient.prototype['p' + key]) return;

    RedisClient.prototype['p' + key] = function(...args) {
        return new Promise((resolve, reject) => {
            func.call(this, ...args, (err, res) => {
                /* istanbul ignore next */
                if (err) reject(err);
                else resolve(res);
            });
        });
    };
});