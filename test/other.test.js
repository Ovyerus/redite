/* eslint-env mocha */

const { expect, use } = require('chai');
const chaiAsPromised = require('chai-as-promised');
const redis = require('redis');

const {
  inspect: { custom }
} = require('util');
const { fork } = require('child_process');

const Redite = require('../');

const { promisify, DB, TestHash } = require('./lib/consts');

use(chaiAsPromised);

const client = redis.createClient({ db: DB });
const wrapper = new Redite({
  client,
  customInspection: true,
  ignoreUndefinedValues: true
});

const flushdb = promisify(client.flushdb, client);

beforeEach(() => flushdb());
after(() => flushdb());

describe('Extra coverage', () => {
  it('should auto-gen settings when not given anything', () => {
    /* eslint-disable no-unused-expressions */
    const db = new Redite();

    expect(db._redis).to.be.instanceof(redis.RedisClient);
    expect(db._serialise).to.equal(JSON.stringify);
    expect(db._parse).to.equal(JSON.parse);
    expect(db._deletedString).to.equal('@__DELETED__@');
    expect(db._customInspection).to.be.false;
    expect(db._ignoreUndefinedValues).to.be.false;
    /* eslint-enable */
  });

  it('should unref if told to', function(done) {
    this.timeout(12000);
    this.slow(12000);

    const child = fork(`${__dirname}/lib/unrefTest.js`);

    const timer = setTimeout(() => {
      child.kill();
      done(new Error('Child process did not exit.'));
    }, 5000);

    child.on('close', () => {
      clearTimeout(timer);
      done();
    });
  });

  describe('getStack', () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await expect(wrapper.getStack('test')).to.become(TestHash);
    });
  });

  describe('setStack', () => {
    it('should throw an error when not given a stack', async () => {
      await expect(wrapper.setStack(TestHash)).to.be.rejectedWith(
        Error,
        'At least one key is required in the stack'
      );
    });

    it('should ignore undefined values if ignoreUndefinedValues is true', async () => {
      await expect(wrapper.setStack(undefined, ['foo'])).to.become(void 0);
    });
  });

  describe('deleteStack', () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await wrapper.deleteStack('test');
      await expect(wrapper.test.exists()).to.become(false);
    });
  });

  describe('hasStack', () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await expect(wrapper.hasStack('test')).to.become(true);
    });
  });

  describe('arrayStack', () => {
    it('should throw an error on an unsupported method', () => {
      expect(() => wrapper.arrayStack('foo')).to.throw(
        Error,
        'Method "foo" is not supported'
      );
    });

    it('should throw an error on an empty stack', () => {
      expect(() => wrapper.arrayStack('forEach')).to.throw(
        Error,
        'At least one key is required in the stack'
      );
    });

    it('should throw an error when trying to call a non-mutating method on a native list', async () => {
      await expect(wrapper.arrayStack('forEach', ['foo'])()).to.be.rejectedWith(
        Error,
        'Unable to apply method "forEach" on a first level value.'
      );
    });

    it('should throw an error when trying to apply a method on a non-array', async () => {
      await wrapper.test.foo.set(TestHash);
      await expect(
        wrapper.arrayStack('map', ['test', 'foo'])()
      ).to.be.rejectedWith(
        Error,
        `Unable to apply method "map" to a non-array (${typeof TestHash})`
      );
    });
  });

  describe('Custom inspection', () => {
    it('should be a function', () => {
      expect(wrapper[custom]).to.be.a('function');
    });

    it('should return a new class called `Redite`', () => {
      expect(wrapper[custom]().constructor.name).to.equal('Redite');
    });

    it('should have regular values, with `redis` set to "<hidden>"', () => {
      const res = wrapper[custom]();

      expect(res._redis).to.equal('<hidden>');
      expect(res._serialise).to.equal(wrapper._serialise);
      expect(res._parse).to.equal(wrapper._parse);
      expect(res._deletedString).to.equal(wrapper._deletedString);
      expect(res._customInspection).to.equal(wrapper._customInspection);
      expect(res._ignoreUndefinedValues).to.equal(
        wrapper._ignoreUndefinedValues
      );
    });

    it('should return the regular Redite instance if disabled', () => {
      const db = new Redite();

      expect(db[custom]()).to.equal(db);
    });
  });
});
