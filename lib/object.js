// To simplify the type system of query language, we build a shin type
// layer on top of the Javascript's internal type system. This layer is
// mostly simple and straitforward.
const util   = require("./port/util.js");
const assert = require("./port/assert.js");
const excep  = require("./exception.js");

// Helper functions ---------------------------------------
function IsInheritFrom(a,b) {
  return a instanceof b;
}

function IsHeapType(v) {
  return IsInheritFrom(v,HeapObject);
}

function IsStructureType(v) {
  return IsInheritFrom(v,StructureType);
}

function IsSequence(v) {
  return IsInheritFrom(v,ResultSet) ||
         IsInheritFrom(v,UserObject)||
         v instanceof List;
}

function ToBoolean(v) {
  if(IsInheritFrom(v,ResultSet)) {
    throw TypeMismatch("cannot convert result_set to boolean");
  }
  if(v instanceof Null)         return false;
  if(v instanceof Boolean)      return v.value;
  if(v instanceof Number)       return v.value != 0;
  return true;
}

// Exceptions ---------------------------------------------
class ObjectException extends excep.SoftException {
  constructor(msg) {
    super(util.format("%s\n%s",msg,new Error().stack));
  }
};

class FunctionArgumentNumberMismatch extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class KeyNotFound extends ObjectException {
  constructor(key) {
    super(util.format("key %s not found",key));
  }
};

class KeyExisted extends ObjectException {
  constructor(key) {
    super(util.format("key %s already existed",key));
  }
};

class TypeMismatch extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class MethodNotImplemented extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class SliceOOB extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class OOB extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class NoAttribute extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

class ReadOnly extends ObjectException {
  constructor(msg) {
    super(msg);
  }
};

// Helpers ------------------------------------------------
class ListIteratorWrapper {
  constructor(l) {
    this._list   = l;
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

class EvalInterface {
  constructor(name) { this._name = name; }

  Dot(idx)          { throw new MethodNotImplemented(util.format("%s::Dot",this._name)); }
  Index(id)         { throw new MethodNotImplemented(util.format("%s::Index",this._name)); }
  Slice(a,b,c)      { throw new MethodNotImplemented(util.format("%s::Slice",this._name)); }
  GetAttribute(e,x) { throw new MethodNotImplemented(util.format("%s::GetAttribute",this._name)); }
  GetIterator()     { throw new MethodNotImplemented(util.format("%s::GetIterator",this._name)); }
  GetName    ()     { return this._name; }
};

class Number extends EvalInterface {
  constructor(value) {
    super("Number");
    this.value = value;
  }
};

class Boolean extends EvalInterface {
  constructor(value) {
    super("Boolean");
    this.value = value;
  }
};

class Null extends EvalInterface {
  constructor() {
    super("Null");
  }
};

// HeapObject ---------------------------------------------
// The following object is treated as HeapObject type which supports certain
// meta method and execution engine is aware of the type and dispatch certain
// operation back to the corresponding method in the type

class HeapObject extends EvalInterface {
  constructor(name) { super(name); }
};

// This represents a *script* function. This is helpful when user want the script pass
// a callback into the JS function and invoke it. It will only be produced by script
class Lambda extends HeapObject {
  constructor(code) {
    super("Lambda");
    this.code = code;
  }
};

class String extends HeapObject {
  constructor(value) {
    super("String");
    this.value = value;
  }

  _IndexRaw(x) {
    if(x < this.value.length)
      return this.value.charAt(x);
    throw new OOB(util.format("oob access for String with length:%d and index:%d",this.value.length,x));
  }

  IndexWithNumber(x) {
    return new String(this._IndexRaw(x));
  }

  Index(idx) {
    if(idx instanceof Number) {
      return this.IndexWithNumber(idx.value);
    }
    assert(false);
    throw new TypeMismatch(util.format("expect Number but get type %s",idx.GetName()));
  }

  Slice(start,end,stride) {
    if(start instanceof Number && end instanceof Number && stride instanceof Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) >= eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let buf = [];
      for( ; sidx < eidx ; sidx += stidx ) {
        buf.push(this._IndexRaw(sidx));
      }
      return new String(buf.join(""));
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       start.GetName(),end.GetName(),stride.GetName()));
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

class StructureType extends HeapObject {
  constructor(name) { super(name); }
};

class List extends StructureType {
  constructor() { super("List"); this.list = []; }

  GetSize() { return this.list.length; }
  IsEmpty() { return this.GetSize() == 0; }

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
    throw new TypeMismatch(util.format("expect Number but get type %s",key.GetName()));
  }

  Slice(start,end,stride) {
    if(start instanceof Number && end instanceof Number && stride instanceof Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) >= eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let ret = new List();
      for( ; sidx < eidx ; sidx += stidx ) {
        ret.Push(this.IndexWithNumber(sidx));
      }
      return ret;
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       start.GetName(),end.GetName(),stride.GetName()));
  }

  GetAttribute(x) {
    if(x instanceof String) {
      if(x.value == "size") {
        return new Number(this.GetSize());
      } else if(x.value == "empty") {
        return new Boolean(this.IsEmpty());
      } else if(x.value == "type") {
        return new String(this._name);
      }
    }
    throw new NoAttribute(util.format("no such attribute %s found in type %s",x.name,this._name));
  }

  GetIterator() {
    return new ListIteratorWrapper(this.list);
  }
};

