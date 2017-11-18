const Redite = require('../');
const wrapper = new Redite({dontUnref: true});

wrapper._redis.info(() => {});