/* eslint-env mocha */

const {expect, use} = require('chai');
const chaiAsPromised = require('chai-as-promised');
const redis = require('redis');
const Redite = require('../');
const {
    promisify,
    DB
} = require('./lib/consts');

use(chaiAsPromised);

const client = redis.createClient({db: DB});
const wrapper = new Redite({client});

const flushdb = promisify(client.flushdb, client);
const set = promisify(client.set, client);

beforeEach(() => flushdb());
after(() => flushdb());

describe('Redite', () => {
    describe('get trap', () => {
        it('should enable access to object properties', () => {
            expect(wrapper._redis).to.be.instanceof(redis.RedisClient);
            expect(wrapper._serialise).to.be.a('function');
            expect(wrapper._parse).to.be.a('function');
            expect(wrapper._deletedString).to.be.a('string');
        });

        it('should throw an error for #set', () => {
            expect(() => wrapper.set).to.throw(Error, 'You cannot use #set on the root object.');
        });

        describe('#has', () => {
            it('should return a function', () => {
                expect(wrapper.has).to.be.a('function');
            });

            it('should check if a key exists', async () => {
                await expect(wrapper.has('test')).to.become(false);
                await set('test', 'existance test');
                await expect(wrapper.has('test')).to.become(true);
            });
        });

        describe('#delete', () => {
            it('should return a function', () => {
                expect(wrapper.delete).to.be.a('function');
            });

            it('should delete a key', async () => {
                await set('test', 'deletion test');
                await wrapper.delete('test');
                await expect(promisify(client.exists, client)('test')).to.become(0);
            });
        });

        describe('any other key', () => {
            it('should return a ChildWrapper', () => {
                expect(wrapper.foo).to.be.instanceOf(Redite.ChildWrapper);
            });
        });
    });

    describe('set trap', () => {
        it('should throw an error', () => {
            expect(() => wrapper.foo = 'Some text').to.throw(Error, 'Redite does not support setting (foo = bar)');
        });
    });

    describe('has trap', () => {
        it('should throw an error', () => {
            expect(() => 'foo' in wrapper).to.throw(Error, 'Redite does not support containment checks ("foo" in bar)');
        });
    });

    describe('delete trap', () => {
        it('should throw an error', () => {
            expect(() => delete wrapper.foo).to.throw(Error, 'Redite does not support deletion (delete foo.bar)');
        });
    });
});