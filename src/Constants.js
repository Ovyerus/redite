const MutatingMethods = [
  "push",
  "remove",
  "removeIndex",
  "pop",
  "shift",
  "unshift",
];
const NonMutatingMethods = [
  "concat",
  "find",
  "findIndex",
  "includes",
  "indexOf",
  "lastIndexOf",
  "map",
  "length",
  "filter",
  "join",
  "forEach",
];
const SupportedArrayMethods = MutatingMethods.concat(NonMutatingMethods);

module.exports = {
  MutatingMethods,
  NonMutatingMethods,
  SupportedArrayMethods,
};
