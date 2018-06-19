// Implement the actual logic by walking the AST
// There's no point to implement a fancier bytecode based VM since the query is small, the
// time you spent should be in the underlying logic that performs the query semantic.

const assert= require("assert");
const util  = require("util");

const lexer = require("./lexer.js");
const ast   = require("./ast.js");
const parse = require("./parser.js");
const obj   = require("./object.js");

//  Helper class and functions
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

  SetTop(v) {
    this.list[this.list.length-1] = v;
  }

  GetSize() { return this.list.length; }
};

function IsInheritFrom(a,b) {
  return a instanceof b;
}

function IsHeapType(v) {
  return IsInheritFrom(v,obj.HeapObject);
}

// Tag class
class ResultSet {};

class NormalResultSetIterator {
  constructor(l)   { this._list = l; this._cursor = 0; }
  HasNext    ()    { return this._cursor < this._list.length; }
  Next       ()    { ++this._cursor; }
  GetValue   ()    { return this._list[this._cursor]; }
};

class NormalResultSet extends ResultSet {
  static NewListResultSet( list ) { this.list = list; }
  constructor()    { this.list = []; }
  Add(v)           { this.list.push(v); }
  GetIterator()    { return new ResultSetIterator(this.list); }
};


// A iterator wraper that generates recursive descent results
class RecursiveResultSetIterator {
  constructor(obj) {
    this._pending_list = [];
    this._pcursor      =  0;
    this._cur_iterator = null;

    this._EnqueuePendingList(obj);
    this.HasNext();
  }

  HasNext() {
    if(this._cur_iterator != null && this._cur_iterator.HasNext()) {
      return true;
    } else {
      // peek one from the pending list
      do {
        let obj = this._DequeuePendingList();
        this._cur_iterator = this._NewIterator(obj);
        if(this._cur_iterator.HasNext())
          return true;
      } while(!this._PendingListEmpty());

      this._cur_iterator = null;
      // don't have anything
      return false;
    }
  }

  Next() {
    this._cur_iterator.Next();
  }

  GetValue() {
    let v = this._cur_iterator.GetValue();
    if(IsHeapType(v)) {
      this._EnqueuePendingList(v);
    }
    return v;
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
    return this._pcursor == this._pending_list.length;
  }

  _NewIterator(v) {
    return v.GetIterator();
  }
};

class RecursiveResultSet extends ResultSet {
  constructor(obj) { this.obj = obj; }
  GetIterator() { return new RecursiveResultSetIterator(this.obj); }
};

class FatalException {
  constructor(msg) {
    this.msg = msg;
  }
};

class SoftException {
  constructor(msg) {
    this.msg = msg;
  }
};

// Function that is written inside of the script
class Func {
  constructor(code) {
    this.code = code;
  }
};

class Frame {
  constructor(narg,desp) {
    this.narg        = narg;
    this.description = desp;
    this.argument    = {};
  }
};

// The evaluation is using a context value called *this* to progressing , the *this* value can
// be referenced via keyword "this".
// The context value *this* is automatically updated by *prefix* expression.
class Eval {
  constructor(map) {
    this.vmap = map;
    this.frame= [];
    this.this_stack = new Stack();
    this.show_error_trace = false;
  }

  // Error handling
  _PopulateExceptionMessage(pos,msg) {
    let stk = [];
    for( let j = 0 , i = this.frame.length - 1; i>=0 ; --i , ++j ) {
      let f = this.frame[i];
      stk.push(util.format("%d.<func:%d>:%s",j,f.narg,f.description));
    }
    let jsstk = "";
    if(this.show_error_trace)
      jsstk = new Error().stack;


    return util.format("around `%s` evaluation error occur: %s\n%s\n%s",
                       pos.GetCodeSnippet(),
                       msg,
                       stk.join("\n"),
                       jsstk);
  }

  _Fatal(pos,msg) {
    throw new FatalException(this._PopulateExceptionMessage(pos,msg));
  }

  _Error(pos,msg) {
    throw new SoftException(this._PopulateExceptionMessage(pos,msg));
  }

  _TypeOf(node) {
    if(IsInheritFrom(node,ResultSet)) {
      return "result-set";
    } else if(node instanceof Func) {
      return "script-function";
    } else if(IsInheritFrom(node,obj.UserObject)) {
      return node.TypeName();
    } else {
      return typeof node;
    }
  }

