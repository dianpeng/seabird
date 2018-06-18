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
    this.position = poisition;
    this.dict     = dict;
  }
};

class This {
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

class PrefixComponent {
  static get Index() { return 0; }
  static get Call () { return 1; }
  static get Dot  () { return 2; }
  static get Predicate() { return 3; }
  static get Rewrite () { return 4; }

  static NewIndex( expr ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Index();
    ret.value= expr;
    return ret;
  }

  static NewCall ( arg ) {
    let ret = new PrefixComponent();
    ret.type= PrefixComponent.Call();
    ret.argument = arg;
    return ret;
  }

  static NewDot  ( name ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Dot();
    ret.name = name;
    return ret;
  }

  static NewPredicate( expr ) {
    let ret = new PrefixComponent();
    ret.type = PrefixComponent.Predicate();
    ret.value= value;
    return ret;
  }

  static NewRewrwite( expr , position ) {
    let ret = new PrefixComponent();
    ret.type= PrefixComponent.Rewrite(); 
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
  constructor( op , oprand , position ) {
    this.position = position;
    this.op       = op;
    this.operand  = operand;
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