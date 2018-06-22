const json   = require("./driver/json.js");
const csv    = require("./driver/csv.js" );
const obj    = require("./object.js");
const util   = require("./port/util.js");
const assert = require("./port/assert.js");

const fs_load= require("./port/fs_loader.js");

function _IsMultiSequence(x) {
  return obj.IsSequence(x) || x instanceof obj.Dict;
}

function _CheckArgument(expected_arg,func_name,arg) {
  if(expected_arg.length != arg.length) {
    throw new obj.FunctionArgumentNumberMismatch(util.format("function %s expect %d argument but got %d",
                                                 func_name,
                                                 expected_arg.length,
                                                 arg.length));
  }
  let idx = 0;
  for( const x of expected_arg ) {
    let match = false;
    for( const t of x ) {
      if(arg[idx] instanceof t) {
        match = true; break;
      }
    }
    if(!match) {
      let buf = [];
      for( const t of x ) {
        buf.push(typeof t);
      }

      throw new obj.TypeMismatch(util.format("function %s's %d argument expect type %s but get %s",
                                 func_name,
                                 idx,
                                 buf.join(";"),
                                 arg[idx].GetName()));
    }

    ++idx;
  }
}

// Builtin functions ------------------------------
class FuncType extends obj.UserObject {
  constructor() { super("type"); }

  Invoke(eng,arg) {
    _CheckArgument( [[Object]] , "type" , arg );

    let a1 = arg[0];
    if(obj.IsInheritFrom(a1,obj.ResultSet))  return new obj.String("ResultSet");
    if(obj.IsInheritFrom(a1,obj.UserObject)) return new obj.String(a1.GetName());
    return new obj.String(a1.GetName());
  }
};

class FuncStr extends obj.UserObject {
  constructor() { super("str"); }
  Invoke(eng,arg) {
    _CheckArgument( [[Object]], "str", arg );
    let a1 = arg[0];

    if(a1 instanceof obj.Number ) return new obj.String(util.format("%d",a1.value));
    if(a1 instanceof obj.Null   ) return new obj.String("null");
    if(a1 instanceof obj.Boolean) return new obj.String(a1.value ? "true" : "false");
    if(a1 instanceof obj.String ) return a1;

    throw new obj.TypeMismatch(util.format("function %s's 1st argument have type %s which cannot be " +
                               "converted to string",a1.GetName()));
  }
};

class FuncNum extends obj.UserObject {
  constructor() { super("num"); }
  Invoke(eng,arg) {
    _CheckArgument( [[Object]], "num", arg );
    let a1 = arg[0];
    if(a1 instanceof obj.Number  ) return a1;
    if(a1 instanceof obj.Boolean ) return obj.Number(a1.value ? 1 : 0);
    if(a1 instanceof obj.Null    ) return obj.Number(0);
    if(a1 instanceof obj.String  ) {
      let v = parseFloat(a1.value);
      if(isNaN(v)) throw obj.FunctionError(util.format("function num cannot convert string %s to integer",a1.value));
      return new obj.Number(v);
    }

    throw new obj.TypeMismatch(util.format("function %s's 1st argument have type %s which cannot be " +
                               "converted to number",a1.GetName()));
  }
};

class FuncInt extends obj.UserObject {
  constructor() { super("int"); }
  Invoke(eng,arg) {
    _CheckArgument( [[Object]], "int", arg );
    let a1 = arg[0];
    if(a1 instanceof obj.Number  ) return new obj.Number( Math.floor(a1.value) );
    if(a1 instanceof obj.Boolean ) return obj.Number(a1.value ? 1 : 0);
    if(a1 instanceof obj.Null    ) return obj.Number(0);
    if(a1 instanceof obj.String  ) {
      let v = parseInt(a1.value);
      if(isNaN(v)) throw obj.FunctionError(util.format("function int cannot convert string %s to integer",a1.value));
      return new obj.Number(v);
    }

    throw new obj.TypeMismatch(util.format("function %s's 1st argument have type %s which cannot be " +
                               "converted to number",a1.GetName()));
  }
};

