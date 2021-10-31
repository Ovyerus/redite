/* eslint-env jest */

const Redis = require("ioredis");

const Redite = require("../");

const { redisUrl, TestHash } = require("./lib/consts");

const client = new Redis(redisUrl);
const wrapper = new Redite({
  client,
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

    expect(db.$redis).toBeInstanceOf(Redis);
    expect(db.$serialise).toBe(JSON.stringify);
    expect(db.$parse).toBe(JSON.parse);
    expect(db.$deletedString).toBe("@__DELETED__@");
    expect(db.$ignoreUndefinedValues).toBe(false);

    db.$redis.disconnect();
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
});
