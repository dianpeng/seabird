// Implement the actual logic by walking the AST
// There's no point to implement a fancier bytecode based VM since the query is small, the
// time you spent should be in the underlying logic that performs the query semantic.

const assert= require("./port/assert.js");
const util  = require("./port/util.js");
const lexer = require("./lexer.js");
const ast   = require("./ast.js");
const parse = require("./parser.js");
const obj   = require("./object.js");
const excep = require("./exception.js");
const bt    = require("./builtin.js");

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

class PredicationFailure extends excep.SoftException {
  constructor() { super(""); }
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
  constructor(map,dollar) {
    // merge the initial evaluation context
    this.vmap = bt();
    for(const x in map) {
      this.vmap[x] = map[x];
    }

    this.frame= [];
    this.this_stack = new Stack();
    if(dollar == null) dollar = new obj.Null();
    this.dollar     = dollar;
    this.show_error_trace = false;
  }

  // Constant field
  static get MaxFrameSize() { return 1024; }

  // Error handling
  _PopulateExceptionMessage(pos,msg) {
    let stk = [];
    for( let j = 0 , i = this.frame.length - 1; i>=0 ; --i , ++j ) {
      let f = this.frame[i];
      stk.push(util.format("  %d.<func:%d>:%s",j,f.narg,f.description));
    }
    let jsstk = "";
    if(this.show_error_trace)
      jsstk = new Error().stack;


    return util.format("around `%s` evaluation error occur: %s\nFrame:\n%s\n%s",
                       pos.GetCodeSnippet(),
                       msg,
                       stk.join("\n"),
                       jsstk);
  }

  _Fatal(pos,msg) {
    throw new excep.FatalException(this._PopulateExceptionMessage(pos,msg));
  }

  _Error(pos,msg) {
    throw new excep.SoftException(this._PopulateExceptionMessage(pos,msg));
  }

  _TypeOf(node) {
    if(obj.IsInheritFrom(node,obj.ResultSet)) {
      return "result-set";
    } else if(node instanceof Func) {
      return "script-function";
    } else {
      return node.GetName();
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
    return obj.IsHeapType(v) || obj.IsInheritFrom(v,obj.ResultSet);
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
  _Apply2(v,set_cb,prim_cb) {
    if(obj.IsInheritFrom(v,obj.ResultSet)) {
      let output = new obj.ResultSet();

      for( let itr = v.GetIterator(); itr.HasNext(); itr.Next() ) {
        let val = itr.GetValue();
        try {
          output.Push(set_cb(val));
        } catch(e) {
          // this is a search semantic, so filter out the SoftException
          if (!(e instanceof excep.SoftException))
            throw e;

          // skip this entry and then go on
          continue;
        }
      }
      return output;
    } else {
      return prim_cb(v);
    }
  }

  _Apply(v,what) {
    return this._Apply2(v,what,what);
  }


  // RAII helper function to perform this pointer restore and popsup
  _ThisScope(cb) {
    this._PushThis();
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

  _ThisScopeWithContext(ctx,cb) {
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
    if(obj.IsInheritFrom(v,obj.ResultSet)) {
      this._Error(pos,"result set cannot be converted to boolean");
    }
    if(v instanceof obj.Null)         return false;
    if(v instanceof obj.Boolean)      return v.value;
    if(v instanceof obj.Number)       return v.value != 0;
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
  _EvalString (x) { return this._SetThis(new obj.String(x.value)); }
  _EvalNull   (x) { return this._SetThis(new obj.Null()); }
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
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      return this._SetThis(this._Apply(this_ptr,(n) => { return n.GetAttribute(new obj.String(x.name)); }));
    }
    this._Error(x.position,util.format("object type %s doesn't have attribute %s",this._TypeOf(this_ptr),x.name));
  }

  _EvalIndex(x) {
    let slice = x.value;
    let start = this._EvalExpr(slice.start);
    let this_ptr = this._This();

    if(slice.end == null) {
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
      if(obj.IsInheritFrom(this_ptr,obj.UserObject)) {
        // user object
        return this._SetThis(this_ptr);
      } else {
        // construct a *ResultSet* based on iterator returned
        let itr = this_ptr.GetIterator();
        let buf = new obj.ResultSet();
        for( ; itr.HasNext(); itr.Next() ) {
          buf.Push(itr.GetValue());
        }
        return this._SetThis(buf);
      }
    }
    this._Error(x.position,util.format("object type %s doesn't support \"*\" (foreach) semantic",this._TypeOf(this_ptr)));
  }

  _EvalWildcard(x) {
    let this_ptr = this._This();
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      return this._SetThis(new obj.RecursiveResultSet(this_ptr));
    }
    this._Error(x.position,util.format("object type %s doesn't support \"**\" (wildcard) semantic",this._TypeOf(this_ptr)));
  }

  _EvalDot(x) {
    let this_ptr = this._This();
    if(this._IsHeapTypeOrResultSet(this_ptr)) {
      let comp = x.name;
      if(comp instanceof ast.Variable) {
        return this._SetThis(this._Apply(this_ptr,(n) => { return n.Dot(new obj.String(comp.name)); }));
      } else if(comp instanceof ast.Foreach) {
        return this._EvalForeach(comp);
      } else if(comp instanceof ast.Wildcard) {
        return this._EvalWildcard(comp);
      } else if(comp instanceof ast.Attribute) {
        return this._EvalAttribute(comp);
      } else {
        assert(false);
      }
    }
    this._Error(x.position,util.format("object type %s doesn't support \".\" operator",this._TypeOf(this_ptr)));
  }

  _EvalPredicate(x) {
    let this_ptr   = this._This();
    return this._SetThis(this._Apply2(this_ptr,
      (n) => {
        let v = this._EvalExprWithContext(n,x.value);
        if(this._ToBoolean(x.position,v))
          return n;

        // throw a soft exception to let the Apply function to catch it and then
        // skip this entry
        throw new PredicationFailure();
      },
      (n) => {
        let v = this._EvalExprWithContext(n,x.value);
        if(this._ToBoolean(x.position,v))
          return n;
        return new obj.Null();
      }
    ));
  }

  _EvalRewrite(x) {
    let this_ptr   = this._This();
    let rewrite    = x.value;
    return this._SetThis(this._Apply(this_ptr,
      (n) => {
        let v = (this._EvalExprWithContext(n,rewrite));
        return v;
      })
    );
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
      let frame = new Frame(x.argument.length,util.format("script-function:(%s)",
                                                          this_ptr.code.position.GetCodeSnippet()));
      for( const a of x.argument) {
        frame.argument[this_ptr.code.argument[idx]] = this._EvalExpr(a);
        idx++;
      }
      // push the new frame
      this.frame.push(frame);
      // now evaluate the freaking function
      let result = this._SetThis(this._EvalExpr(this_ptr.code.body));
      // pop the frame
      this.frame.pop();

      return result;
    } else if(obj.IsInheritFrom(this_ptr,obj.UserObject)) {
      let arg = [];
      for( const a of x.argument ) {
        arg.push(this._EvalExpr(a));
      }
      this.frame.push(new Frame(x.argument.length,util.format("js-function(%s)",this._TypeOf(this_ptr))));
      let result = this._SetThis(this_ptr.Invoke(this,arg));
      this.frame.pop();
      return result;
    }

    this._Error(x.position,util.format("cannot call function on type %s",this._TypeOf(this_ptr)));
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
    let opr = x.operand;
    let val = this._EvalExpr(opr);
    if(x.op == lexer.Token.Sub) {
      // negate the `val` value
      if(val instanceof obj.Number) {
        return this._SetThis(new obj.Number(-val.value));
      } else if(obj.IsInheritFrom(val,obj.UserObject)) {
        return this._SetThis(val.Negate());
      }
      this._Error(x.position,util.format("object type %s doesn't support negate operator",this._TypeOf(this_ptr)));
    } else {
      if(obj.IsInheritFrom(val,obj.UserObject)) {
        return this._SetThis(val.Not());
      } else {
        let bval = this._ToBoolean(x.position,val);
        return this._SetThis(new obj.Boolean(!bval));
      }
    }
  }

