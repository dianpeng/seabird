const parse = require("./parser.js");
const util  = require("util");

function dump(obj) {
  console.log(util.inspect(obj,{colors:true,depth:10000}));
}


function _testArith() {
  {
    let src = `a+b*c+d-e/f+-3`;
    let node= parse(src);
    dump(node);
  }

  {
    let src = `a*(b+c)`;
    let node= parse(src);
    dump(node);
  }
}

function _testComp() {
  {
    let src =`a > 3+b*c`;
    let node= parse(src);
    dump(node);
  }
}

function _testCompound() {
  {
    let src = `[] + {} + (a:b)`;
    let node= parse(src);
    dump(node);
  }

  {
    let src = `[123,"string",true,false,null] + {"true":xx,"uu":false} + (a:b)`;
    let node= parse(src);
    dump(node);
  }
}

function _testPrefix() {
  {
    let src = `a.b.c[1][|true][? 1+2 > 3]`;
    let node= parse(src);
    dump(node);
  }

  {
    let src = `a()(1,234,b)[xx](xx)`;
    let node= parse(src);
    dump(node);
  }

  {
    let src = `a.*[|this.xxx >= 10]`;
    let node= parse(src);
    dump(node);
  }

  {
    let src = `a.**.xx[|this >= 100]`;
    let node= parse(src);
    dump(node);
  }
}

function _testLogic() {
  {
    let src = `a.b.c && true || false`;
    let node= parse(src);
    dump(node);
  }
}

function _testTernary() {
  {
    let src = `a if b+c > 3 else (ddd if (xx) else (ee))`;
    let node= parse(src);
    dump(node);
  }
}

function _testFunction() {
  {
    let src = `let a = fn(a,b,c,d,e) 2; c`;
    let node = parse(src);
    dump(node);
  }
}

function _testId() {
  {
    let src = `this.a.c.d[@attr+.xx]`;
    let node= parse(src);
    dump(node);
  }
}

_testPrefix();
