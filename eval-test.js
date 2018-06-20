const parser = require("./parser.js");
const object = require("./object.js");
const eval   = require("./eval.js"  );
const assert = require("assert");
const util   = require("util");

function Dump(obj) {
  console.log(util.inspect(obj,{colors:true,depth:10000}));
}

function Equal(lhs,rhs) {
  if(lhs instanceof object.Number && rhs instanceof object.Number) {
    return lhs.value == rhs.value;
  }
  if(lhs instanceof object.String && rhs instanceof object.String) {
    return lhs.value == rhs.value;
  }
  if(lhs instanceof object.Null && rhs instanceof object.Null) {
    return true;
  }
  if(lhs instanceof object.Boolean && rhs instanceof object.Boolean) {
    if(lhs.value && rhs.value) return true;
    if(!lhs.value && !rhs.value) return true;
    return false;
  }
  if(lhs instanceof object.Pair && rhs instanceof object.Pair) {
    return Equal(lhs.key,rhs.key) && Equal(lhs.value,rhs.value);
  }
  if(lhs instanceof object.List && rhs instanceof object.List) {
    if(lhs.list.length != rhs.list.length) {
      return false;
    }
    let idx = 0;
    for( const x of lhs.list ) {
      if(!Equal(x,rhs.list[idx])) return false;
      ++idx;
    }
    return true;
  }
  if(lhs instanceof object.Dict && rhs instanceof object.Dict) {
    if(lhs.list.length != rhs.list.length) {
      return false;
    }
    let idx =0;
    for( const x of lhs.list ) {
      if(!Equal(x,rhs.list[idx])) return false;
      ++idx;
    }
    return true;
  }
  return false;
}

function _Run(xxx,map) {
  let node = parser(xxx);
  let e    = new eval.Eval(map);
  try {
    return e.Eval(node);
  } catch(e) {
    console.log(e.msg);
    console.log(new Error().stack);
    return null;
  }
}

function _Expect(xxx,value) {
  let ret = _Run(xxx,{});
  assert(ret != null);

  if(Equal(ret,value)) {
    return true;
  } else {
    console.log(ret,"!=",value);
    assert(false);
  }
}

function _testArith() {
  _Expect("1+2*3",new object.Number(7));
  _Expect("let v = 10; 1 + 2*v",new object.Number(21));
  _Expect("let v = 20; 1 + 1*v",new object.Number(21));
  _Expect("let x = [1]; x[0]"  ,new object.Number(1));
  _Expect("let x = true;   x"  ,new object.Boolean(true));
  _Expect("let y = false;  y"  ,new object.Boolean(false));
  _Expect("let h = null;   h"  ,new object.Null());
  _Expect("let xx= \"xx\"; xx[0]", new object.String("x"));
}

function _testComp() {
  _Expect("1 > 2",new object.Boolean(false));
  _Expect("1 < 2",new object.Boolean(true ));
  _Expect("1 ==2",new object.Boolean(false));
  _Expect("1 !=2",new object.Boolean(true ));
  _Expect("1 >=2",new object.Boolean(false));
  _Expect("1 <=2",new object.Boolean(true ));
}

function _testLogic() {
  _Expect("true && false",new object.Boolean(false));
  _Expect("true || false",new object.Boolean(true ));
  _Expect("false && xx  ",new object.Boolean(false));
  _Expect("true ||  xx  ",new object.Boolean(true ));
}

function _testString() {
  _Expect("let v = \"abcde\"; v[1]",new object.String("b"));
  _Expect("let v = \"abcde\"; v[0:5:2]", new object.String("ace"));
}


_testString();
