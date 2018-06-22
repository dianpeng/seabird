const sbp    = require("./lib/parser.js");
const eval   = require("./lib/eval.js"  );
const printer= require("./lib/printer.js");
const sbe    = require("./lib/exception.js");
const obj    = require("./lib/object.js");

const util   = require("util");
const assert = require("assert");
const fs     = require("fs");

class CMDParserError {
  constructor(msg,help) {
    let buf = ["Error:  ",msg,"\nHelp:\n",help];
    this.msg = buf.join("");
  }
};

class CMDParser {
  static get DefaultKey() { return "@"; }
  constructor(title,keys) {
    this.title= title;
    this.keys = keys;
  }

  _IsKey(x) {
    if(x.length >= 2 && x.charAt(0) == "-" && x.charAt(1) == "-") {
      return x.substr(2,x.length-2);
    }
    return null;
  }

  _ParseCMD() {
    var args = process.argv.slice(2);
    var res  = {};
    var cur  = CMDParser.DefaultKey;

    for( const x of args ) {
      let k = this._IsKey(x);
      if(k == null) {
        if(cur in res) {
          res[cur].push(x);
        } else {
          res[cur] = [x];
        }
      } else {
        if(!(k in this.keys)) {
          throw new CMDParserError(util.format("argument %s is not recognized",k),this.GetHelp());
        }
        cur = k;
        if(!(cur in res)) {
          res[cur] = [];
        }
      }
    }

    return res;
  }

  Parse   () { return this._ParseCMD(); }

  GetHelp () {
    let buf = [this.title,"\nHelp:\n"];
    for( const x in this.keys ) {
      buf.push(util.format("  --%s : %s\n",x,this.keys[x]));
    }
    return buf.join("");
  }
};

function _Main() {
  let parser = new CMDParser("Seabird Query Language",
                             {
                               "printer" : "optional argument for telling how to print",
                               "query"   : "optional argument for specifying query , you " +
                                           "can put the query right after command line",
                               "file"    : "a file that contains query script",
                               "dollar"  : "a file path that indicates where the dollar symbol's data comes from",
                               "help"    : "show help"
                             });

  try {
    let args   = parser.Parse ();
    let q = null;
    let dollar = new obj.Null();

    if("help" in args) {
      console.log(parser.GetHelp());
      return;
    }

    if(CMDParser.DefaultKey in args) {
      q = args[CMDParser.DefaultKey][0];
    } else if("query" in args) {
      q = args["query"][0];
    } else if("file" in args) {
      q = (fs.readFileSync(args["file"][0]).toString());
    } else {
      console.log(parser.GetHelp());
      return;
    }

    if("dollar" in args) {
      dollar = new obj.String(fs.readFileSync(args["dollar"][0]).toString());
    }

    let n = sbp(q);
    let e = new eval.Eval({},dollar);
    let r = e.Eval(n);

    if("printer" in args && args.printer[0] == "JSON") {
      console.log(new printer.StrictJSON().Print(r));
    } else {
      console.log(new printer.ExtendedJSON().Print(r));
    }
  } catch(e) {
    if(e instanceof CMDParserError) {
      console.log(e.msg);
    } else if(e instanceof sbe.SeabirdException) {
      console.log(e.msg);
    } else {
      console.log("Exception:",e);
    }
  }
}

_Main();
