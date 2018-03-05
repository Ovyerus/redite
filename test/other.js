/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */

const DB = 15; // Moves all the testing out of a possibly used DB index, as we call FLUSHDB before each test.
const TEST_HASH = {TEST_HASH: 'TEST'};

const chai = require('chai');
const {expect} = chai;

const Redite = require('../');
const redis = require('redis');
const {inspect: {custom}} = require('util');
const {fork} = require('child_process');

const client = redis.createClient({db: DB});
const wrapper = new Redite({client, customInspection: true});

// Clear out the database before and after use, to make sure that all data is just our own.
beforeEach(function(done) {
    client.flushdb(err => err ? done(err) : done());
});

after(function(done) {
    client.flushdb(err => err ? done(err) : done());
});

describe('Extra coverage', function() {
    it('should auto-gen settings when not given anything', function() {
        let db = new Redite();

        expect(db._redis).to.be.instanceof(redis.RedisClient);
        expect(db._serialise).to.equal(JSON.stringify);
        expect(db._parse).to.equal(JSON.parse);
        expect(db._deletedString).to.equal('@__DELETED__@');
        expect(db._customInspection).to.be.false;
    });

    it('should unref if told to', function(done) {
        this.timeout(12000);
        this.slow(12000);

        let child = fork(`${__dirname}/lib/unrefTest.js`);

        let timer = setTimeout(() => {
            child.kill();
            done(new Error('Child process did not exit.'));
        }, 5000);

        child.on('close', () => {
            clearTimeout(timer);
            done();
        });
    });

    it("(resolveStack) shouldn't care about not being given a stack", function() {
        return wrapper.test.set(TEST_HASH).then(() => {
            return wrapper.resolveStack('test');
        }).then(res => {
            expect(res).to.deep.equal(TEST_HASH);
        });
    });

    it('(resolveSetStack) should throw an error when not given a stack', function() {
        return wrapper.resolveSetStack(TEST_HASH).catch(err => {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.equal('At least one key is required in the stack');
        });
    });

    it("(resolveDeleteStack) shouldn't care about not being given a stack", function() {
        return wrapper.test.set(TEST_HASH).then(() => {
            return wrapper.resolveDeleteStack('test');
        }).then(() => wrapper.test.exists()).then(exists => {
            expect(exists).to.be.false;
        });
    });

    it("(resolveHasStack) shouldn't care about not being given a stack", function() {
        return wrapper.test.set(TEST_HASH).then(() => {
            return wrapper.resolveHasStack('test');
        }).then(exists => {
            expect(exists).to.be.true;
        });
    });

    describe('resolveArrayMethods', function() {
        it('should throw an error on an unsupported method', function() {
            try {
                wrapper.resolveArrayHelpers('foo');
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Method "foo" is not supported.');
            }
        });

        it('should throw an error on an empty stack', function() {
            try {
                wrapper.resolveArrayHelpers('forEach');
            } catch(err) {
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('At least one key is required in the stack');
            }
        });
    });

    describe('util.inspect.custom (custom inspection)', function() {
        it('should be a function', function() {
            expect(wrapper[custom]).to.be.a('function');
        });

        it('should return a new class called `Redite`', function() {
            expect(wrapper[custom]().constructor.name).to.equal('Redite');
        });

        it('should have regular values, with `redis` set to "<hidden>"', function() {
            let res = wrapper[custom]();

            expect(res.redis).to.equal('<hidden>');
            expect(res.serialise).to.equal(wrapper._serialise);
            expect(res.parse).to.equal(wrapper._parse);
            expect(res.deletedString).to.equal(wrapper._deletedString);
            expect(res.customInspection).to.equal(wrapper._customInspection);
        });
    });
});