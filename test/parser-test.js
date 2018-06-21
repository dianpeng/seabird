const parse = require("../lib/parser.js");
const util  = require("util");

function dump(obj) {
  console.log(util.inspect(obj,{colors:true,depth:10000}));
}


function TestArith() {
  {
    let src = `a+b*c+d-e/f+-3`;
    let node= parse(src);
  }

  {
    let src = `a*(b+c)`;
    let node= parse(src);
  }
}

function TestComp() {
  {
    let src =`a > 3+b*c`;
    let node= parse(src);
  }
}

function TestCompound() {
  {
    let src = `[] + {} + (a:b)`;
    let node= parse(src);
  }

  {
    let src = `[123,"string",true,false,null] + {"true":xx,"uu":false} + (a:b)`;
    let node= parse(src);
  }
}

function TestPrefix() {
  {
    let src = `a.b.c[1][|true][? 1+2 > 3]`;
    let node= parse(src);
  }

  {
    let src = `a()(1,234,b)[xx](xx)`;
    let node= parse(src);
  }

  {
    let src = `a.*[|this.xxx >= 10]`;
    let node= parse(src);
  }

  {
    let src = `a.**.xx[|this >= 100]`;
    let node= parse(src);
  }
}

function TestLogic() {
  {
    let src = `a.b.c && true || false`;
    let node= parse(src);
  }
}

function TestTernary() {
  {
    let src = `a if b+c > 3 else (ddd if (xx) else (ee))`;
    let node= parse(src);
  }
}

function TestFunction() {
  {
    let src = `let a = fn(a,b,c,d,e) 2; c`;
    let node = parse(src);
  }
}

function TestId() {
  {
    let src = `this.a.c.d[@attr+.xx]`;
    let node= parse(src);
  }
}

TestArith();
TestComp();
TestCompound();
TestPrefix();
TestLogic();
TestTernary();
TestFunction();
TestId();
