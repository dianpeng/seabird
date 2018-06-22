const parser = require("./lib/parser.js" );
const eval   = require("./lib/eval.js"   );
const printer= require("./lib/printer.js");
const obj    = require("./lib/object.js" );
const excep  = require("./lib/exception.js");

module.exports = {
  parse                   : function(xx)              { return parser(xx);                  },
  eval                    : function(node,map,dollar) { return eval.Eval(node,map,dollar);  },
  // rest of the aux functions and objects
  printer   : printer,
  object    : obj,
  exception : excep
};

// This file is the entry of the library if user doesn't want to just use it as command line
// tool but want to use it as a library in Browser. Then user can use whatever pack tools to
// pack its application an reference it as a third party library
