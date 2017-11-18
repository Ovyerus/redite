/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */

const URL = 'redis://127.0.0.1/15'; // Moves all the testing out of a possibly used DB index, as we call FLUSHDB before each test.
const TEST_HASH = {TEST_HASH: 'TEST HASH'};

const chai = require('chai');
const {expect} = chai;

const Redite = require('../');
const {fork} = require('child_process');
const wrapper = new Redite({url: URL});

describe('Extra coverage', function() {
    it('should auto-gen settings when not given anything', function() {
        let db = new Redite();

        expect(db._serialise).to.equal(JSON.stringify);
        expect(db._parse).to.equal(JSON.parse);
        expect(db._deletedString).to.equal('@__DELETED__@');
    });

    it("shouldn't unref if told to", function(done) {
        this.timeout(10000);

        let works = false;
        let child = fork(`${__dirname}/unrefTest.js`);
        let timer = setTimeout(() => {
            works = true;
            child.kill();
            done();
        }, 5000);

        child.on('close', () => {
            if (!works) {
                clearTimeout(timer);
                done(new Error('child process closed prematurely.'));
            }
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
});