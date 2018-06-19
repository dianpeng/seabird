// To simplify the type system of query language, we build a shin type
// layer on top of the Javascript's internal type system. This layer is
// mostly simple and straitforward.
const util   = require("util");
const assert = require("assert");

// Exceptions ---------------------------------------------
class KeyNotFound {
  constructor(key) {
    this.msg = util.format("key %s not found",key);
  }
};

class KeyExisted {
  constructor(key) {
    this.msg = util.format("key %s already existed",key);
  }
};

class TypeMismatch {
  constructor(msg) {
    this.msg = msg;
  }
};

class MethodNotImplemented {
  constructor(msg) {
    this.msg = msg;
  }
};

class SliceOOB {
  constructor(msg) {
    this.msg = msg;
  }
};

class OOB {
  constructor(msg) {
    this.msg = msg;
  }
};

class NoAttribute {
  constructor(msg) {
    this.msg = msg;
  }
};

// Helpers ------------------------------------------------
class ListIteratorWrapper {
  constructor(l) {
    this._list = list;
    this._cursor = 0;
  }

  HasNext()  { return this._cursor < this._list.length; }
  Next   ()  { ++this._cursor; }
  GetValue() { assert(this.HasNext()); return this._list[this._cursor]; }
};

class StringIterator {
  constructor(s) {
    this._str = s;
    this._cursor = 0;
  }

  HasNext () { return this._cursor < this._str.length; }
  Next    () { ++this._cursor; }
  GetValue() { return new String(this._str.charAt(this._cursor)); }
};

class PairIterator {
  constructor(k,v) {
    this._key = k;
    this._val = v;
    this._cursor = 0;
  }

  HasNext() { return this._cursor < 2; }
  Next   () { ++this._cursor; }
  GetValue(){ if(this._cursor == 0) return this._key; else return this._val; }
};


// Types --------------------------------------------------
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

// HeapObject ---------------------------------------------
// The following object is treated as HeapObject type which supports certain
// meta method and execution engine is aware of the type and dispatch certain
// operation back to the corresponding method in the type

class HeapObject {
  constructor(name) { this._name = name; }

  Dot(idx)          { throw new MethodNotImplemented(util.format("%s::Dot",this._name)); }
  Index(id)         { throw new MethodNotImplemented(util.format("%s::Index",this._name)); }
  Slice(a,b,c)      { throw new MethodNotImplemented(util.format("%s::Slice",this._name)); }
  GetAttribute(e,x) { throw new MethodNotImplemented(util.format("%s::GetAttribute",this._name)); }
  GetIterator()     { throw new MethodNotImplemented(util.format("%s::GetIterator",this._name)); }
};

class String extends HeapObject {
  constructor(value) {
    super("String");
    this.value = value;
  }

  IndexWithNumber(x) {
    if(x < this.value.length)
      return new String(this.value.charAt(x));
    throw new OOB(util.format("oob access for String with length:%d and index:%d",this.value.length,x));
  }

  Index(idx) {
    if(idx instanceof Number) {
      this.IndexWithNumber(idx.value);
    }
    throw new TypeMismatch("expect number but get type %s",typeof key);
  }
  Slice(start,end,stride) {
    if(start instanceof Number && end instanceof Number && stride instanceof Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) < eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let buf = [];
      for( ; sidx < eidx ; sidx += stidx ) {
        buf.push(this.IndexWithNumber(sidx));
      }
      return new String(buf.join(""));
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       typeof start,typeof end,typeof stride));
  }

  GetAttribute(x) {
    if(x instanceof String) {
      if(x.value == "size") {
        return new Number(this.value.length);
      } else if(x.value == "empty") {
        return new Boolean(this.value.length == 0);
      }
    }
    throw new NoAttribute(util.format("no such attribute %s found in type String",x.name));
  }

  GetIterator() {
    return new StringIterator(this.value);
  }
};

