const assert = require("./port/assert.js");
const util   = require("./port/util.js");

class SeabirdException {
  constructor(msg) {
    this.msg = msg;
  }
};

class SoftException extends SeabirdException {
  constructor(msg) {
    super(msg);
  }
};

class FatalException extends SeabirdException {
  constructor(msg) {
    super(msg);
  }
};

function OnBug(msg,...context) {
  let bug_msg = [ util.format("BUG:%s\nStackTrace:%s\nContext:\n",msg,new Error().stack) ];
  for( const x of context ) {
    bug_msg.push(util.format(x));
  }
  let data = bug_msg.join("");
  console.log(data);
  throw new FatalException(data);
}

module.exports = {
  SeabirdException : SeabirdException ,
  SoftException    : SoftException    ,
  FatalException   : FatalException   ,
  OnBug            : OnBug
};
