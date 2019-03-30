const {RedisClient} = require('redis');

function promisifyRedisClient(proto) {
    Object.entries(proto).filter(v => typeof v[1] === 'function').forEach(([key, func]) => {
        if (proto['p' + key]) return;

        proto['p' + key] = function(...args) {
            return new Promise((resolve, reject) => {
                func.call(this, ...args, (err, res) => {
                    /* istanbul ignore next */
                    if (err) reject(err);
                    else resolve(res);
                });
            });
        };
    });
}

promisifyRedisClient(RedisClient.prototype);

module.exports = promisifyRedisClient;
