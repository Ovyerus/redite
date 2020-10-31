/* eslint-env jest */

const Redis = require("ioredis");

const Redite = require("../");

const { db } = require("./lib/consts");

const client = new Redis({ db });
const wrapper = new Redite({ client });

beforeEach(() => client.flushdb());
afterAll(async () => {
  await client.flushdb();
  client.disconnect();
});

describe("Redite", () => {
  describe("get trap", () => {
    it("should enable access to object properties", () => {
      expect(wrapper._redis).toBeInstanceOf(Redis);
      expect(wrapper._serialise).toBeFunction();
      expect(wrapper._parse).toBeFunction();
      expect(wrapper._deletedString).toBeString();
    });

    it("should throw an error for #set", () => {
      expect(() => wrapper.set).toThrow(
        new Error("You cannot use #set on the root object.")
      );
    });

    describe("#has", () => {
      it("should return a function", () => {
        expect(wrapper.has).toBeFunction();
      });

      it("should check if a key exists", async () => {
        await expect(wrapper.has("test")).resolves.toBe(false);
        await client.set("test", "existance test");
        await expect(wrapper.has("test")).resolves.toBe(true);
      });
    });

    describe("#delete", () => {
      it("should return a function", () => {
        expect(wrapper.delete).toBeFunction();
      });

      it("should delete a key", async () => {
        await client.set("test", "deletion test");
        await wrapper.delete("test");
        await expect(client.exists("test")).resolves.toBe(0);
      });
    });

    describe("any other key", () => {
      it("should return a ChildWrapper", () => {
        expect(wrapper.foo).toBeInstanceOf(Redite.ChildWrapper);
      });
    });
  });

  describe("set trap", () => {
    it("should throw an error", () => {
      expect(() => (wrapper.foo = "Some text")).toThrow(
        new Error("Redite does not support setting (foo = bar)")
      );
    });
  });

  describe("has trap", () => {
    it("should throw an error", () => {
      expect(() => "foo" in wrapper).toThrow(
        new Error('Redite does not support containment checks ("foo" in bar)')
      );
    });
  });

  describe("delete trap", () => {
    it("should throw an error", () => {
      expect(() => delete wrapper.foo).toThrow(
        new Error("Redite does not support deletion (delete foo.bar)")
      );
    });
  });
});
