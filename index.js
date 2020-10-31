const ChildWrapper = require("./src/ChildWrapper");
const Constants = require("./src/Constants");
const Redite = require("./src/Redite");

function r(options) {
  return new Redite(options);
}

r.Redite = Redite;
r.ChildWrapper = ChildWrapper;
r.Constants = Constants;

module.exports = r;