class List extends HeapObject {
  constructor() { super("List"); this.list = []; }
  Push(x) { this.list.push(x); }
  IndexWithNumber(x) {
    if(x < this.list.length)
      return this.list[x];
    throw new OOB(util.format("oob access for List with length:%d and index:%d",this.list.length,x));
  }
  Index(idx) {
    if(idx instanceof Number) {
      return this.IndexWithNumber(idx.value);
    }
    throw new TypeMismatch(util.format("expect Number but get type %s",typeof key));
  }
  Slice(start,end,stride) {
    if(start instanceof Number && end instanceof Number && stride instanceof Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) < eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let ret = new List();
      for( ; sidx < eidx ; sidx += stidx ) {
        ret.push(this.IndexWithNumber(sidx));
      }
      return ret;
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       typeof start,typeof end,typeof stride));
  }

  GetAttribute(x) {
    if(x instanceof String) {
      if(x.value == "size") {
        return new Number(this.list.length);
      } else if(x.value == "empty") {
        return new Boolean(this.list.length == 0);
      } else if(x.value == "type") {
        return new String("List");
      }
    }
    throw new NoAttribute(util.format("no such attribute %s found in type List",x.name));
  }

  GetIterator() {
    return new ListIteratorWrapper(this.list);
  }
};

class Pair extends HeapObject {
  constructor(key,value) {
    super("Pair");

    this.key   = key;
    this.value = value;
  }

  Index(idx) {
    if(idx instanceof Number) {
      if(idx.value == 0) return this.key;
      if(idx.value == 1) return this.value;
      throw new OOB(util.format("oob access for Pair , only 0 or 1 index is allowed but get %d",idx.value));
    }
    throw new TypeMismatch(util.format("expect Number but get type %s",typeof idx));
  }
  GetAttribute(s) {
    if(x instanceof String) {
      if(x.value == "size") {
        return new Number(2);
      } else if(x.value == "type") {
        return new String("Pair");
      } else if(x.value == "key") {
        return this.key;
      } else if(x.value == "value") {
        return this.value;
      }
    }
    throw new NoAttribute(util.format("no such attribut %s found in type Pair",x.name));
  }

  Dot(x) {
    if(x instanceof String) {
      if(x.value == "key") {
        return this.key;
      } else if(x.value == "value") {
        return this.value;
      }
    }
    throw new KeyNotFound(x.value);
  }

  GetIterator() {
    return new PairIterator(this.key,this.value);
  }
};

class Dict extends HeapObject {
  constructor() {
    super("Dict");

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

// UserObject ------------------------------------------------------------
// This object is the interface provided for user to extend the query
// tree. In the old C++ implementaion, we have strong type system so
// we can have easy and debuggable interfaces for extending purpose. But
// currently in Javascript, due to the dynamic type this becomes not that
// explicit. The way that I do it is by using tagged class. Internally inside
// of the evaluation engine, we distinguish type by instanceof keyword, so
// if we know a type that is inherited from UserObject then we will do the
// dispatch and this makes the engine a little bit static , which is what I
// really want here.

class UserObject extends HeapObject {
  Add(x) { throw new MethodNotImplemented("UserObject::Add"); }
  Sub(x) { throw new MethodNotImplemented("UserObject::Sub"); }
  Mul(x) { throw new MethodNotImplemented("UserObject::Mul"); }
  Div(x) { throw new MethodNotImplemented("UserObject::Div"); }

  Gt (x) { throw new MethodNotImplemented("UserObject::Gt" ); }
  Ge (x) { throw new MethodNotImplemented("UserObject::Ge" ); }
  Lt (x) { throw new MethodNotImplemented("UserObject::Lt" ); }
  Le (x) { throw new MethodNotImplemented("UserObject::Le" ); }
  Eq (x) { throw new MethodNotImplemented("UserObject::Eq" ); }
  Ne (x) { throw new MethodNotImplemented("UserObject::Ne" ); }

  Negate () { throw new MethodNotImplemented("UserObject::Negate"); }
  Not    () { throw new MethodNotImplemented("UserObject::Not"   ); }

  Invoke (ctx,x)      { throw new MethodNotImplemented("UserObject::Invoke"); }

  TypeName() { return "UserObject" }
};

module.exports = {
  Number : Number,
  Boolean: Boolean,
  String : String,
  Null   : Null ,
  List   : List ,
  Dict   : Dict ,
  Pair   : Pair ,
  HeapObject : HeapObject ,
  UserObject : UserObject
};
