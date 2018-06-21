const json = require("./driver/json.js");

module.exports = function(xx) {
  let ret = {};
  ret[json.FactoryName] = new json.FactoryMethod()
  return ret;
};