class FuncList extends obj.UserObject {
  constructor() { super("list"); }
  Invoke(eng,arg) {
    _CheckArgument( [[Object]], "list" , arg );
    let a1 = arg[0];
    if(a1 instanceof obj.Number  ||
       a1 instanceof obj.Boolean ||
       a1 instanceof obj.Null    ||
       a1 instanceof obj.String) {
      let x = new obj.List();
      x.Push(a1);
      return x;
    }

    if(a1 instanceof obj.Pair) {
      let x = new obj.List();
      x.Push(a1.key);
      x.Push(a1.value);
      return x;
    }

    // handle iterable concept
    if(obj.IsInheritFrom(a1,obj.ResultSet) || obj.IsInheritFrom(a1,obj.UserObject)) {
      let x = new obj.List();
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        x.Push(itr.GetValue());
      }
      return x;
    }

    if(obj instanceof obj.Dict) {
      let r = new obj.List();
      for( const x of obj.list ) {
        r.Push(x);
      }
      return r;
    }

    return a1; // already a list
  }
};

class FuncDict extends obj.UserObject {
  constructor() { super("dict"); }
  Invoke(eng,arg) {
    _CheckArgument( [[Object]] , "dict", arg );
    let a1 = arg[0];
    if(obj.IsSequence(a1)) {
      let res = new obj.Dict();
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let pair = itr.GetValue();
        if(pair instanceof obj.Pair) {
          res.AddPair(pair);
        }
      }
      return res;
    } else if(a1 instanceof obj.Dict) {
      return a1;
    }

    throw new obj.TypeMismatch(util.format("function dict 1st argument expects " +
                                           "list/dict/user_object/result_set but get type %s",idx.GetName()));
  }
};

class FuncHas extends obj.UserObject {
  constructor() { super("has"); }

  Invoke(eng,arg) {
    _CheckArgument( [[obj.Dict,obj.UserObject], [obj.String]] ,"has",arg);
    let a1 = arg[0];
    let a2 = arg[1];

    // Use try catch to test whether a Dot operation can succeeded or not
    try {
      let _ = a1.Dot(a2);
    } catch(e) {
      return new obj.Boolean(false);
    }

    return new obj.Boolean(true);
  }
};

// regex matching
class RegexMatch  extends obj.UserObject {
  constructor(regex) { super("Regex::match"); this._regex = regex; }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"Regex::match",arg);
    let x = arg.match(this._regex);
    if(x == null) {
      return new obj.Null();
    } else {
      let ret = new obj.List();
      for( const match of x ) {
        ret.Push(new obj.String(match));
      }
      return ret;
    }
  }
};

class RegexHas extends obj.UserObject {
  constructor(regex) { super("Regex::has"); this._regex = regex; }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"Regex::has",arg);
    let x = arg.match(this._regex);
    if(x == null)
      return new obj.Boolean(false);
    else
      return new obj.Boolean(true );
  }
};

class Regex extends obj.UserObject {
  constructor(pattern) {
    super("Regex");
    this._regex = new RegExp(pattern);
    this._has   = new RegexHas  (this._has);
    this._match = new RegexMatch(this._regex);
  }

  Dot(idx) {
    if(idx instanceof obj.String) {
      if(idx.value == "has")
        return this._has;
      else if(idx.value == "match")
        return this._match;
      throw new obj.KeyNotFound(idx.value);
    }
    throw new obj.TypeMismatch(util.format("expect String but get type %s",idx.GetName()));
  }
};

class FuncNewRegex extends obj.UserObject {
  constructor() { super("new_regex"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"new_regex",arg);
    let a1 = arg[0];
    return new Regex(a1.value);
  }
};

class FunctRegexMatch extends obj.UserObject {
  constructor() { super("regex_match"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String],[obj.String]],"regex_match",arg);
    let a1 = arg[0];
    let a2 = arg[1];

    let r  = new RegExp(a1.value);
    let n  = a2.value;
    let res= n.match(r);

    if(res == null)
      return new obj.Null();
    else {
      let ret = new obj.List();
      for( const x of res ) {
        ret.Push(new obj.String(x));
      }
      return ret;
    }
  }
};

// Statistics

class FuncSum extends obj.UserObject {
  constructor() { super("sum"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object]],"sum",arg);
    let a1 = arg[0];
    let has= false;

    if(obj.IsSequence(a1)) {
      let r = 0;
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          r += v.value;
          has = true;
        }
      }
      if(has)
        return new obj.Number(r);
      else
        return new obj.Null();
    }

    throw new obj.TypeMismatch(util.format("function sum's 1st argument must be a " +
                                           "user_object/result_set/list but get type %s",a1.GetName()));
  }
};

