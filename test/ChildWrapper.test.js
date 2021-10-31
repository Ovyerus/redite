/* eslint-env jest */

const Redis = require("ioredis");

const Redite = require("../");

const {
  redisUrl,
  TestVal,
  TestHash,
  TestList,
  DeepHash,
} = require("./lib/consts");

const client = new Redis(redisUrl);
const wrapper = new Redite({ client });

beforeEach(() => client.flushdb());
afterAll(async () => {
  await client.flushdb();
  client.disconnect();
});

describe("ChildWrapper", () => {
  describe("get trap", () => {
    describe("any key", () => {
      it("should return another ChildWrapper with an extended", () => {
        const a = wrapper.foo.bar;

        expect(a).toBeInstanceOf(Redite.ChildWrapper);
        expect(a._stack).toStrictEqual(["foo", "bar"]);
      });

      it("should continually give ChildWrappers no matter how deep the stack goes", () => {
        // eslint-disable-next-line prefer-destructuring
        const a = wrapper.foo.bar.faz.foobar.fizz.buzz.fizzbuzz[100];

        expect(a).toBeInstanceOf(Redite.ChildWrapper);
        expect(a._stack).toStrictEqual([
          "foo",
          "bar",
          "faz",
          "foobar",
          "fizz",
          "buzz",
          "fizzbuzz",
          "100",
        ]);
      });
    });

    describe("Getting objects", () => {
      it("should be a function that returns a promise", () => {
        expect(wrapper.foo.then).toBeInstanceOf(Function);
        expect(wrapper.foo.then()).toBeInstanceOf(Promise);
      });

      describe("Regular values", () => {
        it("should get the value specified", async () => {
          await client.set("test", '"ChildWrapper get test"');
          await expect(wrapper.test).resolves.toBe("ChildWrapper get test");
        });
      });

      describe("Hashmaps", () => {
        it("should get the value from within the hashmap", async () => {
          await client.hset("test", "foo", '"ChildWrapper get hash test"');
          await expect(wrapper.test.foo).resolves.toBe(
            "ChildWrapper get hash test"
          );
        });

        it("should get the deeply nested value", async () => {
          await client.hset("test", "foo", JSON.stringify(TestHash));
          await expect(wrapper.test.foo.TestHash).resolves.toBe(TestVal);
        });

        it("should get the really deeply nested value", async () => {
          await client.hset("test", "foo", JSON.stringify(DeepHash));
          await expect(wrapper.test.foo.bar.baz.foobar.TestHash).resolves.toBe(
            TestVal
          );
        });

        it("should get all the values of the hash", async () => {
          await client.hset("test", "foo", '"ChildWrapper get hash test 1"');
          await client.hset("test", "bar", '"ChildWrapper get hash test 2"');
          await expect(wrapper.test).resolves.toStrictEqual({
            foo: "ChildWrapper get hash test 1",
            bar: "ChildWrapper get hash test 2",
          });
        });
      });

      describe("Lists", () => {
        it("should get the value from within the list", async () => {
          await client.rpush("test", '"ChildWrapper get list test"');
          await expect(wrapper.test[0]).resolves.toBe(
            "ChildWrapper get list test"
          );
        });

        it("should get the deeply nested value", async () => {
          await client.rpush("test", JSON.stringify(TestHash));
          await expect(wrapper.test[0].TestHash).resolves.toBe(TestVal);
        });

        it("should get the really deeply nested value", async () => {
          await client.rpush("test", JSON.stringify({ foo: DeepHash }));
          await expect(
            wrapper.test[0].foo.bar.baz.foobar.TestHash
          ).resolves.toBe(TestVal);
        });

        it("should get all the values of the list", async () => {
          await client.rpush(
            "test",
            '"ChildWrapper get list test 1"',
            '"ChildWrapper get list test 2"'
          );
          await expect(wrapper.test).resolves.toStrictEqual([
            "ChildWrapper get list test 1",
            "ChildWrapper get list test 2",
          ]);
        });
      });
    });

    describe("#set", () => {
      it("should return a function", () => {
        expect(wrapper.foo.set).toBeInstanceOf(Function);
      });

      it("should set the value of the given key", async () => {
        await wrapper.test.set("ChildWrapper set test");
        await expect(wrapper.test).resolves.toBe("ChildWrapper set test");
      });

      it("should set a hashmap", async () => {
        await wrapper.test.set(TestHash);
        await expect(client.type("test")).resolves.toBe("hash");
        await expect(wrapper.test.TestHash).resolves.toBe(TestVal);
      });

      it("should set a list", async () => {
        await wrapper.test.set(TestList);
        await expect(client.type("test")).resolves.toBe("list");
        await expect(wrapper.test[0]).resolves.toBe(TestVal);
      });

      it("should set a deeply nested object, with the first as a hash", async () => {
        await wrapper.test.foo.bar.foobar.set(TestHash);
        await expect(client.type("test")).resolves.toBe("hash");
        await expect(wrapper.test.foo.bar.foobar.TestHash).resolves.toBe(
          TestVal
        );
      });

      it("should set a deeply nested array, with the first as a list", async () => {
        await wrapper.test[0].foo[0].bar.set(TestList);
        await expect(client.type("test")).resolves.toBe("list");
        await expect(wrapper.test[0].foo[0].bar[0]).resolves.toBe(TestVal);
      });

      it("should set a hash with a placeholder value if given an empty object", async () => {
        await wrapper.test.set({});
        await expect(client.exists("test")).resolves.toBe(1);
        await expect(wrapper.test).resolves.toStrictEqual({
          // eslint-disable-next-line camelcase
          __setting_empty_hash__: "__setting_empty_hash__",
        });
      });

      it("should set an empty object on a deeply nessted object when given an empty object", async () => {
        await wrapper.test.foo.bar.foobar.set({});
        await expect(wrapper.test.foo.bar.foobar).resolves.toStrictEqual({});
      });

      it("should not set anything if given an empty array", async () => {
        await wrapper.test.set([]);
        await expect(client.exists("test")).resolves.toBe(0);
      });

      it("should edit an object tree without overriding any parts of it", async () => {
        await wrapper.test.foo.bar.set(TestHash);
        await wrapper.test.foo.TestHash.set(TestVal);
        await expect(wrapper.test).resolves.toStrictEqual({
          foo: {
            bar: TestHash,
            ...TestHash,
          },
        });
      });

      it("should edit an item in a list without overriding any parts of it", async () => {
        await wrapper.test[0].foo.bar.set(TestHash);
        await wrapper.test[0].foo.TestHash.set(TestVal);
        await expect(wrapper.test[0]).resolves.toStrictEqual({
          foo: {
            bar: TestHash,
            ...TestHash,
          },
        });
      });

      it("should edit an object tree and generate a tree along the way, without overriding any original parts", async () => {
        await wrapper.test.foo.bar.set(TestHash);
        await wrapper.test.foo.fuzz[0].buzz.set(TestHash);
        await expect(wrapper.test).resolves.toStrictEqual({
          foo: {
            bar: TestHash,
            fuzz: [
              {
                buzz: TestHash,
              },
            ],
          },
        });
      });

      it("should edit an item in a list and generate a tree along the way, without overriding any original parts", async () => {
        await wrapper.test[0].foo.bar.set(TestHash);
        await wrapper.test[0].foo.fuzz[0].buzz.set(TestHash);
        await expect(wrapper.test[0]).resolves.toStrictEqual({
          foo: {
            bar: TestHash,
            fuzz: [
              {
                buzz: TestHash,
              },
            ],
          },
        });
      });
    });

    describe("#has", () => {
      it("should return a function", () => {
        expect(wrapper.foo.has).toBeInstanceOf(Function);
      });

      it("should check if the surface key exists in a hash", async () => {
        await expect(wrapper.test.has("TestHash")).resolves.toBe(false);
        await wrapper.test.set(TestHash);
        await expect(wrapper.test.has("TestHash")).resolves.toBe(true);
      });

      it("should check if the surface key exists in a lisst", async () => {
        await expect(wrapper.test.has(0)).resolves.toBe(false);
        await wrapper.test.set(TestList);
        await expect(wrapper.test.has(0)).resolves.toBe(true);
      });

      it("should check if a deeply nested key exists in a hash", async () => {
        await expect(wrapper.test[0].foo[0].bar.has(0)).resolves.toBe(false);
        await wrapper.test[0].foo[0].bar.set(TestList);
        await expect(wrapper.test[0].foo[0].bar.has(0)).resolves.toBe(true);
      });

      it("should check the existance of the last key if one is not given to the function (hash)", async () => {
        await expect(wrapper.test.TestHash.exists()).resolves.toBe(false);
        await wrapper.test.set(TestHash);
        await expect(wrapper.test.TestHash.exists()).resolves.toBe(true);
      });

      it("should check the existance of the last key if one is not given to the function (list)", async () => {
        await expect(wrapper.test[0].exists()).resolves.toBe(false);
        await wrapper.test.set(TestList);
        await expect(wrapper.test[0].exists()).resolves.toBe(true);
      });

      it("should check the existance of an object directly if only given one key", async () => {
        await expect(wrapper.test.exists()).resolves.toBe(false);
        await wrapper.test.set(TestHash);
        await expect(wrapper.test.exists()).resolves.toBe(true);
      });
    });

    describe("#delete", () => {
      it("should return a function", () => {
        expect(wrapper.foo.delete).toBeInstanceOf(Function);
      });

      it("should delete a surface key in a hash", async () => {
        await wrapper.test.foo.set("bar");
        await wrapper.test.delete("foo");
        await expect(wrapper.test.has("foo")).resolves.toBe(false);
      });

      it("should delete a surface index in a list", async () => {
        await wrapper.test[0].set("bar");
        await wrapper.test.delete(0);
        await expect(wrapper.test.has(0)).resolves.toBe(false);
      });

      it("should delete a deeply nested key in a hash", async () => {
        await wrapper.test.foo.bar.set(TestHash);
        await wrapper.test.foo.bar.delete("TestHash");
        await expect(wrapper.test.foo.has("bar")).resolves.toBe(true);
        await expect(wrapper.test.foo.bar.has("TestHash")).resolves.toBe(false);
      });

      it("should delete a deeply nested index in a list", async () => {
        await wrapper.test[0].foo[0].bar.set(TestList);
        await wrapper.test[0].foo[0].bar.delete(0);
        await expect(wrapper.test[0].foo[0].has("bar")).resolves.toBe(true);
        await expect(wrapper.test[0].foo[0].bar.has(0)).resolves.toBe(false);
      });

      it("should delete the last key if one is not given to the function (hash)", async () => {
        await wrapper.test.foo.bar.set(TestHash);
        await wrapper.test.foo.bar.TestHash.delete();
        await expect(wrapper.test.foo.has("bar")).resolves.toBe(true);
        await expect(wrapper.test.foo.bar.has("TestHash")).resolves.toBe(false);
      });

      it("should delete the last key if one is not given to the function (list)", async () => {
        await wrapper.test[0].foo[0].bar.set(TestList);
        await wrapper.test[0].foo[0].bar[0].delete();
        await expect(wrapper.test[0].foo[0].has("bar")).resolves.toBe(true);
        await expect(wrapper.test[0].foo[0].bar.has(0)).resolves.toBe(false);
      });

      it("should delete the whole object if ran on only one key", async () => {
        await wrapper.test.foo.bar.set(TestHash);
        await wrapper.test.delete();
        await expect(wrapper.has("test")).resolves.toBe(false);
      });

      it("shouldn't care if it tries to delete a non-existant object", async () => {
        await wrapper.test.foo.delete();
      });
    });

    describe("set trap", () => {
      it("should throw an error", () => {
        expect(() => (wrapper.foo.bar = "Some text")).toThrow(
          new Error("ChildWrapper does not support setting (foo = bar)")
        );
      });
    });

    describe("has trap", () => {
      it("should throw an error", () => {
        expect(() => "bar" in wrapper.foo).toThrow(
          new Error(
            'ChildWrapper does not support containment checks ("foo" in bar)'
          )
        );
      });
    });

    describe("delete trap", () => {
      it("should throw an error", () => {
        expect(() => delete wrapper.foo.bar).toThrow(
          new Error("ChildWrapper does not support deletion (delete foo.bar)")
        );
      });
    });
  });
});