  // This context value handling
  _PushThis() {
    let old_this = this._This();
    this.this_stack.Push(old_this);
  }

  _PushAndSetThis(v) {
    this.this_stack.Push(v);
  }

  _PopThis() {
    this.this_stack.Pop();
  }

  _SetThis(v) {
    this.this_stack.SetTop(v);
    return v;
  }

  _This() {
    return this.this_stack.Top();
  }

  _IsHeapTypeOrResultSet(v) {
    return IsHeapType(v) || IsInheritFrom(v,ResultSet);
  }

  _Frame() {
    return this.frame[this.frame.length-1];
  }

  // This is a little bit optimization since the core evaluation type is a ResultSet
  // which is a list of results but the issue is that most of the time we don't have
  // more than one element inside of the ResultSet so it is a huge memory waste in
  // Javascript. Instead of using ResultSet we will only use ResultSet accordingly
  // so we end up using a callback style solution to solve it. The _Apply function
  // will check the input node's type to see whether it is a ResultSet or not, if it
  // is a ResultSet, then just do a for loop and generate a result set ; otherwise
  // directly call the node itself.
  _Apply(v,what) {
    if(IsInheritFrom(v,ResultSet)) {
      let output = new ResultSet();

      for( let itr = v.GetIterator(); v.HasNext(); v.Next() ) {
        let e = itr.GetValue();
        try {
          output.Add(what(e));
        } catch(e) {
          // this is a search semantic, so filter out the SoftException
          if (e instanceof FatalException)
            throw e;

          // skip this entry and then go on
          continue;
        }
      }
      return output;
    } else {
      return what(v);
    }
  }

  // RAII helper function to perform this pointer restore and popsup
  _ThisScope(cb) {
    this._PushThis();
    try {
      cb();
      let x = this._This();
      return x;
    } catch(e) {
      console.log(e);
      throw e;
    } finally {
      this._PopThis();
    }
  }

  _ThisScopeWithContext(cb,ctx) {
    this._PushAndSetThis(ctx);
    try {
      cb();
      let x = this._This();
      return x;
    } catch(e) {
      throw e;
    } finally {
      this._PopThis();
    }
  }

  // cast/conversion
  _ToBoolean(pos,v) {
    if(IsInheritFrom(v,ResultSet)) {
      this._Fatal(pos,"result set cannot be converted to boolean");
    }
    if(v instanceof obj.Null)         return false;
    if(v instanceof obj.Boolean)      return v.value;
    return true;
  }

  // evaluate expression
  _EvalList(x) {
    let ret = new obj.List();
    for( const ele of x.list ) {
      ret.Push(this._EvalExpr(ele));
    }
    return this._SetThis(ret);
  }

  _EvalPair(x) {
    return this._SetThis(new ast.Pair( this._EvalExpr(x.key) , this._EvalExpr(x.value) ));
  }

  _EvalDict(x) {
    let ret = new obj.Dict();
    for( const ele of x.dict ) {
      let key = this._EvalExpr(ele.key);
      let val = this._EvalExpr(ele.value);
      try {
        ret.Add(key,val);
      } catch(e) {
        this._Fatal(x.position,util.format("cannot add key/value pair into dict due to error %s",e.msg));
      }
    }
    return this._SetThis(ret);
  }

  _EvalNumber (x) { return this._SetThis(new obj.Number(x.value)); }
  _EvalBoolean(x) { return this._SetThis(new obj.Boolean(x.value));}
  _EvalString (x) { return this._SetThis(obj.String(x.value)); }
  _EvalNull   (x) { return this._SetThis(obj.Null()); }
  _EvalThis   (x) { return this._SetThis(this.list_stack.Top()); }
  _EvalDollar (x) { return this._SetThis(this.dollar); }

  _EvalVariable(x) {
    if(x.name in this.vmap) {
      return this._SetThis(this.vmap[x.name]);
    } else if(x.name in this._Frame().argument) {
      return this._SetThis(this._Frame().argument[x.name]);
    }
    this._Fatal(x.position,util.format("variable %s doesn't exist",x.name));
  }

  _EvalThis(x) {
    return this._This();
  }