// Result set are special data type that is used internally for the evaluator. The evaluator
// will generate ResultSet on the fly to implement efficient searching and wildcard searching
// semantic. ResultSet is like a list but Evaluator treat it totally differently. User should
// never needs to know whether it is a ResultSet or not. ResultSet works like a list and most
// of time user should never expect a ResultSet in the final result since it will be removed
// automatically by the evaluator.
class ResultSet extends List {
  constructor() { super(); this._name = "ResultSet"; }
};

// This is the iterator for recursive descent result set. This result set is generated when we
// see `**` wildcard searching. It efficiently wraps the node's value without needing to expand
// the whole value tree in memory and this strategy turns out to be really performant w.r.t very
// large input data.
class RecursiveResultSetIterator {
  constructor(obj) {
    this._pending_list = [];
    this._pcursor      =  0;
    this._cur_iterator = null;
    this._init_obj     = obj;
    this._EnqueuePendingList(obj);
    this.HasNext();
  }

  _NextIteratorInQueue() {
    // peek one from the pending list
    while(!this._PendingListEmpty()) {
      let obj = this._DequeuePendingList();
      this._cur_iterator = obj.GetIterator();
      if(this._cur_iterator.HasNext())
        return true;
    }

    this._cur_iterator = undefined;
    // don't have anything
    return false;
  }

  HasNext() {
    if(this._cur_iterator == null) {
      return true;
    } else if(this._cur_iterator.HasNext()) {
      return true;
    } else {
      return this._NextIteratorInQueue();
    }
  }

  Next() {
    if(this._cur_iterator != null)
      this._cur_iterator.Next();
    else {
      this._NextIteratorInQueue();
    }
  }

  GetValue() {
    assert(this._cur_iterator !== undefined);
    if(this._cur_iterator == null) {
      return this._init_obj;
    } else {
      let v = this._cur_iterator.GetValue();
      if(IsStructureType(v) || IsInheritFrom(v,UserObject)) {
        this._EnqueuePendingList(v);
      }
      return v;
    }
  }

  // queue implementation that is simple and stupid
  _DequeuePendingList() {
    assert(!this._PendingListEmpty());
    let v = this._pending_list[this._pcursor];
    ++this._pcursor;
    return v;
  }

  _EnqueuePendingList(v) {
    this._pending_list.push(v);
  }

  _PendingListEmpty() {
    return this._pcursor >= this._pending_list.length;
  }
};

class RecursiveResultSet extends ResultSet {
  constructor(obj) { super(); this.obj = obj; this._name = "ResultSet"; }

  GetSize() {
    let cnt = 0;
    for( let itr = GetIterator(); itr.HasNext(); itr.Next() ) {
      ++cnt;
    }
    return cn;
  }

  IsEmpty() {
    return !GetIterator().HasNext();
  }

  IndexWithNumber(idx) {
    let i = 0;
    for( let itr = this.GetIterator(); itr.HasNext(); itr.Next() ) {
      if(i == idx) {
        return itr.GetValue();
      }
      ++i;
    }
    throw new OOB(util.format("oob access for RecursiveResultSet with index %d",idx));
  }

  Index(idx) {
    if(idx instanceof Number) {
      return this.IndexWithNumber(idx.value);
    }
    throw new TypeMismatch(util.format("expect Number but get %s",idx.GetName()));
  }

  Slice(start,end,stride) {
    if(start instanceof Number && end instanceof Number && stride instanceof Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) >= eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let ret = new List(); // return a normal set which is cheaper to use since user asks for an
                            // expansion here the cost is already high so assume user is aware of
                            // what he/she is doing. Plus RS is not mutable
      let i = sidx;
      for( let itr = GetIterator(); itr.HasNext(); itr.Next() ) {
        if(sidx + stidx) break;
        if(i >= sidx + stidx) {
          sidx += stidx;
          ret.Push(itr.GetValue());
        }
        ++i;
      }
      return ret;
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       start.GetName(),end.GetName(),stride.GetName()));
  }

  GetIterator() { return new RecursiveResultSetIterator(this.obj); }
};

