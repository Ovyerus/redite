/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */

const DB = 15; // Moves all the testing out of a possibly used DB index, as we call FLUSHDB before each test.
const TEST_VAL = 'TEST';
const TEST_HASH = {TEST_HASH: TEST_VAL};
const TEST_LIST = [TEST_VAL];
const TESTS = [
    [TEST_VAL, 'value'],
    [TEST_HASH, 'object'],
    [TEST_LIST, 'array']
];
const FINDER = [TEST_VAL, TEST_VAL, 'find me', TEST_VAL, TEST_VAL];
const FINDER_ALT = [TEST_VAL, TEST_VAL, 'dont find me', TEST_VAL, TEST_VAL];
const FINDER_2 = [TEST_VAL, TEST_VAL, 'find me', TEST_VAL, 'find me', TEST_VAL, TEST_VAL];

const chai = require('chai');
const {expect} = chai;

const Redite = require('../');
const redis = require('redis');
const client = redis.createClient({db: DB});
const wrapper = new Redite({client});

function promisify(func, thisArg, ...args) {
    return new Promise((resolve, reject) => { 
        func.apply(thisArg, [...args, (err, res) => {
            if (err) reject(err);
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

describe('Array helper methods', function() {
    describe('Mutating methods with one key', function() {
        describe('.push', function() {
            TESTS.forEach(([val, name]) => {
                it(`should push the ${name} to the list`, function() {
                    return wrapper.test.push(val).then(() => {
                        return wrapper.test.get;
                    }).then(res => {
                        expect(res).to.deep.equal([val]);
                    });
                });
            });

            it('should keep appending elements to the list', function() {
                return wrapper.test.push(TEST_VAL).then(() => {
                    return wrapper.test.push(TEST_HASH);
                }).then(() => {
                    return wrapper.test.push(TEST_LIST);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal([
                        TEST_VAL,
                        TEST_HASH,
                        TEST_LIST
                    ]);
                });
            });
        });

        describe('.pop', function() {
            it('should remove and return the value from the list', function() {
                return wrapper.test.set(TEST_LIST).then(() => {
                    return wrapper.test.pop();
                }).then(res => {
                    expect(res).to.equal(TEST_VAL);
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('none');
                });
            });

            it('should only pop the last item from the list', function() {
                return wrapper.test.set(['TEST ONE', 'TEST TWO']).then(() => {
                    return wrapper.test.pop();
                }).then(res => {
                    expect(res).to.equal('TEST TWO');
                    return wrapper.test.get;
                }).then(res => {
                    expect(res).to.deep.equal(['TEST ONE']);
                });
            });
        });

        describe('.unshift', function() {
            TESTS.forEach(([val, name]) => {
                it(`should add the ${name} to the list`, function() {
                    return wrapper.test.unshift(val).then(() => {
                        return wrapper.test.get;
                    }).then(res => {
                        expect(res).to.deep.equal([val]);
                    });
                });
            });

            it('should keep adding elements to the start of the list', function() {
                return wrapper.test.unshift(TEST_VAL).then(() => {
                    return wrapper.test.unshift(TEST_HASH);
                }).then(() => {
                    return wrapper.test.unshift(TEST_LIST);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal([
                        TEST_LIST,
                        TEST_HASH,
                        TEST_VAL
                    ]);
                });
            });
        });

        describe('.shift', function() {
            it('should remove and return the value from the list', function() {
                return wrapper.test.set(TEST_LIST).then(() => {
                    return wrapper.test.shift();
                }).then(res => {
                    expect(res).to.equal(TEST_VAL);
                    return promisify(client.type, client, 'test');
                }).then(type => {
                    expect(type).to.equal('none');
                });
            });

            it('should only shift the first item from the list', function() {
                return wrapper.test.set(['TEST ONE', 'TEST TWO']).then(() => {
                    return wrapper.test.shift();
                }).then(res => {
                    expect(res).to.equal('TEST ONE');
                    return wrapper.test.get;
                }).then(res => {
                    expect(res).to.deep.equal(['TEST TWO']);
                });
            });
        });

        describe('.remove', function() {
            it('should remove all items with the same value', function() {
                return wrapper.test.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                    return wrapper.test.remove(TEST_VAL);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                });
            });

            it('should ignore the invalid amount, and remove all items with the same value', function() {
                return wrapper.test.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                    return wrapper.test.remove(TEST_VAL, '50');
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                });
            });

            it('should remove the first 2 items with the same value', function() {
                return wrapper.test.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                    return wrapper.test.remove(TEST_VAL, 2);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', TEST_VAL, 'SAFE']);
                });
            });

            it('should remove the last 2 items with the same value', function() {
                return wrapper.test.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                    return wrapper.test.remove(TEST_VAL, -2);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal(['SAFE', TEST_VAL, 'SAFE', 'SAFE', 'SAFE']);
                });
            });
        });

        describe('.removeIndex', function() {
            it('should only remove the value at the given index', function() {
                return wrapper.test.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                    return wrapper.test.removeIndex(2);
                }).then(() => wrapper.test.get).then(res => {
                    expect(res).to.deep.equal(['SAFE', TEST_VAL, TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']);
                });
            });
        });

        describe('.length', function() {
            [0, 1, 2, 3, 4, 5].forEach(val => {
                it(`should have a length of ${val}`, function() {
                    let sender = new Array(val).fill(TEST_VAL);

                    return wrapper.test.set(sender).then(() => {
                        return wrapper.test.length();
                    }).then(len => {
                        expect(len).to.equal(val);
                    });
                });
            });
        });
    });

    describe('Methods on nested keys', function() {
        describe('Attempting to run a method on a non-array', function() {
            Redite.ARRAY_METHODS.SUPPORTED_ARRAY_METHODS.forEach(meth => {
                it(`method "${meth}" should throw an error if the last object is not an array`, function() {
                    return wrapper.test.set(TEST_HASH).then(() => {
                        return wrapper.test[meth]();
                    }).catch(err => {
                        expect(err).to.be.instanceof(TypeError);
                        expect(err.message).to.include(`Unable to apply array method "${meth}" to a non-array`);
                    });
                });
            });
        });

        describe('Mutating methods', function() {
            // These should all edit the array in the database, while also returning what they usually return (usually a part of the array).
            // `remove` and `removeIndex` are an exception to this of course, as they technically do not exist.

            describe('.push', function() {
                describe('Surface arrays', function() {
                    TESTS.forEach(([val, name]) => {
                        it(`should push the ${name} to the surface array`, function() {
                            return wrapper.test.foo.set([]).then(() => {
                                return wrapper.test.foo.push(val);
                            }).then(() => wrapper.test.foo.get).then(res => {
                                expect(res).to.deep.equal([val]);
                            });
                        });
                    });

                    it('should push all the values to the surface array', function() {
                        return wrapper.test.foo.set([]).then(() => {
                            return wrapper.test.foo.push(TEST_VAL);
                        }).then(() => {
                            return wrapper.test.foo.push(TEST_HASH);                        
                        }).then(() => {
                            return wrapper.test.foo.push(TEST_LIST);                        
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal([
                                TEST_VAL,
                                TEST_HASH,
                                TEST_LIST
                            ]);
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    TESTS.forEach(([val, name]) => {
                        it(`should push the ${name} to the deep array`, function() {
                            return wrapper.test.foo.bar.foobar.set([]).then(() => {
                                return wrapper.test.foo.bar.foobar.push(val);
                            }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                                expect(res).to.deep.equal([val]);
                            });
                        });
                    });

                    it('should push all the values to the deep array', function() {
                        return wrapper.test.foo.bar.foobar.set([]).then(() => {
                            return wrapper.test.foo.bar.foobar.push(TEST_VAL);
                        }).then(() => {
                            return wrapper.test.foo.bar.foobar.push(TEST_HASH);                        
                        }).then(() => {
                            return wrapper.test.foo.bar.foobar.push(TEST_LIST);                        
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal([
                                TEST_VAL,
                                TEST_HASH,
                                TEST_LIST
                            ]);
                        });
                    });
                });
            });

            describe('.pop', function() {
                describe('Surface arrays', function() {
                    it('should remove and return the value from the list', function() {
                        return wrapper.test.foo.set(TEST_LIST).then(() => {
                            return wrapper.test.foo.pop();
                        }).then(res => {
                            expect(res).to.equal(TEST_VAL);
                            return wrapper.test.foo.get;
                        }).then(res => {
                            expect(res).to.deep.equal([]);
                        });
                    });

                    it('should only pop the last item from the array', function() {
                        return wrapper.test.foo.set(['TEST ONE', 'TEST TWO']).then(() => {
                            return wrapper.test.foo.pop();
                        }).then(res => {
                            expect(res).to.equal('TEST TWO');
                            return wrapper.test.foo.get;
                        }).then(res => {
                            expect(res).to.deep.equal(['TEST ONE']);
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    it('should remove and return the value from the list', function() {
                        return wrapper.test.foo.bar.foobar.set(TEST_LIST).then(() => {
                            return wrapper.test.foo.bar.foobar.pop();
                        }).then(res => {
                            expect(res).to.equal(TEST_VAL);
                            return wrapper.test.foo.bar.foobar.get;
                        }).then(res => {
                            expect(res).to.deep.equal([]);
                        });
                    });

                    it('should only pop the last item from the array', function() {
                        return wrapper.test.foo.bar.foobar.set(['TEST ONE', 'TEST TWO']).then(() => {
                            return wrapper.test.foo.bar.foobar.pop();
                        }).then(res => {
                            expect(res).to.equal('TEST TWO');
                            return wrapper.test.foo.bar.foobar.get;
                        }).then(res => {
                            expect(res).to.deep.equal(['TEST ONE']);
                        });
                    });
                });
            });

            describe('.unshift', function() {
                describe('Surface arrays', function() {
                    TESTS.forEach(([val, name]) => {
                        it(`should add the ${name} to the surface array`, function() {
                            return wrapper.test.foo.set([]).then(() => {
                                return wrapper.test.foo.unshift(val);
                            }).then(() => wrapper.test.foo.get).then(res => {
                                expect(res).to.deep.equal([val]);
                            });
                        });
                    });

                    it('should add all the values to the surface array', function() {
                        return wrapper.test.foo.set([]).then(() => {
                            return wrapper.test.foo.unshift(TEST_VAL);
                        }).then(() => {
                            return wrapper.test.foo.unshift(TEST_HASH);                        
                        }).then(() => {
                            return wrapper.test.foo.unshift(TEST_LIST);                        
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal([
                                TEST_LIST,
                                TEST_HASH,
                                TEST_VAL
                            ]);
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    TESTS.forEach(([val, name]) => {
                        it(`should add the ${name} to the deep array`, function() {
                            return wrapper.test.foo.bar.foobar.set([]).then(() => {
                                return wrapper.test.foo.bar.foobar.unshift(val);
                            }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                                expect(res).to.deep.equal([val]);
                            });
                        });
                    });

                    it('should add all the values to the deep array', function() {
                        return wrapper.test.foo.bar.foobar.set([]).then(() => {
                            return wrapper.test.foo.bar.foobar.unshift(TEST_VAL);
                        }).then(() => {
                            return wrapper.test.foo.bar.foobar.unshift(TEST_HASH);                        
                        }).then(() => {
                            return wrapper.test.foo.bar.foobar.unshift(TEST_LIST);                        
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal([
                                TEST_LIST,
                                TEST_HASH,
                                TEST_VAL
                            ]);
                        });
                    });
                });
            });

            describe('.shift', function() {
                describe('Surface arrays', function() {
                    it('should remove and return the value from the list', function() {
                        return wrapper.test.foo.set(TEST_LIST).then(() => {
                            return wrapper.test.foo.shift();
                        }).then(res => {
                            expect(res).to.equal(TEST_VAL);
                            return wrapper.test.foo.get;
                        }).then(res => {
                            expect(res).to.deep.equal([]);
                        });
                    });
        
                    it('should only shift the first item from the list', function() {
                        return wrapper.test.foo.set(['TEST ONE', 'TEST TWO']).then(() => {
                            return wrapper.test.foo.shift();
                        }).then(res => {
                            expect(res).to.equal('TEST ONE');
                            return wrapper.test.foo.get;
                        }).then(res => {
                            expect(res).to.deep.equal(['TEST TWO']);
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    it('should remove and return the value from the list', function() {
                        return wrapper.test.foo.bar.foobar.set(TEST_LIST).then(() => {
                            return wrapper.test.foo.bar.foobar.shift();
                        }).then(res => {
                            expect(res).to.equal(TEST_VAL);
                            return wrapper.test.foo.bar.foobar.get;
                        }).then(res => {
                            expect(res).to.deep.equal([]);
                        });
                    });
        
                    it('should only shift the first item from the list', function() {
                        return wrapper.test.foo.bar.foobar.set(['TEST ONE', 'TEST TWO']).then(() => {
                            return wrapper.test.foo.bar.foobar.shift();
                        }).then(res => {
                            expect(res).to.equal('TEST ONE');
                            return wrapper.test.foo.bar.foobar.get;
                        }).then(res => {
                            expect(res).to.deep.equal(['TEST TWO']);
                        });
                    });
                });
            });

            describe('.remove', function() {
                describe('Surface arrays', function() {
                    it('should remove all items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
        
                    it('should ignore the invalid amount, and remove all items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL, '50');
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
        
                    it('should remove the first 1 items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL, 1);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']);
                        });
                    });
        
                    it('should remove the first 2 items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL, 2);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', TEST_VAL, 'SAFE']);
                        });
                    });

                    it('should remove the last 1 items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL, -1);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', 'SAFE']);
                        });
                    });

                    it('should remove the last 2 items with the same value', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.remove(TEST_VAL, -2);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', TEST_VAL, 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });

                    it('should throw an error if no item is given to remove', function() {
                        return wrapper.test.foo.set([]).then(() => {
                            return wrapper.test.foo.remove();
                        }).catch(err => {
                            expect(err).to.be.instanceof(Error);
                            expect(err.message).to.equal('You must provide an item to remove.');
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    it('should remove all items with the same value', function() {
                        return wrapper.test.foo.bar.foobar.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.bar.foobar.remove(TEST_VAL);
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
        
                    it('should ignore the invalid amount, and remove all items with the same value', function() {
                        return wrapper.test.foo.bar.foobar.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.bar.foobar.remove(TEST_VAL, '50');
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
        
                    it('should remove the first 2 items with the same value, and no more', function() {
                        return wrapper.test.foo.bar.foobar.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.bar.foobar.remove(TEST_VAL, 3);
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
        
                    it('should remove the last 2 items with the same value, and no more', function() {
                        return wrapper.test.foo.bar.foobar.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.bar.foobar.remove(TEST_VAL, -3);
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', 'SAFE', 'SAFE', 'SAFE']);
                        });
                    });
                });
            });

            describe('.removeIndex', function() {
                describe('Surface arrays', function() {
                    it('should only remove the value at the given index', function() {
                        return wrapper.test.foo.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.removeIndex(2);
                        }).then(() => wrapper.test.foo.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', TEST_VAL, TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']);
                        });
                    });

                    it('should throw an error if no item is given to remove', function() {
                        return wrapper.test.foo.set([]).then(() => {
                            return wrapper.test.foo.removeIndex();
                        }).catch(err => {
                            expect(err).to.be.instanceof(Error);
                            expect(err.message).to.equal('You must provide an index to remove.');
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    it('should only remove the value at the given index', function() {
                        return wrapper.test.foo.bar.foobar.set(['SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']).then(() => {
                            return wrapper.test.foo.bar.foobar.removeIndex(2);
                        }).then(() => wrapper.test.foo.bar.foobar.get).then(res => {
                            expect(res).to.deep.equal(['SAFE', TEST_VAL, TEST_VAL, 'SAFE', TEST_VAL, 'SAFE']);
                        });
                    });
                });
            });
        });

        describe('Non-mutating methods', function() {
            // All of these do not edit the array in the database, and are simply here to reduce the code needed for most operations on arrays.
            // e.g. `db.foo.bar.get.then(res => res.concat('foo')).then(concated => {})` simply becomes `db.foo.bar.concat('foo').then(concated => {})`.
            // `length` is a function simply so that the implementation is the same as the others, and is somewhat consistent (I may change this if people complain).

            // 10/10 would auto-generate tests again - IGN
            [
                ['concat', 'concat the value', ['concatenated'], [TEST_VAL, 'concatenated']],
                ['find', 'find the wanted value', [val => val === 'find me'], 'find me', FINDER],
                ['findIndex', 'find the index of the wanted value', [val => val === 'find me'], 2, FINDER],
                ['includes', 'check that the object is included', ['find me'], true, FINDER],
                ['includes', 'check that the object is not included', ['find me'], false, FINDER_ALT],
                ['indexOf', 'find the index of the wanted value', ['find me'], 2, FINDER],
                ['indexOf', 'not find the index of the wanted value', ['find me'], -1, FINDER_ALT],
                ['lastIndexOf', 'find the last index of the wanted value', ['find me'], 4, FINDER_2],
                ['lastIndexOf', 'not find the last index of the wanted value', ['find me'], -1, FINDER_ALT],
                ['map', 'map the given function on all values', [val => val + val.split('').reverse().join('')], [`${TEST_VAL}TSET`, 'reverseesrever', 'racecarracecar'], [TEST_VAL, 'reverse', 'racecar']],
                ['filter', 'filter out the unwanted values', [val => val !== TEST_VAL], FINDER.filter(val => val !== TEST_VAL), FINDER],
                ['join', 'join all the values with a `-`', ['-'], FINDER.join('-'), FINDER],
                ['forEach', 'add one to all the values', [(val, ind, parent) => parent[ind] = ++val], [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]]
            ].forEach(([method, description, args, expected, initial=[TEST_VAL]]) => {
                describe(`.${method}`, function() {
                    it(`should ${description} and not edit the database (surface array)`, function() {
                        return wrapper.test.foo.set(initial).then(() => {
                            return wrapper.test.foo[method](...args);
                        }).then(res => {
                            expect(res).to.deep.equal(expected);
                            return wrapper.test.foo.get;
                        }).then(res => {
                            expect(res).to.deep.equal(initial);
                        });
                    });

                    it(`should ${description} and not edit the database (deeply nested array)`, function() {
                        return wrapper.test.foo.bar.foobar.set(initial).then(() => {
                            return wrapper.test.foo.bar.foobar[method](...args);
                        }).then(res => {
                            expect(res).to.deep.equal(expected);
                            return wrapper.test.foo.bar.foobar.get;
                        }).then(res => {
                            expect(res).to.deep.equal(initial);
                        });
                    });
                });
            });

            describe('.length', function() {
                describe('Surface array', function() {
                    [0, 1, 2, 3, 4, 5].forEach(val => {
                        it(`should have a length of ${val}`, function() {
                            let sender = new Array(val).fill(TEST_VAL);

                            return wrapper.test.foo.set(sender).then(() => {
                                return wrapper.test.foo.length();
                            }).then(len => {
                                expect(len).to.equal(val);
                            });
                        });
                    });
                });

                describe('Deeply nested array', function() {
                    [0, 1, 2, 3, 4, 5].forEach(val => {
                        it(`should have a length of ${val}`, function() {
                            let sender = new Array(val).fill(TEST_VAL);
        
                            return wrapper.test.foo.bar.foobar.set(sender).then(() => {
                                return wrapper.test.foo.bar.foobar.length();
                            }).then(len => {
                                expect(len).to.equal(val);
                            });
                        });
                    });
                });
            });
        });
    });
});