  _EvalAttribute(x) {
    let this_ptr = this._This();
    if(IsHeapType(this_ptr)) {
      return this._SetThis(this._Apply(this_ptr,(n) => { return n.GetAttribute(new obj.String(x.name)); }));
    }
    this._Error(x.position,util.format("object type %s doesn't have attribute %s",this._TypeOf(this_ptr),x.name));
  }

  _EvalIndex(x) {
    let slice = x.value;
    let start = this._EvalExpr(slice.start);
    if(x.end == null) {
      let this_ptr = this._This();
      // normal indexing , dispatch indexing operations
      if(this._IsHeapTypeOrResultSet(this_ptr)) {
        return this._SetThis((this._Apply(this_ptr,(n) => { return n.Index(start); })));
      }
      this._Error(x.position,util.format("object type %s doesn't support index",this._TypeOf(this_ptr)));
    } else {
      let end    = this._EvalExpr(slice.end);
      let stride = this._EvalExpr(slice.stride);
      if(this._IsHeapTypeOrResultSet(this_ptr)) {
        return this._SetThis(this._Apply(this_ptr,(n) => { return n.Slice(start,end,stride); }));
      }
      this._Error(x.position,util.format("object type %s doesn't support slice index",this._TypeOf(this_ptr)));
    }
  }

