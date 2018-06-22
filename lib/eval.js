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

class Frame {
  constructor(narg,desp,pos) {
    this.narg        = narg;
    this.description = desp;
    this.argument    = {};
    this.position    = pos;
  }
};

// The evaluation is using a context value called *this* to progressing , the *this* value can
// be referenced via keyword "this".
// The context value *this* is automatically updated by *prefix* expression.
class Eval {
  constructor(map,dollar) {
    // merge the initial evaluation context
    this.vmap = bt.Install();
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
          // this rethrow breaks the stack trace
          if(!(e instanceof excep.SoftException)) throw e;

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
      return cb();
    } finally {
      this._PopThis();
    }
  }

  _ThisScopeWithContext(ctx,cb) {
    this._PushAndSetThis(ctx);
    try {
      return cb();
    } finally {
      this._PopThis();
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
    return (new obj.Pair( this._EvalExpr(x.key) , this._EvalExpr(x.value) ));
  }

  _EvalDict(x) {
    let ret = new obj.Dict();
    for( const ele of x.dict ) {
      let key = this._EvalExpr(ele.key);
      let val = this._EvalExpr(ele.value);
      try {
        ret.Add(key,val);
      } catch(e) {
        if(e instanceof obj.KeyExisted || e instanceof obj.TypeMismatch) {
          this._Fatal(x.position,util.format("cannot add key/value pair into dict due to error %s",e.msg));
        } else {
          throw e;
        }
      }
    }
    return ret;
  }

  _EvalNumber (x) { return new obj.Number(x.value); }
  _EvalBoolean(x) { return new obj.Boolean(x.value);}
  _EvalString (x) { return new obj.String(x.value); }
  _EvalNull   (x) { return new obj.Null(); }
  _EvalDollar (x) { return this.dollar; }

  _EvalVariable(x) {
    if(x.name in this.vmap) {
      return this.vmap[x.name];
    } else if(x.name in this._Frame().argument) {
      return this._Frame().argument[x.name];
    }
    this._Fatal(x.position,util.format("variable %s doesn't exist",x.name));
  }

  _EvalThis(x) {
    return this._This();
  }

  _EvalAttribute(this_ptr,x) {
    if(obj.IsHeapType(this_ptr)) {
      return (this._Apply(this_ptr,(n) => { return n.GetAttribute(new obj.String(x.name)); }));
    }
    this._Error(x.position,util.format("object type %s doesn't have attribute %s",this._TypeOf(this_ptr),x.name));
  }

  _EvalIndex(this_ptr,x) {
    let slice = x.value;
    let start = this._EvalExpr(slice.start);

    if(slice.end == null) {
      // normal indexing , dispatch indexing operations
      if(obj.IsHeapType(this_ptr)) {
        return ((this._Apply(this_ptr,(n) => { return n.Index(start); })));
      }
      this._Error(x.position,util.format("object type %s doesn't support index",this._TypeOf(this_ptr)));
    } else {
      let end    = this._EvalExpr(slice.end);
      let stride = this._EvalExpr(slice.stride);
      if(obj.IsHeapType(this_ptr)) {
        return (this._Apply(this_ptr,(n) => { return n.Slice(start,end,stride); }));
      }
      this._Error(x.position,util.format("object type %s doesn't support slice index",this._TypeOf(this_ptr)));
    }
  }

  _EvalForeach(this_ptr,x) {
    if(obj.IsHeapType(this_ptr)) {
      // construct a *ResultSet* based on iterator returned
      let buf = new obj.ResultSet();
      for( let itr = this_ptr.GetIterator() ; itr.HasNext(); itr.Next() ) {
        buf.Push(itr.GetValue());
      }
      return buf;
    }
    this._Error(x.position,util.format("object type %s doesn't support \"*\" (foreach) semantic",this._TypeOf(this_ptr)));
  }

  _EvalWildcard(this_ptr,x) {
    if(obj.IsHeapType(this_ptr)) {
      return (new obj.RecursiveResultSet(this_ptr));
    }
    this._Error(x.position,util.format("object type %s doesn't support \"**\" (wildcard) semantic",this._TypeOf(this_ptr)));
  }

  _EvalDot(this_ptr,x) {
    if(obj.IsHeapType(this_ptr)) {
      let comp = x.name;
      if(comp instanceof ast.Variable) {
        return (this._Apply(this_ptr,(n) => { return n.Dot(new obj.String(comp.name)); }));
      } else if(comp instanceof ast.Foreach) {
        return this._EvalForeach(this_ptr,comp);
      } else if(comp instanceof ast.Wildcard) {
        return this._EvalWildcard(this_ptr,comp);
      } else if(comp instanceof ast.Attribute) {
        return this._EvalAttribute(this_ptr,comp);
      } else {
        assert(false);
      }
    }
    this._Error(x.position,util.format("object type %s doesn't support \".\" operator",this._TypeOf(this_ptr)));
  }

  _EvalPredicate(this_ptr,x) {
    return (this._Apply2(this_ptr,
      (n) => {
        let v = this._EvalExprWithContext(n,x.value);
        if(obj.ToBoolean(v))
          return n;
        // throw a soft exception to let the Apply function to catch it and continue
        throw new PredicationFailure();
      },
      (n) => {
        let v = this._EvalExprWithContext(n,x.value);
        if(obj.ToBoolean(v))
          return n;
        return new obj.Null();
      }
    ));
  }

  _EvalRewrite(this_ptr,x) {
    let rewrite    = x.value;
    return (this._Apply(this_ptr,
      (n) => {
        let v = (this._EvalExprWithContext(n,rewrite));
        return v;
      })
    );
  }

  _EvalLambdaCall(pos,lambda,frame,narg) {
    if(this.frame.length >= Eval.MaxFrameSize) {
      this._Fatal(pos,util.format("call stack overflow,recursive call more than %d",Eval.MaxFrameSize));
    }

    if(narg != lambda.code.argument.length) {
      this._Fatal(pos,
                  util.format("cannot call function around code snippet %s with argument number %d but expect %d",
                  lambda.code.position.GetCodeSnippet(),narg,lambda.code.argument.length));
    }

    let idx = 0;
    // push the new frame
    this.frame.push(frame);

    // now evaluate the freaking function
    try {
      return (this._EvalExpr(lambda.code.body));
    } finally {
      // pop the frame
      this.frame.pop();
    }
  }

  _SetupFrameArgs(args,frame,this_ptr) {
    let idx = 0;
    for(const a of args) {
      frame.argument[this_ptr.code.argument[idx]] = this._EvalExpr(a);
      idx++;
    }
  }

  _EvalCall(this_ptr,x) {
    if(this.frame.length >= Eval.MaxFrameSize) {
      this._Fatal(x.position,util.format("call stack overflow,recursive call more than %d",Eval.MaxFrameSize));
    }

    if(this_ptr instanceof obj.Lambda) {
      let frame = new Frame(x.argument.length,util.format("script-function:(%s)",
                                                          this_ptr.code.position.GetCodeSnippet()),x.position);

      // setup the function argument list
      this._SetupFrameArgs(x.argument,frame,this_ptr);

      // call the lambda functions
      return this._EvalLambdaCall(x.position,this_ptr,frame,x.argument.length);
    } else if(obj.IsInheritFrom(this_ptr,obj.UserObject)) {
      let arg = [];
      for( const a of x.argument ) {
        arg.push(this._EvalExpr(a));
      }
      this.frame.push(new Frame(x.argument.length,util.format("js-function(%s)",this._TypeOf(this_ptr)),x.position));
      try {
        return (this_ptr.Invoke(this,arg));
      } finally {
        this.frame.pop();
      }
    }

    this._Error(x.position,util.format("cannot call function on type %s",this._TypeOf(this_ptr)));
  }

  _EvalPrefixComponent(this_ptr,x) {

    // The only time we flush the _this_ptr back is when we are evaluating :
    // 1) []
    // 2) [?]
    // 3) [|]
    // since these operators forms a local sub expression scope which allow
    // this to be used
    if(x.type == ast.PrefixComponent.Index      ||
       x.type == ast.PrefixComponent.Predicate  ||
       x.type == ast.PrefixComponent.Rewrite) {
      this._SetThis(this_ptr);
    }

    switch(x.type) {
      case ast.PrefixComponent.Index:     return this._EvalIndex(this_ptr,x);
      case ast.PrefixComponent.Call:      return this._EvalCall(this_ptr,x);
      case ast.PrefixComponent.Dot:       return this._EvalDot(this_ptr,x);
      case ast.PrefixComponent.Predicate: return this._EvalPredicate(this_ptr,x);
      case ast.PrefixComponent.Rewrite:   return this._EvalRewrite(this_ptr,x);
      default: assert(false); return null;
    }
  }

  _EvalPrefix(x) {
    let result = this._EvalAst(x.first);
    for( const v of x.rest ) {
      result = this._EvalPrefixComponent(result,v);
    }
    return result;
  }

  _EvalUnary(x) {
    let opr = x.operand;
    let val = this._EvalExpr(opr);
    if(x.op == lexer.Token.Sub) {
      // negate the `val` value
      if(val instanceof obj.Number) {
        return (new obj.Number(-val.value));
      } else if(obj.IsInheritFrom(val,obj.UserObject)) {
        return (val.Negate());
      }
      this._Error(x.position,util.format("object type %s doesn't support negate operator",this._TypeOf(this_ptr)));
    } else {
      if(obj.IsInheritFrom(val,obj.UserObject)) {
        return (val.Not());
      } else {
        let bval = obj.ToBoolean(val);
        return (new obj.Boolean(!bval));
      }
    }
  }

  _IsBothNumber(lhs,rhs) {
    return lhs instanceof obj.Number && rhs instanceof obj.Number;
  }

  _ApplyArithmeticOp(pos,lhs,rhs,num_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return (new obj.Number(num_op(lhs.value,rhs.value)));
    } else if(obj.IsInheritFrom(lhs,obj.UserObject)) {
      return (obj_op(lhs,rhs));
    } else {
      this._Error(pos,util.format("cannot apply operator %s on type lhs:%s , rhs:%s",
                                  op,this._TypeOf(lhs),this._TypeOf(rhs)));
    }
  }

  _ApplyComparisonOp(pos,lhs,rhs,prim_op,obj_op,op) {
    if(this._IsBothNumber(lhs,rhs)) {
      return (new obj.Boolean(prim_op(lhs.value,rhs.value)));
    } else if(lhs instanceof obj.String && rhs instanceof obj.String) {
      let l = lhs.value;
      let r = rhs.value;
      return (new obj.Boolean(prim_op(l,r)));
    } else if(obj.IsInheritFrom(lhs,obj.UserObject)) {
      return (obj_op(lhs,rhs));
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
          if(lhs instanceof obj.String && rhs instanceof obj.String) {
            return (new obj.String(lhs.value + rhs.value));
          }
          return this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l+r; },
                                                            (l,r) => { return l.Add(r); },"+");
          break;
        case lexer.Token.Sub:
          return this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l-r; },
                                                            (l,r) => { return l.Sub(r); },"-");
          break;
        case lexer.Token.Mul:
          return this._ApplyArithmeticOp(x.position,lhs,rhs,(l,r) => { return l*r; },
                                                            (l,r) => { return l.Mul(r); },"*");
          break;
        case lexer.Token.Div:
          return this._ApplyArithmeticOp(x.position,lhs,rhs,
            (l,r) => { if(r == 0) this._Fatal(x.position,"div by 0"); return l/r; },
            (l,r) => { return l.Div(r); },"/");
          break;
        case lexer.Token.Mod:
          return this._ApplyArithmeticOp(x.position,lhs,rhs,
            (l,r) => { if(r == 0) this._Fatal(x.position,"div by 0"); return l%r; },
            (l,r) => { return l.Mod(r); },"%");
          break;
        // comparison
        case lexer.Token.Lt:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l < r; },
                                                            (l,r) => { return l.Lt(r); },"<");
          break;
        case lexer.Token.Le:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l <= r; },
                                                            (l,r) => { return l.Lt(r); },"<=");
          break;
        case lexer.Token.Gt:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l > r; },
                                                            (l,r) => { return l.Gt(r); },">");
          break;
        case lexer.Token.Ge:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l >= r; },
                                                            (l,r) => { return l.Ge(r); },">=");
          break;
        case lexer.Token.Eq:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l == r; },
                                                            (l,r) => { return l.Eq(r); },"==");
          break;
        case lexer.Token.Ne:
          return this._ApplyComparisonOp(x.position,lhs,rhs,(l,r) => { return l != r; },
                                                            (l,r) => { return l.Ne(r);},"!=");
          break;
      }
    } else {
      let lhs = this._EvalExpr(x.lhs);
      let lval= obj.ToBoolean(lhs);
      if(lval) {
        if(x.op == lexer.Token.Or)
          return (new obj.Boolean(true));
        else
          return (new obj.Boolean(obj.ToBoolean(this._EvalExpr(x.rhs))));
      } else {
        if(x.op == lexer.Token.And)
          return (new obj.Boolean(false));
        else
          return (new obj.Boolean(obj.ToBoolean(this._EvalExpr(x.rhs))));
      }
    }
  }

  _EvalTernary(x) {
    let lhs = this._EvalExpr(x.lhs);
    let cond= this._EvalExpr(x.cond);
    if(obj.ToBoolean(cond)) {
      return (lhs);
    } else {
      return (this._EvalExpr(x.rhs));
    }
  }

  _EvalFunction(x) {
    return (new obj.Lambda(x));
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
      return this._EvalExpr(x.expr);
    } else {
      this._Fatal(x.position,util.format("BUG in evaluator? I cannot do shit w.r.t node %s",typeof x));
    }
  }

  // Convert a result set into a normal List. This is called whenever an expression is evaluated
  // basically always. So when user get the result from the evaluator they should never see an
  // result set but just normal data tree structure
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

  _EvalExpr(x) {
    return this._ThisScope(() => { return this._ToList(this._EvalAst(x)); });
  }

  _EvalExprWithContext(ctx,x) {
    return this._ThisScopeWithContext(ctx,() => { return this._ToList(this._EvalAst(x)); });
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

    // the this_stack and frame_stack should be popped up to 0
    assert(this.frame.length == 0,this.frame.length);
    assert(this.this_stack.GetSize() == 0,this.this_stack.GetSize());
    return ret;
  }

  Invoke(lambda,args) {
    assert( lambda instanceof obj.Lambda );
    let frame = new Frame(args.length,util.format("script-function:(%s)",lambda.code.position.GetCodeSnippet()));

    let idx = 0;
    for( const x of lambda.code.argument ) {
      frame.argument[x] = args[idx];
      ++idx;
    }

    return this._EvalLambdaCall(this._Frame().position,lambda,frame,args.length);
  }
};

module.exports = {
  Eval : Eval
};
