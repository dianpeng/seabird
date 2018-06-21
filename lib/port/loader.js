const fs = require("fs");
module.exports = function(xx) { return fs.readFileSync(xx).toString(); };
