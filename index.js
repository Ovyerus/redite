const redis = require('redis');
const Constants = require('./src/Constants');
const Redite = require('./src/Redite');
const ChildWrapper = require('./src/ChildWrapper');

Object.entries(redis.RedisClient.prototype).filter(v => typeof v[1] === 'function').forEach(([key, func]) => {
    if (redis.RedisClient.prototype['p' + key]) return;

    redis.RedisClient.prototype['p' + key] = function(...args) {
        return new Promise((resolve, reject) => {
            func.call(this, ...args, (err, res) => {
                /* istanbul ignore next */
                if (err) reject(err);
                else resolve(res);
            });
        });
    };
});

function r(options) {
    return new Redite(options);
}

r.Redite = Redite;
r.ChildWrapper = ChildWrapper;
r.Constants = Constants;

module.exports = r;
