/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */

const DB = 15;
const TEST_HASH = {TEST_HASH: 'TEST HASH'};
const TEST_LIST = ['TEST LIST'];

const chai = require('chai');
const {expect} = chai;

const Redite = require('../');
const redis = require('redis');
const client = redis.createClient({db: DB});
const wrapper = new Redite({client});

function promisify(func, thisArg, ...args) {
    return new Promise((resolve, reject) => { 
        func.apply(thisArg, [...args, (err, ...res) => {
            if (err) reject(err);
            else if (res.length <= 1) resolve(res[0]);
            else resolve(res);
        }]);
    });
}

// Clear out the database before and after use, to make sure that all data is just our own.
beforeEach(function(done) {
    client.flushdb(err => err ? done(err) : done());
});

after(function(done) {
    client.flushdb(err => err ? done(err) : done());
});

describe('Redite', function() {
    describe('get', function() {
        it('should enable access to object properties', function() {
            expect(wrapper._redis).to.be.instanceof(redis.RedisClient);
            expect(wrapper._serialise).to.be.a('function');
            expect(wrapper._parse).to.be.a('function');
        });

        it('should throw an error for `.set`', function() {
            try {
                wrapper.set;
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('You cannot use `.set` on the root object.');
            }
        });

        describe('.has', function() {
            it('should return a function', function() {
                expect(wrapper.has).to.be.a('function');
            });

            it('should check if a key exists', function() {
                return wrapper.has('test').then(exists => {
                    expect(exists).to.equal(false);
                    return promisify(client.set, client, 'test', 'existance test');
                }).then(() => wrapper.has('test')).then(exists => {
                    expect(exists).to.equal(true);
                });
            });
        });

        describe('.delete', function() {
            it('should return a function', function() {
                expect(wrapper.delete).to.be.a('function');
            });

            it('should delete a key', function() {
                return promisify(client.set, client, 'test', 'deletion test').then(() => {
                    return wrapper.delete('test');
                }).then(() => wrapper.has('test')).then(exists => {
                    expect(exists).to.equal(false);
                });
            });
        });

        describe('.anythingElse', function() {
            it('should return a ChildWrapper', function() {
                expect(wrapper.foo).to.be.instanceof(Redite.ChildWrapper);
            });
        });
    });

    describe('set', function() {
        it('should throw an error', function() {
            try {
                wrapper.foo = 'Some text';
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('RedisInterface does not support setting (foo = bar).');
            }
        });
    });

    describe('in', function() {
        it('should throw an error', function() {
            try {
                'foo' in wrapper;
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('RedisInterface does not support containment checks ("foo" in bar).');
            }
        });
    });

    describe('delete', function() {
        it('should throw an error', function() {
            try {
                delete wrapper.foo;
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('RedisInterface does not support deleting properties (delete foo.bar).');
            }
        });
    });
});

