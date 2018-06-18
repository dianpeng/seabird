// Implement the actual logic by walking the AST
// There's no point to implement a fancier bytecode based VM since the query is small, the
// time you spent should be in the underlying logic that performs the query semantic.

const assert= require("assert");

const ast   = require("./ast.js");
const parse = require("./parser.js");
const obj   = require("./object.js");

class Stack {
  constructor() {
    this.list = [];
  }

  Push(x) {
    this.list.push(x);
  }

  Pop() {
    this.list.pop();
  }

  Top() {
    return this.list[this.list.length-1];
  }
};

class Iterator {
};

function IsInheritFrom(a,b) {
  return a.prototype instanceof b;
}

class EvalException {
  constructor(msg) {
    this.msg = msg;
  }
};

class Eval {
  constructor() {
    this.vmap = {};
    this.frame= [];
    this.this_stack = new Stack();
  }

  _Error(pos,msg) {
    // TODO:: Add runtime trace
    throw new EvalException(msg);
  }

  _IsHeapType(v) {
    return v instanceof obj.List   ||
           v instanceof obj.Dict   ||
           v instanceof obj.String ||
           v instanceof Obj.Pair   ||
           IsInheritFrom(v,obj.UserData);
  }

  _Apply(v,what) {
    if(v IsInheritFrom(v,Iterator) {
      for(v.HasNext()) {
        what(v.GetValue());
        v.Next();
      }
    }
  }

  // evaluate expression
  _EvalList(x) {
    let ret = new obj.List();
    for( const ele of x.list ) {
      ret.Push(this._EvalExpr(ele));
    }
    return ret;
  }

  _EvalPair(x) {
    return new ast.Pair( this._EvalExpr(x.key) , this._EvalExpr(x.value) );
  }

  _EvalDict(x) {
    let ret = new obj.Dict();
    for( const ele of x.dict ) {
      let key = this._EvalExpr(ele.key);
      let val = this._EvalExpr(ele.value);
      try {
        ret.Add(key,val);
      } catch(e) {
        this._Error(x.position,util.format("cannot add key/value pair into dict due to error %s",e.msg));
      }
    }
    return ret;
  }

  _EvalNumber(x)  { return new obj.Number(x.value); }
  _EvalBoolean(x) { return new obj.Boolean(x.value); }
  _EvalString(x)  { return new obj.String(x.value); }
  _EvalNull(x)    { return new obj.Null(); }
  _EvalThis(x)    { return this.list_stack.Top(); }
  _EvalDollar(x)  { return this.dollar; }

  _EvalVariable(x) {
    if(x.name in this.vmap) {
      return this.vmap[x.name];
    }
    this._Error(x.position,util.format("variable %s doesn't exist",x.name));
  }

  _EvalAttribute(x) {
    let this_ptr = this._This();
    if(this._IsHeapType(this_ptr)) {
      return this_ptr.GetAttribute(x.name);
    }
    this._Error(x.position,util.format("object type %s doesn't have attribute %s",typeof this_ptr,x.name));
  }

  _EvalSlice(x) {
    let start = this._EvalExpr(x.start);
    if(x.end == null) {
      let this_ptr = this._This();
      // normal indexing , dispatch indexing operations
      if(this._IsHeapType(this_ptr)) {
        return this_ptr.GetIndex(x);
      }
      this._Error(x.position,util.format("object type %s doesn't support index",typeof this_ptr));
    } else {
    }
  }
};