class FuncAvg extends obj.UserObject {
  constructor() { super("avg"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object]], "avg", arg);
    let a1 = arg[0];
    if(obj.IsSequence(a1)) {
      let r = 0;
      let cnt=0;
      for ( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          r += v.value;
          cnt++;
        }
      }
      if(cnt ==0)
        return new obj.Null();
      else
        return new obj.Number(r/cnt);
    }
    throw new obj.TypeMismatch(util.format("function avg's 1st argument must be a " +
                                           "user_object/result_set/list but get type %s",a1.GetName()));
  }
};

class FuncMin extends obj.UserObject {
  constructor() { super("min"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object]],"min",arg);
    if(obj.IsSequence(arg[0])) {
      let itr = arg[0].GetIterator();
      let r = 0;
      let has = false;

      if(!itr.HasNext()) return new obj.Null();

      // set the initial value
      for( ; itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          r = v.value;
          has = true;
          break;
        }
      }

      if(!has) return new obj.Null();

      for( ; itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          if(r < v.value) {
            r = v.value;
          }
        }
      }

      return new obj.Number(r);
    }
  }
};

class FuncMax extends obj.UserObject {
  constructor() { super("max"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object]],"max",arg);
    if(obj.IsSequence(arg[0])) {
      let itr = arg[0].GetIterator();
      let r = 0;
      let has = false;

      if(!itr.HasNext()) return new obj.Null();

      // set the initial value
      for( ; itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          r = v.value;
          has = true;
          break;
        }
      }

      if(!has) return new obj.Null();

      for( ; itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        if(v instanceof obj.Number) {
          if(r > v.value) {
            r = v.value;
          }
        }
      }

      return new obj.Number(r);
    }
  }
};

// String helper
class FuncSubstr extends obj.UserObject {
  constructor() { super("substr"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String],[obj.Number],[obj.Number]],"substr",arg);
    return new obj.String(arg[0].value.substr(arg[1].value,arg[2].value));
  }
};

class FuncTrim extends obj.UserObject {
  constructor() { super("trim"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"trim",arg);
    return new obj.String(arg[0].value.trim());
  }
};

class FuncSplit extends obj.UserObject {
  constructor() { super("split"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String],[obj.String]],"split",arg);
    let x = arg[0].value.split(new RegExp(arg[1].value));
    let r = new obj.List();
    for( const e of x ) {
      r.Push( new obj.String(e) );
    }
    return r;
  }
};

class FuncLower extends obj.UserObject {
  constructor() { super("lower"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"lower",arg);
    return new obj.String(arg[0].value.toLowerCase());
  }
};

class FuncUpper extends obj.UserObject {
  constructor() { super("upper"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"upper",arg);
    return new obj.String(arg[0].value.toUpperCase());
  }
};

// Callback related functions
class FuncFilter extends obj.UserObject {
  constructor() { super("filter"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object],[obj.Lambda]],"filter",arg);
    let a1 = arg[0];
    let a2 = arg[1];

    if(_IsMultiSequence(a1)) {
      let res = new obj.List();
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        let r = eng.Invoke(a2,[v]);
        if(obj.ToBoolean(r)) {
          res.Push(v);
        }
      }
      return res;
    }
    throw new obj.TypeMismatch(util.format("function filter expect a list/dict/user_object to "+
                                           "apply filter but get type %s",a1.GetName()));
  }
};

class FuncMap extends obj.UserObject {
  constructor() { super("map"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object],[obj.Lambda]],"map",arg);
    let a1 = arg[0];
    let a2 = arg[1];
    if(_IsMultiSequence(a1)) {
      let res = new obj.List();
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        res.Push(eng.Invoke(a2,[v]));
      }
      return res;
    }
    throw new obj.TypeMismatch(util.format("function map expect a list/dict/user_object to "+
                                           "apply filter but get type %s",a1.GetName()));
  }
};

class FuncReduce extends obj.UserObject {
  constructor() { super("reduce"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object],[obj.Lambda],[Object]],"reduce",arg);
    let a1 = arg[0];
    let a2 = arg[1];
    let a3 = arg[2];

    if(_IsMultiSequence(a1)) {
      let init= a3;
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v = itr.GetValue();
        init  = eng.Invoke(a2,[init,v]);
      }
      return init;
    }
    throw new obj.TypeMismatch(util.format("function reduce expect a list/dict/user_object to "+
                                           "apply filter but get type %s",a1.GetName()));
  }
};

