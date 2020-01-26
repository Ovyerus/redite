const Redite = require('../../');

const wrapper = new Redite({ unref: true });

wrapper._redis.info(() => {});