describe('ChildWrapper', function() {
    describe('get', function() {
        it('should return another ChildWrapper with an extended stack', function() {
            let a = wrapper.foo.bar;

            expect(a).to.be.instanceof(Redite.ChildWrapper);
            expect(a._stack).to.deep.equal(['foo', 'bar']);
        });

        it('should continually give ChildWrappers no matter how deep the stack is goes', function() {
            let a = wrapper.foo.bar.faz.foobar.fizz.buzz.fizzbuzz[100];

            expect(a).to.be.instanceof(Redite.ChildWrapper);
            expect(a._stack).to.deep.equal(['foo', 'bar', 'faz', 'foobar', 'fizz', 'buzz', 'fizzbuzz', '100']);
        });

        describe('.get/._promise', function() {
            it('should return a promise', function() {
                expect(wrapper.foo.get).to.be.instanceof(Promise);
            });

            describe('Regular values', function() { 
                it('should get the value specified', function() {
                    return promisify(client.set, client, 'test', '"ChildWrapper get test"').then(() => {
                        return wrapper.test.get;
                    }).then(res => {
                        expect(res).to.equal('ChildWrapper get test');
                    });
                });
            });

            describe('Hashmaps', function() {
                it('should get the value from within the hashmap', function() {
                    return promisify(client.hset, client, 'test', 'foo', '"ChildWrapper get hash test"').then(() => {
                        return wrapper.test.foo.get;
                    }).then(res => {
                        expect(res).to.equal('ChildWrapper get hash test');
                    });
                });

                it('should get the deeply nested value', function() {
                    return promisify(client.hset, client, 'test', 'foo', JSON.stringify(TEST_HASH)).then(() => {
                        return wrapper.test.foo.TEST_HASH.get;
                    }).then(res => {
                        expect(res).to.equal('TEST HASH');
                    });
                });

                it('should get the really deeply nested value', function() {
                    return promisify(client.hset, client, 'test', 'foo', JSON.stringify({bar: {baz: {foobar: TEST_HASH}}})).then(() => {
                        return wrapper.test.foo.bar.baz.foobar.TEST_HASH.get;
                    }).then(res => {
                        expect(res).to.equal('TEST HASH');
                    });
                });

                it('should get all the values of the hash', function() {
                    return promisify(client.hset, client, 'test', 'foo', '"ChildWrapper get hash test 1"').then(() => {
                        return promisify(client.hset, client, 'test', 'bar', '"ChildWrapper get hash test 2"');
                    }).then(() => {
                        return wrapper.test.get;
                    }).then(res => {
                        expect(res).to.deep.equal({
                            foo: 'ChildWrapper get hash test 1',
                            bar: 'ChildWrapper get hash test 2'
                        });
                    });
                });
            });

            describe('Lists', function() {
                it('should get the value from within the list', function() {
                    return promisify(client.rpush, client, 'test', '"ChildWrapper get list test"').then(() => {
                        return wrapper.test[0].get;
                    }).then(res => {
                        expect(res).to.equal('ChildWrapper get list test');
                    });
                });

                it('should get the deeply nested value', function() {
                    return promisify(client.rpush, client, 'test', JSON.stringify(TEST_HASH)).then(() => {
                        return wrapper.test[0].TEST_HASH.get;
                    }).then(res => {
                        expect(res).to.equal('TEST HASH');
                    });
                });

                it('should get the really deeply nested value', function() {
                    return promisify(client.rpush, client, 'test', JSON.stringify({foo: {bar: {baz: {foobar: TEST_HASH}}}})).then(() => {
                        return wrapper.test[0].foo.bar.baz.foobar.TEST_HASH.get;
                    }).then(res => {
                        expect(res).to.equal('TEST HASH');
                    });
                });

                it('should get all the values of the list', function() {
                    return promisify(client.rpush, client, 'test', '"ChildWrapper get list test 1"', '"ChildWrapper get list test 2"').then(() => {
                        return wrapper.test.get;
                    }).then(res => {
                        expect(res).to.deep.equal([
                            'ChildWrapper get list test 1',
                            'ChildWrapper get list test 2'
                        ]);
                    });
                });
            });
        });

        describe('.set', function() {
            it('should return a function', function() {
                expect(wrapper.foo.set).to.be.a('function');
            });

            it('should set the value of the given key', function() {
                return wrapper.test.set('ChildWrapper set test').then(() => {
                    return wrapper.test.get;
                }).then(res => {
                    expect(res).to.equal('ChildWrapper set test');
                });
            });

            it('should set a hashmap', function() {
                return wrapper.test.set(TEST_HASH).then(() => {
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('hash');
                    return wrapper.test.TEST_HASH.get;
                }).then(res => {
                    expect(res).to.equal('TEST HASH');
                });
            });

            it('should set a list', function() {
                return wrapper.test.set(TEST_LIST).then(() => {
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('list');
                    return wrapper.test[0].get;
                }).then(res => {
                    expect(res).to.equal('TEST LIST');
                });
            });

            it('should set a deeply nested object, with the first as a hash', function() {
                return wrapper.test.foo.bar.foobar.set(TEST_LIST).then(() => {
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('hash');
                    return wrapper.test.foo.bar.foobar[0].get;
                }).then(res => {
                    expect(res).to.equal('TEST LIST');
                });
            });

            it('should set a deeply nested array, with the first as a list', function() {
                return wrapper.test[0][0][0][0].set(TEST_LIST).then(() => {
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('list');
                    return wrapper.test[0][0][0][0][0].get;
                }).then(res => {
                    expect(res).to.equal('TEST LIST');
                });
            });
        });

        describe('.has', function() {
            it('should return a function', function() {
                expect(wrapper.foo.has).to.be.a('function');
            });

            it('should check if the surface key exists in a hash');
            it('should check if the surface key exists in a list');
            it('should check if a deeply nested key exists in a hash');
            it('should check if a deeply nested key exists in a list');
        });

        describe('.delete', function() {
            it('should return a function', function() {
                expect(wrapper.foo.delete).to.be.a('function');
            });

            it('should delete a surface key in a hash');
            it('should delete a surface key in a list');
            it('should delete a deeply nested key in a hash');
            it('should delete a deeply nested key in a list');
        });
    });

    describe('set', function() {
        it('should throw an error', function() {
            try {
                wrapper.foo.bar = 'Some text'; 
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Child objects do not support setting (foo.bar = baz).');
            }
        });
    });

    describe('in', function() {
        it('should throw an error', function() {
            try {
                'bar' in wrapper.foo;
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Child objects do not support containment checks ("foo" in foo.bar).');
            }
        });
    });

    describe('delete', function() {
        it('should throw an error', function() {
            try {
                delete wrapper.foo.bar;
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Child objects do not support deleting properties (delete foo.bar.baz).');
            }
        });
    });
});