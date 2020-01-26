/* eslint-env mocha */

const { expect, use } = require('chai');
const chaiAsPromised = require('chai-as-promised');
const redis = require('redis');

const Redite = require('../');

const {
  promisify,
  DB,
  TestVal,
  TestHash,
  TestList,
  Tests,
  RemoveArr,
  RemoveArrRes,
  NonMutatingTests
} = require('./lib/consts');

use(chaiAsPromised);

const client = redis.createClient({ db: DB });
const wrapper = new Redite({ client });

const flushdb = promisify(client.flushdb, client);
const type = promisify(client.type, client);

beforeEach(() => flushdb());
after(() => flushdb());

describe('Redite array methods', () => {
  describe('Mutating methods', () => {
    describe('#push', async () => {
      for (const [type, val] of Tests)
        it(`should append the ${type} to the list`, async () => {
          await wrapper.test.push(val);
          await expect(wrapper.test).to.become([val]);
        });

      it('should append multiple elements to the list', async () => {
        await wrapper.test.push(TestVal);
        await wrapper.test.push(TestHash);
        await wrapper.test.push(TestList);
        await expect(wrapper.test).to.become([TestVal, TestHash, TestList]);
      });
    });

    describe('#pop', () => {
      it('should remove and return the value from the list', async () => {
        await wrapper.test.set(TestList);
        await expect(wrapper.test.pop()).to.become(TestVal);
        await expect(type('test')).to.become('none');
      });

      it('should only pop the last item from the list', async () => {
        await wrapper.test.set(['test one', 'test two']);
        await expect(wrapper.test.pop()).to.become('test two');
        await expect(wrapper.test).to.become(['test one']);
      });
    });

    describe('#unshift', () => {
      for (const [type, val] of Tests)
        it(`should prepend the ${type} to the list`, async () => {
          await wrapper.test.unshift(val);
          await expect(wrapper.test).to.become([val]);
        });

      it('should prepend multiple elements to list', async () => {
        await wrapper.test.unshift(TestVal);
        await wrapper.test.unshift(TestHash);
        await wrapper.test.unshift(TestList);
        await expect(wrapper.test).to.become([TestList, TestHash, TestVal]);
      });
    });

    describe('#shift', () => {
      it('should remove and return the value from the list', async () => {
        await wrapper.test.set(TestList);
        await expect(wrapper.test.shift()).to.become(TestVal);
        await expect(type('test')).to.become('none');
      });

      it('should only shift the first item from the list', async () => {
        await wrapper.test.set(['test one', 'test two']);
        await expect(wrapper.test.shift()).to.become('test one');
        await expect(wrapper.test).to.become(['test two']);
      });
    });

    describe('#remove', () => {
      describe('Native list', () => {
        it('should remove all items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal);
          await expect(wrapper.test).to.become(RemoveArrRes);
        });

        it('should ignore the invalid amount and remove all items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal, 'foo');
          await expect(wrapper.test).to.become(RemoveArrRes);
        });

        it('should remove the first 2 items with the same value', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.remove(TestVal, 2);
          await expect(wrapper.test).to.become([
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
          await expect(wrapper.test).to.become([
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
          await expect(wrapper.test.foo.remove()).to.be.rejectedWith(
            Error,
            'You must provide an item to remove'
          );
        });

        it('should remove all items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal);
          await expect(wrapper.test.foo).to.become(RemoveArrRes);
        });

        it('should ignore the invalid amount and remove all items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, 'foo');
          await expect(wrapper.test.foo).to.become(RemoveArrRes);
        });

        it('should remove the first 2 items with the same value', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, 2);
          await expect(wrapper.test.foo).to.become([
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
          await expect(wrapper.test.foo).to.become([
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
          await expect(wrapper.test.foo).to.become(RemoveArrRes);
        });

        it('should remove all specified items the if the amount is larger than the amount that exists (negative)', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.remove(TestVal, -4);
          await expect(wrapper.test.foo).to.become(RemoveArrRes);
        });
      });
    });

    describe('.removeIndex', () => {
      describe('Native list', () => {
        it('should only remove the value at the given index', async () => {
          await wrapper.test.set(RemoveArr);
          await wrapper.test.removeIndex(2);
          await expect(wrapper.test).to.become([
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
          await expect(wrapper.test.foo.removeIndex()).to.be.rejectedWith(
            Error,
            'You must provide an index to remove'
          );
        });

        it('should only remove the value at the given index', async () => {
          await wrapper.test.foo.set(RemoveArr);
          await wrapper.test.foo.removeIndex(2);
          await expect(wrapper.test.foo).to.become([
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
      for (const len of [0, 1, 2, 3, 4, 5]) {
        it(`should have a length of ${len} (native list)`, async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.set(sender);
          await expect(wrapper.test.length()).to.become(len);
        });

        it(`should have a length of ${len} (surface array (two keys))`, async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.foo.set(sender);
          await expect(wrapper.test.foo.length()).to.become(len);
        });

        it(`should have a length of ${len} (deep array)`, async () => {
          const sender = new Array(len).fill(TestVal);

          await wrapper.test.foo.bar.foobar.set(sender);
          await expect(wrapper.test.foo.bar.foobar.length()).to.become(len);
        });
      }
    });

    describe('Method tests', () => {
      for (let [method, tests] of Object.entries(NonMutatingTests)) {
        if (!Array.isArray(tests)) tests = [tests];

        for (const { should, args, expected, initial = [TestVal] } of tests) {
          it(`should ${should} and not edit the database (surface array)`, async () => {
            await wrapper.test.foo.set(initial);
            await expect(wrapper.test.foo[method](...args)).to.become(expected);
            await expect(wrapper.test.foo).to.become(initial);
          });

          it(`should ${should} and not edit the database (deep array)`, async () => {
            await wrapper.test.foo.bar.foobar.set(initial);
            await expect(
              wrapper.test.foo.bar.foobar[method](...args)
            ).to.become(expected);
            await expect(wrapper.test.foo.bar.foobar).to.become(initial);
          });
        }
      }
    });
  });
});
