/* eslint-env jest */

const Redis = require('ioredis');

const Redite = require('../');

const {
  db,
  TestVal,
  TestHash,
  TestList,
  Tests,
  RemoveArr,
  RemoveArrRes,
  NonMutatingTests
} = require('./lib/consts');

const client = new Redis({ db });
const wrapper = new Redite({ client });

beforeEach(() => client.flushdb());
afterAll(async () => {
  await client.flushdb();
  client.disconnect();
});

describe('Redite array methods', () => {
  describe('Mutating methods', () => {
    describe('#push', () => {
      it.each(Tests)('should append the %s to the list', async (_, val) => {
        await wrapper.test.push(val);
        await expect(wrapper.test).resolves.toStrictEqual([val]);
      });

      it('should append multiple elements to the list', async () => {
        await wrapper.test.push(TestVal);
        await wrapper.test.push(TestHash);
        await wrapper.test.push(TestList);
        await expect(wrapper.test).resolves.toStrictEqual([
          TestVal,
          TestHash,
          TestList
        ]);
      });
    });

    describe('#pop', () => {
      it('should remove and return the value from the list', async () => {
        await wrapper.test.set(TestList);
        await expect(wrapper.test.pop()).resolves.toBe(TestVal);
        await expect(client.type('test')).resolves.toBe('none');
      });

      it('should only pop the last item from the list', async () => {
        await wrapper.test.set(['test one', 'test two']);
        await expect(wrapper.test.pop()).resolves.toBe('test two');
        await expect(wrapper.test).resolves.toStrictEqual(['test one']);
      });
    });

    describe('#unshift', () => {
      for (const [type, val] of Tests)
        it(`should prepend the ${type} to the list`, async () => {
          await wrapper.test.unshift(val);
          await expect(wrapper.test).resolves.toStrictEqual([val]);
        });

      it('should prepend multiple elements to list', async () => {
        await wrapper.test.unshift(TestVal);
        await wrapper.test.unshift(TestHash);
        await wrapper.test.unshift(TestList);
        await expect(wrapper.test).resolves.toStrictEqual([
          TestList,
          TestHash,
          TestVal
        ]);
      });
    });

    describe('#shift', () => {
      it('should remove and return the value from the list', async () => {
        await wrapper.test.set(TestList);
        await expect(wrapper.test.shift()).resolves.toBe(TestVal);
        await expect(client.type('test')).resolves.toBe('none');
      });

      it('should only shift the first item from the list', async () => {
        await wrapper.test.set(['test one', 'test two']);
        await expect(wrapper.test.shift()).resolves.toBe('test one');
        await expect(wrapper.test).resolves.toStrictEqual(['test two']);
      });
    });

    describe('#remove', () => {
      describe('Native list', () => {
        it('should remove all items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal);
          await expect(wrapper.test).resolves.toStrictEqual(RemoveArrRes);
        });

        it('should ignore the invalid amount and remove all items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal, 'foo');
          await expect(wrapper.test).resolves.toStrictEqual(RemoveArrRes);
        });

        it('should remove the first 2 items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal, 2);
          await expect(wrapper.test).resolves.toStrictEqual([
            'safe',
            'safe',
            'safe',
            TestVal,
            'safe'
          ]);
        });

        it('should remove the last 2 items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal, -2);
          await expect(wrapper.test).resolves.toStrictEqual([
            'safe',
            TestVal,
            'safe',
            'safe',
            'safe'
          ]);
        });
      });

      describe('Nested array', () => {
        it('should throw an error if not given an item to remove', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await expect(wrapper.test.foo.remove()).rejects.toThrow(
            new Error('You must provide an item to remove')
          );
        });

        it('should remove all items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal);
          await expect(wrapper.test.foo).resolves.toStrictEqual(RemoveArrRes);
        });

        it('should ignore the invalid amount and remove all items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, 'foo');
          await expect(wrapper.test.foo).resolves.toStrictEqual(RemoveArrRes);
        });

        it('should remove the first 2 items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, 2);
          await expect(wrapper.test.foo).resolves.toStrictEqual([
            'safe',
            'safe',
            'safe',
            TestVal,
            'safe'
          ]);
        });

        it('should remove the last 2 items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, -2);
          await expect(wrapper.test.foo).resolves.toStrictEqual([
            'safe',
            TestVal,
            'safe',
            'safe',
            'safe'
          ]);
        });

        it('should remove all specified items the if the amount is larger than the amount that exists', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, 4);
          await expect(wrapper.test.foo).resolves.toStrictEqual(RemoveArrRes);
        });

        it('should remove all specified items the if the amount is larger than the amount that exists (negative)', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, -4);
          await expect(wrapper.test.foo).resolves.toStrictEqual(RemoveArrRes);
        });
      });
    });

    describe('.removeIndex', () => {
      describe('Native list', () => {
        it('should only remove the value at the given index', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.removeIndex(2);
          await expect(wrapper.test).resolves.toStrictEqual([
            'safe',
            TestVal,
            TestVal,
            'safe',
            TestVal,
            'safe'
          ]);
        });
      });

      describe('Nested array', () => {
        it('should throw an error when not given an index to remove', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await expect(wrapper.test.foo.removeIndex()).rejects.toThrow(
            new Error('You must provide an index to remove.')
          );
        });

        it('should only remove the value at the given index', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.removeIndex(2);
          await expect(wrapper.test.foo).resolves.toStrictEqual([
            'safe',
            TestVal,
            TestVal,
            'safe',
            TestVal,
            'safe'
          ]);
        });
      });
    });
  });

  describe('Non-mutating methods', () => {
    describe('#length', () => {
      describe.each([0, 1, 2, 3, 4, 5])('should have a length of %i', len => {
        test('native list', async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.set(sender);
          await expect(wrapper.test.length()).resolves.toBe(len);
        });

        test('surface array (two keys)', async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.foo.set(sender);
          await expect(wrapper.test.foo.length()).resolves.toBe(len);
        });

        test('deep array', async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.foo.bar.foobar.set(sender);
          await expect(wrapper.test.foo.bar.foobar.length()).resolves.toBe(len);
        });
      });
    });

    describe('Method tests', () => {
      describe.each(Object.entries(NonMutatingTests))(
        '#%s',
        (method, tests_) => {
          const tests = (!Array.isArray(tests_) ? [tests_] : tests_).map(t =>
            Object.values(t)
          );

          describe.each(tests)(
            'should %s and not edit the database',
            (_, args, expected, initial = [TestVal]) => {
              test('surface array', async () => {
                await wrapper.test.foo.set(initial);
                await expect(
                  wrapper.test.foo[method](...args)
                ).resolves.toStrictEqual(expected);
                await expect(wrapper.test.foo).resolves.toStrictEqual(initial);
              });

              test('deep array', async () => {
                await wrapper.test.foo.bar.foobar.set(initial);
                await expect(
                  wrapper.test.foo.bar.foobar[method](...args)
                ).resolves.toStrictEqual(expected);
                await expect(
                  wrapper.test.foo.bar.foobar
                ).resolves.toStrictEqual(initial);
              });
            }
          );
        }
      );
    });
  });
});