class Pair extends StructureType {
  constructor(key,value) {
    super("Pair");
    assert( key instanceof String );

    this.key   = key;
    this.value = value;
  }

  Index(idx) {
    if(idx instanceof Number) {
      if(idx.value == 0) return this.key;
      if(idx.value == 1) return this.value;
      throw new OOB(util.format("oob access for Pair , only 0 or 1 index is allowed but get %d",idx.value));
    }
    throw new TypeMismatch(util.format("expect Number but get type %s",idx.GetName()));
  }
  GetAttribute(x) {
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
    throw new NoAttribute(util.format("no such attribute %s found in type Pair",x.name));
  }

  GetIterator() {
    return new PairIterator(this.key,this.value);
  }
};

class Dict extends StructureType {
  constructor() {
    super("Dict");

    // index array , map string --> index
    this.index = {};
    this.list  = [];
  }

  AddPair(p) {
    assert( p instanceof Pair );
    if(p.key.value in this.index) {
      throw new KeyExisted(p.key.value);
    }
    this.list.push(p);
    this.index[p.key.value] = this.list.length - 1;
  }

  Add(key,value) {
    if(key instanceof String) {
      if(key.value in this.index) {
        throw new KeyExisted(key.value);
      }
      this.list.push(new Pair(key,value));
      this.index[key.value] = this.list.length - 1;
    } else {
      throw new TypeMismatch(util.format("expect String but get %s",key.GetName()));
    }
  }

  Has(key) {
    if(key instanceof String) {
      return key.value in this.index;
    } else {
      throw new TypeMismatch(util.format("expect String but get %s",key.GetName()));
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
      throw new TypeMismatch(util.format("expect String but get %s",key.GetName()));
    }
  }

  GetValue(key) {
    let pair = this.Get(key);
    return pair.value;
  }

  // Common HeapObject operators/interface -------------------------------
  Index(idx) {
    return this.GetValue(idx);
  }

  Dot(idx) {
    return this.GetValue(idx);
  }

  GetAttribute(idx) {
    if(idx instanceof String) {
      if(idx.value == "size" ) return new Number (this.list.length);
      if(idx.value == "empty") return new Boolean(this.list.length == 0);
      if(idx.value == "type" ) return new String ("Dict");

      throw new NoAttribute(util.format("no such attribute %s found in type Dict",idx.value));
    }
    throw new TypeMismatch(util.format("expect String but get %s",idx.GetName()));
  }

  GetIterator() {
    return new ListIteratorWrapper(this.list);
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
  Mod(x) { throw new MethodNotImplemented("UserObject::Mod"); }

  Gt (x) { throw new MethodNotImplemented("UserObject::Gt" ); }
  Ge (x) { throw new MethodNotImplemented("UserObject::Ge" ); }
  Lt (x) { throw new MethodNotImplemented("UserObject::Lt" ); }
  Le (x) { throw new MethodNotImplemented("UserObject::Le" ); }
  Eq (x) { throw new MethodNotImplemented("UserObject::Eq" ); }
  Ne (x) { throw new MethodNotImplemented("UserObject::Ne" ); }

  Negate ()      { throw new MethodNotImplemented("UserObject::Negate"); }
  Not    ()      { throw new MethodNotImplemented("UserObject::Not"   ); }
  Invoke (ctx,x) { throw new MethodNotImplemented("UserObject::Invoke"); }
  Print  (l)     { throw new MethodNotImplemented("UserObject::Print" ); }

  constructor(name) { super(name); }
};

module.exports = {
  ObjectException    : ObjectException ,
  KeyNotFound        : KeyNotFound     ,
  KeyExisted         : KeyExisted ,
  TypeMismatch       : TypeMismatch,
  MethodNotImplemented : MethodNotImplemented,
  SliceOOB : SliceOOB,
  OOB : OOB,
  NoAttribute : NoAttribute,
  ReadOnly : ReadOnly,
  FunctionArgumentNumberMismatch : FunctionArgumentNumberMismatch,
  Number             : Number,
  Boolean            : Boolean,
  String             : String,
  Null               : Null ,
  Lambda             : Lambda,
  List               : List ,
  ResultSet          : ResultSet,
  RecursiveResultSet : RecursiveResultSet ,
  Dict               : Dict ,
  Pair               : Pair ,
  HeapObject         : HeapObject ,
  UserObject         : UserObject ,
  IsHeapType         : IsHeapType ,
  IsStructureType    : IsStructureType,
  IsInheritFrom      : IsInheritFrom,
  IsSequence         : IsSequence,
  ToBoolean          : ToBoolean
};
