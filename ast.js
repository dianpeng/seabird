// Constant ------------------------------------
class Number {
  constructor( value , position ) {
    this.position = position;
    this.value    = value;
  }
};

class Boolean {
  constructor( value , position ) {
    this.position = position;
    this.value    = value;
  }
};

class String {
  constructor( value , position ) {
    this.position = position;
    this.value    = value;
  }
};

class Null {
  constructor( position ) {
    this.position = position;
  }
};

// Compound -------------------------
class List {
  constructor ( list , position ) {
    this.position = position;
    this.list     = list;
  }
};

class Pair {
  constructor( key , value , position ) {
    this.position = position;
    this.key      = key;
    this.value    = value;
  }
}

class Dict {
  constructor ( dict , position ) {
    this.position = position;
    this.dict     = dict;
  }
};

class This {
  constructor( position ) {
    this.position = position;
  }
};

class Dollar {
  constructor( position ) {
    this.position = position;
  }
};

class Variable {
  constructor( name , position ) {
    this.position = position;
    this.name     = name;
  }
};

class Attribute {
  constructor( name , position ) {
    this.position = position;
    this.name     = name;
  }
};

class Function {
  constructor( argument , body , position ) {
    this.position = position;
    this.argument = argument;
    this.body     = body;
  }
};

class Slice {
  constructor( start , end , stride , position ) {
    this.position = position;
    this.start    = start;
    this.end      = end;
    this.stride   = stride;
  }
};

class Foreach {
  constructor( position ) {
    this.position = position;
  }
};

class Wildcard {
  constructor( position ) {
    this.position = position;
  }
};

class PrefixComponent {
  static get Index() { return 0; }
  static get Call () { return 1; }
  static get Dot  () { return 2; }
  static get Predicate() { return 3; }
  static get Rewrite () { return 4; }

  static NewIndex( expr ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Index;
    ret.value= expr;
    return ret;
  }

  static NewCall ( arg ) {
    let ret = new PrefixComponent();
    ret.type= PrefixComponent.Call;
    ret.argument = arg;
    return ret;
  }

  static NewDot  ( name ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Dot;
    ret.name = name;
    return ret;
  }

  static NewPredicate( expr ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Predicate;
    ret.value= value;
    return ret;
  }

  static NewRewrwite( expr , position ) {
    let ret = new PrefixComponent();
    ret.type= PrefixComponent.Rewrite;
    ret.value= value;
    return ret;
  }
};

class Prefix {
  constructor( first , rest , position ) {
    this.position = position;
    this.first = first;
    this.rest  = rest;
  }
};

class Unary {
  constructor( op , opr , position ) {
    this.position = position;
    this.op       = op;
    this.operand  = opr;
  }
};

class Binary {
  constructor( op , lhs , rhs , position ) {
    this.position = position;
    this.op       = op;
    this.lhs      = lhs;
    this.rhs      = rhs;
  }
};

class Ternary {
  constructor( cond , lhs, rhs, position ) {
    this.position = position;
    this.cond     = cond;
    this.lhs      = lhs;
    this.rhs      = rhs;
  }
};


// ------------------------------------------------
class Define {
  constructor( name , value , position ) {
    this.position = position;
    this.name     = name;
    this.value    = value;
  }
};

class Let {
  constructor( vars , position ) {
    this.position = position;
    this.vars     = vars;
  }
};

class Program {
  constructor( vars , query , position ) {
    this.position = position;
    this.vars     = vars;
    this.query    = query;
  }
};

module.exports = {
  Number : Number ,
  Boolean : Boolean ,
  String : String ,
  Null : Null ,
  List : List ,
  Pair : Pair ,
  Dict  : Dict ,
  This : This,
  Dollar : Dollar ,
  Variable : Variable ,
  Attribute : Attribute ,
  Function : Function ,
  Slice : Slice,
  Foreach : Foreach,
  Wildcard : Wildcard,
  PrefixComponent : PrefixComponent,
  Prefix : Prefix,
  Unary : Unary,
  Binary : Binary ,
  Ternary : Ternary,
  Define : Define ,
  Let : Let,
  Program : Program
};
