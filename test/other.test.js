/* eslint-env jest */

const Redis = require("ioredis");

const {
  inspect: { custom },
} = require("util");

const Redite = require("../");

const { redisUrl, TestHash } = require("./lib/consts");

const client = new Redis(redisUrl);
const wrapper = new Redite({
  client,
  customInspection: true,
  ignoreUndefinedValues: true,
});

beforeEach(() => client.flushdb());
afterAll(async () => {
  await client.flushdb();
  client.disconnect();
});

describe("Extra coverage", () => {
  it("should auto-gen settings when not given anything", () => {
    const db = new Redite();

    expect(db._redis).toBeInstanceOf(Redis);
    expect(db._serialise).toBe(JSON.stringify);
    expect(db._parse).toBe(JSON.parse);
    expect(db._deletedString).toBe("@__DELETED__@");
    expect(db._customInspection).toBe(false);
    expect(db._ignoreUndefinedValues).toBe(false);

    db._redis.disconnect();
  });

  describe("getStack", () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await expect(wrapper.getStack("test")).resolves.toStrictEqual(TestHash);
    });
  });

  describe("setStack", () => {
    it("should throw an error when not given a stack", async () => {
      await expect(wrapper.setStack(TestHash)).rejects.toThrow(
        new Error("At least one key is required in the stack")
      );
    });

    it("should ignore undefined values if ignoreUndefinedValues is true", async () => {
      await expect(wrapper.setStack(undefined, ["foo"])).resolves.toBe(
        undefined
      );
    });
  });

  describe("deleteStack", () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await wrapper.deleteStack("test");
      await expect(wrapper.test.exists()).resolves.toBe(false);
    });
  });

  describe("hasStack", () => {
    it("shouldn't care about not being given a stack", async () => {
      await wrapper.test.set(TestHash);
      await expect(wrapper.hasStack("test")).resolves.toBe(true);
    });
  });

  describe("arrayStack", () => {
    it("should throw an error on an unsupported method", () => {
      expect(() => wrapper.arrayStack("foo")).toThrow(
        new Error('Method "foo" is not supported')
      );
    });

    it("should throw an error on an empty stack", () => {
      expect(() => wrapper.arrayStack("forEach")).toThrow(
        new Error("At least one key is required in the stack")
      );
    });

    it("should throw an error when trying to call a non-mutating method on a native list", async () => {
      await expect(wrapper.arrayStack("forEach", ["foo"])()).rejects.toThrow(
        new Error('Unable to apply method "forEach" on a first level value.')
      );
    });

    it("should throw an error when trying to apply a method on a non-array", async () => {
      await wrapper.test.foo.set(TestHash);
      await expect(
        wrapper.arrayStack("map", ["test", "foo"])()
      ).rejects.toThrow(
        new Error(
          `Unable to apply method "map" to a non-array (${typeof TestHash})`
        )
      );
    });
  });

  describe("Custom inspection", () => {
    it("should be a function", () => {
      expect(wrapper[custom]).toBeInstanceOf(Function);
    });

    it("should return a new class called `Redite`", () => {
      expect(wrapper[custom]().constructor.name).toBe("Redite");
    });

    it('should have regular values, with `redis` set to "<hidden>"', () => {
      const res = wrapper[custom]();

      expect(res._redis).toBe("<hidden>");
      expect(res._serialise).toBe(wrapper._serialise);
      expect(res._parse).toBe(wrapper._parse);
      expect(res._deletedString).toBe(wrapper._deletedString);
      expect(res._customInspection).toBe(wrapper._customInspection);
      expect(res._ignoreUndefinedValues).toBe(wrapper._ignoreUndefinedValues);
    });

    it("should return the regular Redite instance if disabled", () => {
      const db = new Redite();

      expect(db[custom]()).toBe(db);

      db._redis.disconnect();
    });
  });
});
