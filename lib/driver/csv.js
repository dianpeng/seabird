// We do have a package called CSV but is too hard for stupid me to figure out how
// to use it. Come on , I just want to parse a file into space delimited item not
// writing a OS system. Can API just become more straitfowrad instead of too much
// obvious over engineering ??
const loader = require("../port/loader.js");
const util   = require("../port/util.js");
const obj    = require("../object.js");

function _New(x) {
  let v = parseFloat(x);
  if(isNaN(v)) {
    let v = x.trim();
    if(v.length == 0) return null;
    return new obj.String(v);
  } else {
    return new obj.Number(v);
  }
}

function _ParseCSV(path,delimiter) {
  let data = loader(path);
  let lines= data.split('\n');
  let ret  = new obj.List();
  for( let l of lines ) {
    l = l.trim();
    if(l.length == 0)
      continue;

    let words = l.split(new RegExp(delimiter));
    let temp = new obj.List();
    for(const w of words) {
      let n = _New(w);
      if(n == null) continue;
      temp.Push(n);
    }
    ret.Push(temp);
  }
  return ret;
}

class CSV extends obj.UserObject {
  constructor() { super("CSV"); }
  Invoke(eng,arg) {
    if(arg.length != 1 && arg.length != 2) {
      throw new obj.FunctionArgumentNumberMismatch(
        util.format("mismatch argument count,CSV function requires 1 or 2 string argument"));
    }
    if(arg[0] instanceof obj.String) {
      let delimiter = ",";
      if(arg.length == 2) {
        if(arg[1] instanceof obj.String) {
          delimiter = arg[1].value;
        } else {
          throw new obj.TypeMismatch(
            util.format("expect String as 2nd argument for function CSV but get type %s",typeof arg[0]));
        }
      }
      return _ParseCSV(arg[0].value,delimiter);
    }
    throw new obj.TypeMismatch(
      util.format("expect String as 1st argument for function CSV but get type %s",typeof arg[0]));
  }
};

module.exports = function(buf) {
  buf["CSV"] = new CSV();
};
