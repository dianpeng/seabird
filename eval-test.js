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

function TestUnary() {
  _Expect("-1", new object.Number(-1));
  _Expect("let v = 10; -v", new object.Number(-10));
  _Expect("let v = 10; !v", new object.Boolean(false));
  _Expect("let v = 0 ; !v", new object.Boolean(true));
}

function TestArith() {
  _Expect("1+2*3",new object.Number(7));
  _Expect("let v = 10; 1 + 2*v",new object.Number(21));
  _Expect("let v = 20; 1 + 1*v",new object.Number(21));
  _Expect("let x = [1]; x[0]"  ,new object.Number(1));
  _Expect("let x = true;   x"  ,new object.Boolean(true));
  _Expect("let y = false;  y"  ,new object.Boolean(false));
  _Expect("let h = null;   h"  ,new object.Null());
  _Expect("let xx= \"xx\"; xx[0]", new object.String("x"));
}

function TestComp() {
  _Expect("1 > 2",new object.Boolean(false));
  _Expect("1 < 2",new object.Boolean(true ));
  _Expect("1 ==2",new object.Boolean(false));
  _Expect("1 !=2",new object.Boolean(true ));
  _Expect("1 >=2",new object.Boolean(false));
  _Expect("1 <=2",new object.Boolean(true ));
}

function TestLogic() {
  _Expect("true && false",new object.Boolean(false));
  _Expect("true || false",new object.Boolean(true ));
  _Expect("false && xx  ",new object.Boolean(false));
  _Expect("true ||  xx  ",new object.Boolean(true ));
}

function TestString() {
  _Expect("let v = \"abcde\"; v[1]",new object.String("b"));
  _Expect("let v = \"abcde\"; v[0:5:2]", new object.String("ace"));
  _Expect("let v = \"abcd\"; v.@size",new object.Number(4));
  _Expect("let v = \"\"; v.@empty", new object.Boolean(true));
}

function TestList() {
  _Expect("let v = [1,true,false,null,3]; v[0] + v[4]", new object.Number(4));
  _Expect("let v = [1,null,null]; v[1]", new object.Null());
  _Expect("let v = []; v.@size == 0", new object.Boolean(true));
  _Expect("let v = []; v.@empty"    , new object.Boolean(true));
}

function TestDict() {
  _Expect("let v = {}; v.@empty", new object.Boolean(true));
  _Expect("let v = { \"a\" : 10 }; v[\"a\"] + v.a", new object.Number(20));
}

function TestPredicate() {
  _Expect("let v = 10; v[? this > 1]", new object.Number(10));
  _Expect("let v = 10; v[? this < 1]", new object.Null());
  _Expect("let x = [1,2,34]; x[? this.@size == 3 ][0]", new object.Number(1));
}

function TestRewrite() {
  _Expect("let v = 10; v[| this + 10 ]", new object.Number(20));
  _Expect("let v = 10; v[| this < 1  ]", new object.Boolean(false));
}

function TestForeach() {
  _Expect("let v = [1,2,3,4]; (v.*[| this * 2 ])[0]", new object.Number(2));
  _Expect("let v = [2,4,6,8]; (v.*[| this / 2 ])[0]", new object.Number(1));
  _Expect("let v = [3,6,9,12];(v.*[? this > 7 ])[0]", new object.Number(9));
}

function TestWildcard() {
  _Expect("let v = [1,2,3,[1,2,3,4]]; (v.**[? this > 1])[1]", new object.Number(3));
  _Expect("let v = {\"a\" : {\"b\" : { \"aa\" : 10 }}, \"b\" : {\"aa\":11}} , result = v.**.aa;" +
          "(result.**[? this > 10 ])[0]",new object.Number(11));
}

TestWildcard();
