const json = require("./driver/json.js");
const csv  = require("./driver/csv.js" );

module.exports = function(xx) {
  let ret = {};

  // 1. install all the drivers
  json(ret);
  csv (ret);
  return ret;
};
