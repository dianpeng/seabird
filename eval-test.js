const parser = require("./parser.js");
const object = require("./object.js");
const eval   = require("./eval.js"  );
const assert = require("assert");
const util   = require("util");

function dump(obj) {
  console.log(util.inspect(obj,{colors:true,depth:10000}));
}

function _Run(xxx,map) {
  let node = parser(xxx);
  let e    = new eval.Eval(map);
  try {
    return e.Eval(node);
  } catch(e) {
    console.log(e.msg);
    console.log(new Error().stack);
  }
}

function _R(xxx) { return _Run(xxx,{}); }

function _testArith() {
  console.log(_R("let v = [1,2,3,4]; v[0:4:2]"));
}

_testArith();
