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

module.exports = {
  SeabirdException : SeabirdException ,
  SoftException    : SoftException    ,
  FatalException   : FatalException
};