class FuncGroup extends obj.UserObject {
  constructor() { super("group"); }
  Invoke(eng,arg) {
    _CheckArgument([[Object],[obj.Lambda]],"group",arg);
    let a1 = arg[0];
    let a2 = arg[1];
    if(obj.IsSequence(a1)) {
      let result = new obj.Dict();
      for( let itr = a1.GetIterator(); itr.HasNext(); itr.Next() ) {
        let v   = itr.GetValue();
        let key = eng.Invoke(a2,[v]);
        if(key instanceof obj.String) {
          if(result.Has(key)) {
            let temp = result.GetValue(key);
            temp.Push(v);
          } else {
            let temp = new obj.List();
            result.Add(key,temp);
            temp.Push(v);
          }
        } else {
          throw new obj.TypeMismatch("function group expects callback returns a type " +
                                     "String but get %s",key.GetName());
        }
      }
      return result;
    }

    throw new obj.TypeMismatch("function group expects 1st argument to be " +
                               "list/dict/user_object/result_set but get %s",
                               a1.GetName());
  }
};

class FuncRange extends obj.UserObject {
  constructor() { super("range"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.Number],[obj.Number],[obj.Number]],"range",arg);
    let a1 = arg[0];
    let a2 = arg[1];
    let a3 = arg[2];

    let i1 = a1.value;
    let i2 = a2.value;
    let i3 = a3.value;

    if(i2 - (i1 + i3) >= (i2 - i1)) {
      throw new obj.OOB(util.format("function range's input argument forms " +
                                    "inifinit loop, argument(%d,%d,%d)", i1,i2,i3));
    }

    let res = new obj.List();
    for( ; i1 < i2 ; i1 += i3 ) {
      res.Push(new obj.Number(i1));
    }
    return res;
  }
};

class FuncGenList extends obj.UserObject {
  constructor() { super("genlist"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.Number],[obj.Number],[obj.Lambda]],"genlist",arg);
    let a1= arg[0].value;
    let a2= arg[1].value;
    let a3= arg[2];

    let res = new obj.List();
    for( ; a1 < a2 ; ++a1 ) {
      res.Push(eng.Invoke(a3,[new obj.Number(a1)]));
    }
    return res;
  }
};

class FuncGenDict extends obj.UserObject {
  constructor() { super("gendict"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.Number],[obj.Number],[obj.Lambda]],"gendict",arg);
    let a1= arg[0].value;
    let a2= arg[1].value;
    let a3= arg[2];

    let res = new obj.Dict();
    for( ; a1 < a2 ; ++a1 ) {
      let pair = (eng.Invoke(a3,[new obj.Number(a1)]));
      if(pair instanceof obj.Pair) {
        res.AddPair(pair);
      } else {
        throw obj.TypeMismatch(util.format("function gendict expect callback returns " +
                                           "a type Pair object but get %s",pair.GetName()));
      }
    }
    return res;
  }
};

// Loaders -------------------------------------------------------
// Helper function to be used to provide data source. It can be file
// open (via nodejs) or Ajax (run inside of browerser)
class FuncFile extends obj.UserObject {
  constructor() { super("file"); }
  Invoke(eng,arg) {
    _CheckArgument([[obj.String]],"file",arg);
    let a1 = arg[0].value;
    return new obj.String(fs_load(a1));
  }
};

module.exports = {
  Install : function(xx) {
    let ret = {};

    // 1. install all the drivers
    json(ret);
    csv (ret);

    // 2. install all the builtin functions
    ret["type"] = new FuncType();
    ret["str" ] = new FuncStr ();
    ret["num" ] = new FuncNum ();
    ret["int" ] = new FuncInt ();
    ret["list"] = new FuncList();
    ret["dict"] = new FuncDict();
    ret["has" ] = new FuncHas ();
    ret["new_regex"] = new FuncNewRegex();
    ret["regex_match"] = new FunctRegexMatch();

    ret["sum"] = new FuncSum();
    ret["avg"] = new FuncAvg();
    ret["min"] = new FuncMin();
    ret["max"] = new FuncMax();

    ret["substr"] = new FuncSubstr();
    ret["trim"  ] = new FuncTrim  ();
    ret["split" ] = new FuncSplit ();
    ret["lower" ] = new FuncLower ();
    ret["upper" ] = new FuncUpper ();

    ret["range"]   = new FuncRange();
    ret["genlist"] = new FuncGenList();
    ret["gendict"] = new FuncGenDict();
    ret["filter"]  = new FuncFilter();
    ret["map"]     = new FuncMap   ();
    ret["group"]   = new FuncGroup ();
    ret["reduce"]  = new FuncReduce();

    // loaders
    ret["file"]    = new FuncFile();

    return ret;
  }
};
