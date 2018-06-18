// To simplify the type system of query language, we build a shin type
// layer on top of the Javascript's internal type system. This layer is
// mostly simple and straitforward.
const util = require("util");

// Exceptions ---------------------------------------------
class KeyNotFound {
  constructor(key) {
    this.msg = util.format("key %s not found",key);
  }
};

class KeyExisted {
  constructor(msg) {
    this.msg = util.format("key %s already existed",key);
  }
};

class TypeMismatch {
  constructor(msg) {
    this.msg = msg;
  }
};

// Types --------------------------------------------------
class String {
  constructor(value) {
    this.value = value;
  }
};

class Number {
  constructor(value) {
    this.value = value;
  }
};

class Boolean {
  constructor(value) {
    this.value = value;
  }
};

class Null {};

class List {
  constructor() {
    this.list = list;
  }

  Push(x) { this.list.push(x); }
};

class Pair {
  constructor(key,value) {
    this.key   = key;
    this.value = value;
  }
};

class Dict {
  constructor() {
    // index array , map string --> index
    this.index = {};
    this.list  = [];
  }

  Add(key,value) {
    if(key instanceof String) {
      if(key.value in this.index) {
        throw new KeyExisted(key.value);
      }
      this.list.push(new Pair(key,value));
      this.index[key] = this.list.length - 1;
    } else {
      throw new TypeMistmach("expect String but get %s",typeof key);
    }
  }

  Has(key) {
    if(key instanceof String) {
      return key.value in this.index;
    } else {
      throw new TypeMistmach("expect String but get %s",typeof key);
    }
  }

  Get(key) {
    if(key instanceof String) {
      if(key.value in this.index) {
        return this.list[this.index[key.value]];
      } else {
        throw new KeyNotFound(key.value);
      }
    } else {
      throw new TypeMistmach("expect String but get %s",typeof key);
    }
  }
};