  _IsBothNumber(lhs,rhs) {
    return lhs instanceof obj.Number && rhs instanceof obj.Number;
  }

  _ApplyArithmeticOp(pos,lhs,rhs,num_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return this._SetThis(new obj.Number(num_op(lhs.value,rhs.value)));
    } else if(obj.IsInheritFrom(lhs,obj.UserObject)) {
      return this._SetThis(obj_op(lhs,rhs));
    } else {
      this._Error(pos,util.format("cannot apply operator %s on type lhs:%s , rhs:%s",
                                  op,this._TypeOf(lhs),this._TypeOf(rhs)));
    }
  }

  _ApplyComparisonOp(pos,lhs,rhs,prim_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return this._SetThis(new obj.Boolean(prim_op(lhs.value,rhs.value)));
    } else if(lhs instanceof obj.String && rhs instanceof obj.String) {
      let l = lhs.value;
      let r = rhs.value;
      return this._SetThis(new obj.Boolean(prim_op(l,r)));
    } else if(obj.IsInheritFrom(lhs,obj.UserObject)) {
      return this._SetThis(obj_op(lhs,rhs));
    } else {
      this._Error(pos,util.format("cannot apply operator %s on type lhs:%s , rhs:%s",
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
          return this._SetThis(new obj.Boolean(true));
        else
          return this._SetThis(new obj.Boolean(this._ToBoolean(x.rhs.pos,this._EvalExpr(x.rhs))));
      } else {
        if(x.op == lexer.Token.And)
          return this._SetThis(new obj.Boolean(false));
        else
          return this._SetThis(new obj.Boolean(this._ToBoolean(x.rhs.pos,this._EvalExpr(x.rhs))));
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
    } else if(x instanceof ast.SubExpr) {
      return this._EvalSubExpr(x.expr);
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

  _ToList(x) {
    if(obj.IsInheritFrom(x,obj.ResultSet)) {
      let l = new obj.List();
      for( let itr = x.GetIterator(); itr.HasNext(); itr.Next() ) {
        l.Push(itr.GetValue());
      }
      return l;
    }
    return x;
  }

  // The sub expression has special semnatic that will flatten the result set
  // into a normal list , basically does the expansion. So expression like this:
  //
  // v.*[? some_predicator ][0] will be interpreter as apply all the expression
  // as searching filter after `*` to expansion of v.
  //
  // but (v.*[? some_predicator ])[0] will become that the stuff inside of the
  // parenthsis will be flatten into a list and then the last `[0]` is an index
  // for this list. This is more intuitive
  _EvalSubExpr(x) {
    let r = this._EvalExpr(x);
    return this._SetThis(this._ToList(r));
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
    return this._ToList(ret);
  }
};

module.exports = {
  Eval : Eval
};