  _EvalForeach(x) {
    let this_ptr = this._This();
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      // expand the type into ResultSet
      if(IsInheritFrom(this_ptr,obj.UserObject)) {
        // user object
        return this._SetThis(this_ptr);
      } else {
        // construct a *ResultSet* based on iterator returned
        let itr = this_ptr.GetIterator();
        let buf = new NormalResultSet();
        for( ; itr.HasNext(); itr.Next() ) {
          buf.Add(itr.GetValue());
        }
        return this._SetThis(buf);
      }
    }
    this._Error(x.position,util.format("object type %s doesn't support \"*\" (foreach) semantic",this._TypeOf(this_ptr)));
  }

  _EvalWildcard(x) {
    let this_ptr = this._This();
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      return this._SetThis(new RecursiveResultSet(this_ptr));
    }
    this._Error(x.position,util.format("object type %s doesn't support \"**\" (wildcard) semantic",this._TypeOf(this_ptr)));
  }

  _EvalDot(x) {
    let this_ptr = this._This();
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      let comp = x.value;
      if(comp instanceof ast.Variable) {
        return this._SetThis(this._Apply(this_ptr,(n) => { return n.Dot(new obj.String(x.name)); }));
      } else if(comp instanceof ast.Foreach) {
        return this._EvalForeach(comp);
      } else if(comp instanceof ast.Wildcard) {
        return this._EvalWildcard(comp);
      } else {
        assert(false);
      }
    }
    this._Error(x.position,util.format("object type %s doesn't support \".\" operator",this._TypeOf(this_ptr)));
  }

  _EvalPredicate(x) {
    let this_ptr   = this._This();
    let predicator = x.value; // expression for predicator
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      return this._SetThis(this._Apply(this_ptr,
        (n) => {
          let v = this._EvalExprWithContext(predicator,n);
          if(this._ToBoolean(x.position,v))
            return n;
        })
      );
    }
    this._Error(x.position,util.format("object type %s doesn't support \"[?\" operator",this._TypeOf(this_ptr)));
  }

  _EvalRewrite(x) {
    let this_ptr   = this._This();
    let rewrite    = x.value;
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      return this._SetThis(this._Apply(this_ptr,
        (n) => {
          let v = (this._EvalExprWithContext(rewrite,n));
          return v;
        })
      );
    }
    this._Error(x.position,util.format("object type %s doesn't support \"[|\" operator",this._TypeOf(this_ptr)));
  }

  _EvalCall(x) {
    if(this.frame.length >= Eval.MaxFrameSize) {
      this._Fatal(x.position,util.format("call stack overflow,recursive call more than %d",Eval.MaxFrameSize));
    }

    let this_ptr = this._This();
    if(this_ptr instanceof Func) {
      if(x.argument.length != this_ptr.code.argument.length) {
        this._Fatal(x.position,
                    util.format("cannot call function around code snippet %s with argument number %d",
                    this_ptr.code.position.GetCodeSnippet(),x.argument.length));
      }
      let idx = 0;
      let frame = new Frame(x.argument.length,util.format("script-function(%s)",
                                                          this_ptr.code.position.GetCodeSnippet()));
      for( const a of x.argument) {
        frame.argument[this_Ptr.code.argument[idx]] = this._EvalExpr(a);
        idx++;
      }
      // push the new frame
      this.frame.push(frame);
      // now evaluate the freaking function
      let result = this._SetThis(this._EvalExpr(this_ptr.code.body));
      // pop the frame
      this.frame.pop();

      return result;
    } else if(IsInheritFrom(this_ptr,obj.UserObject)) {
      let arg = [];
      for( const a of x.argument ) {
        arg.push(a);
      }
      this.frame.push(new Frame(x.argument.length,util.format("js-function(%s)",typeof this_ptr)));
      let result = this._SetThis(this_ptr.Invoke(this,arg));
      this.frame.pop();
      return result;
    }

    this._Fatal(x.position,util.format("cannot call function on type %s",this._TypeOf(this_ptr)));
  }

  _EvalPrefixComponent(x) {
    switch(x.type) {
      case ast.PrefixComponent.Index:     return this._EvalIndex(x);
      case ast.PrefixComponent.Call:      return this._EvalCall(x);
      case ast.PrefixComponent.Dot:       return this._EvalDot(x);
      case ast.PrefixComponent.Predicate: return this._EvalPredicate(x);
      case ast.PrefixComponent.Rewrite:   return this._EvalRewrite(x);
      default: assert(false); return null;
    }
  }

  _EvalPrefix(x) {
    this._EvalAst(x.first);
    for( const v of x.rest ) {
      this._EvalPrefixComponent(v);
    }
  }

  _EvalUnary(x) {
    let opr = x.oprand;
    let val = this._EvalExpr(opr);
    if(x.op == lexer.Token.Sub) {
      // negate the `val` value
      if(val instanceof obj.Number) {
        return this._SetThis(new obj.Number(-val.value));
      } else if(IsInheritFrom(val,obj.UserObject)) {
        return this._SetThis(val.Negate());
      }
      this._Error(x.position,util.format("object type %s doesn't support negate operator",this._TypeOf(this_ptr)));
    } else {
      if(IsInheritFrom(val,obj.UserObject)) {
        return this._SetThis(val.Not());
      } else {
        let bval = this._ToBoolean(x.position,val);
        return this._SetThis(new ast.Boolean(!bval));
      }
    }
  }

  _IsBothNumber(lhs,rhs) {
    return lhs instanceof obj.Number && rhs instanceof obj.Number;
  }

  _ApplyArithmeticOp(pos,lhs,rhs,num_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return this._SetThis(new obj.Number(num_op(lhs.value,rhs.value)));
    } else if(IsInheritFrom(lhs,obj.UserObject)) {
      return this._SetThis(obj_op(lhs,rhs));
    } else {
      this._Fatal(pos,util.format("cannot apply operator %s on type lhs:%s , rhs:%s",
                                  op,this._TypeOf(lhs),this._TypeOf(rhs)));
    }
  }

  _ApplyComparisonOp(pos,lhs,rhs,prim_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return this._SetThis(new obj.Boolean(prim_op(lhs.value,rhs.value)));
    } else if(lhs instanceof obj.String || rhs instanceof obj.String) {
      let lhs = this._ToString(lhs);
      let rhs = this._ToString(rhs);
      return this._SetThis(prim_op(lhs,rhs));
    } else if(IsInheritFrom(lhs,obj.UserObject)) {
      return this._SetThis(obj_op(lhs,rhs));
    } else {
      this._Fatal(pos,util.format("cannot apply operator %s on type lhs:%s , rhs:%s",
                                  op,this._TypeOf(lhs),this._TypeOf(rhs)));
    }
  }

  _EvalBinary(x) {
    if(x.op != lexer.Token.And && x.op != lexer.Token.Or) {
      let lhs = this._EvalExpr(x.lhs);
      let rhs = this._EvalExpr(x.rhs);
      switch(x.op) {
        // arithmetic
        case lexer.Token.Add:
          this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l+r; },
                                                     (l,r) => { return l.Add(r); },"+");
          break;
        case lexer.Token.Sub:
          this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l-r; },
                                                     (l,r) => { return l.Sub(r); },"-");
          break;
        case lexer.Token.Mul:
          this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l*r; },
                                                     (l,r) => { return l.Mul(r); },"*");
          break;
        case lexer.Token.Div:
          this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { if(r == 0) this._Fatal(x.position,"div by 0"); return l/r; },
                                                     (l,r) => { return l.Div(r); },"/");
          break;
        // comparison
        case lexer.Token.Lt:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l < r; },
                                                     (l,r) => { return l.Lt(r); },"<");
          break;
        case lexer.Token.Le:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l <= r; },
                                                     (l,r) => { return l.Lt(r); },"<=");
          break;
        case lexer.Token.Gt:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l > r; },
                                                     (l,r) => { return l.Gt(r); },">");
          break;
        case lexer.Token.Ge:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l >= r; },
                                                     (l,r) => { return l.Ge(r); },">=");
          break;
        case lexer.Token.Eq:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l == r; },
                                                     (l,r) => { return l.Eq(r); },"==");
          break;
        case lexer.Token.Ne:
          this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l != r; },
                                                     (l,r) => { return l.Ne(r);},"!=");
          break;
      }
    } else {
      let lhs = this._EvalExpr(x.lhs);
      let lval= this._ToBoolean(x.lhs.pos,lhs);
      if(lval) {
        if(x.op == lexer.Token.Or)
          return this._SetThis(new ast.Boolean(true));
        else
          return this._SetThis(new ast.Boolean(this._ToBoolean(x.rhs.pos,this._EvalExpr(x.rhs))));
      } else {
        if(x.op == lexer.Token.And)
          return this._SetThis(new ast.Boolean(false));
        else
          return this._SetThis(new ast.Boolean(this._ToBoolean(x.rhs.pos,this._EvalExpr(x.rhs))));
      }
    }
  }

  _EvalTernary(x) {
    let lhs = this._EvalExpr(x.lhs);
    let cond= this._EvalExpr(x.cond);
    if(this._ToBoolean(cond.pos,cond)) {
      return this._SetThis(lhs);
    } else {
      return this._SetThis(this._EvalExpr(x.rhs));
    }
  }

  _EvalFunction(x) {
    return this._SetThis(new Func(x));
  }

  _EvalAst(x) {
    if(x instanceof ast.Number) {
      return this._EvalNumber(x);
    } else if(x instanceof ast.Boolean) {
      return this._EvalBoolean(x);
    } else if(x instanceof ast.String) {
      return this._EvalString(x);
    } else if(x instanceof ast.Null) {
      return this._EvalNull(x);
    } else if(x instanceof ast.List) {
      return this._EvalList(x);
    } else if(x instanceof ast.Pair) {
      return this._EvalPair(x);
    } else if(x instanceof ast.Dict) {
      return this._EvalDict(x);
    } else if(x instanceof ast.This) {
      return this._EvalThis(x);
    } else if(x instanceof ast.Dollar) {
      return this._EvalDollar(x);
    } else if(x instanceof ast.Variable) {
      return this._EvalVariable(x);
    } else if(x instanceof ast.Attribute) {
      return this._EvalAttribute(x);
    } else if(x instanceof ast.Function) {
      return this._EvalFunction(x);
    } else if(x instanceof ast.Prefix) {
      return this._EvalPrefix(x);
    } else if(x instanceof ast.Unary) {
      return this._EvalUnary(x);
    } else if(x instanceof ast.Binary) {
      return this._EvalBinary(x);
    } else if(x instanceof ast.Ternary) {
      return this._EvalTernary(x);
    } else {
      this._Fatal(x.position,util.format("BUG in evaluator? I cannot do shit w.r.t node %s",typeof x));
    }
  }

  _EvalExpr(x) {
    return this._ThisScope(() => { this._EvalAst(x); });
  }

  _EvalExprWithContext(ctx,x) {
    return this._ThisScopeWithContext(ctx,() => { this._EvalAst(x); });
  }

  _EvalLet(x) {
    for( const e of x.vars ) {
      if(e.name in this.vmap) {
        this._Fatal(util.format("variable %s has been defined",e.name));
      }
      let v = this._EvalExpr(e.value);
      this.vmap[e.name] = v;
    }
  }

  _Eval(x) {
    this._EvalLet(x.vars);
    return this._EvalExpr(x.query);
  }

  Eval(x) {
    this._SetThis(new obj.Null());
    this.frame.push( new Frame(0,"__init__") );

    let ret = this._Eval(x);

    this.frame.pop();
    this._PopThis();
    return ret;
  }
};

module.exports = {
  Eval : Eval
};
