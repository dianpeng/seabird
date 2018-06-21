// Driver for JSON object, parse a JSON into a Seabird recognized format
const obj     = require("../object.js");
const printer = require("../printer.js");
const util    = require("../port/util.js");
const assert  = require("../port/assert.js");
const loader  = require("../port/loader.js");

function _New(x) {
  // check the type of value after the JSON parsing
  if(x instanceof Object) {
    // only possible are [] or {}
    if(x.constructor.name == "Object") {
      // this is a JSON object
      return new JSONObject(x);
    } else {
      return new JSONArray (x);
    }
  } else {
    if(typeof x == "string") return new obj.String(x);
    if(typeof x == "number") return new obj.Number(x);
    if(typeof x == "boolean")return new obj.Boolean(x);
    if(typeof x == "object") return new obj.Null();
  }

  // should never reach here
  assert(false,typeof x);
}

function _DoPrint(x,l) {
  if(x instanceof JSONObject) {
    return x.Print(l);
  }
  if(x instanceof JSONArray) {
    return x.Print(l);
  }
  if(x instanceof Object) {
    if(x.constructor.name == "Object") {
      return new JSONObject(x).Print(l);
    } else {
      return new JSONArray(x).Print(l);
    }
  } else {
    if(typeof x == "string") {
      return ("\"" + printer.EscapeStringLiteral(x) + "\"");
    } else if(typeof x == "number") {
      return (util.format("%d",x));
    } else if(typeof x == "boolean") {
      return (x ? "true" : "false");
    } else if(typeof x == "object") {
      return "null";
    }

  }

  assert(false,typeof x);
}

// This function *reconstruct* the old JSON into the new *new seabird model*
class JSONObjectIterator {
  constructor(obj) {
    this._entries = Object.entries(obj);
    this._cursor  = 0;
  }

  HasNext() { return this._cursor < this._entries.length; }
  Next   () { ++this._cursor; }
  GetValue(){ return new obj.Pair(_New(this._entries[this._cursor][0]),
                                  _New(this._entries[this._cursor][1])); }
};

class JSONObject extends obj.UserObject {
  constructor(obj) {
    super("JSONObject");
    this._obj = obj;
  }

  _GetSize() { return Object.keys(this._obj).length; }

  Dot(idx) {
    if(idx instanceof obj.String) {
      if(idx.value in this._obj) {
        return _New(this._obj[idx.value]);
      }
      throw new obj.KeyNotFound(idx.value);
    }
    throw new obj.TypeMismatch("expect String but get %s",idx.GetName());
  }

  Index(idx) {
    return this.Dot(idx);
  }

  GetAttribute(x) {
    if(x instanceof obj.String) {
      if(x.value == "size") {
        return new obj.Number(this._GetSize());
      } else if(x.value == "empty") {
        return new obj.Boolean(this._GetSize() != 0);
      } else if(x.value == "type") {
        return new obj.String("JSONObject");
      }
      throw new obj.NoAttribute(util.format("no such attribute %s found in type JSONObject",x.value));
    }
    throw new obj.TypeMismatch(util.format("expect String but get %s",x.GetName()));
  }

  GetIterator() {
    return new JSONObjectIterator(this._obj);
  }

  Print(l) {
    ++l;
    let buf = ["{\n"];
    printer.DoIndent(buf,l);

    let idx = 0;
    let len = Object.entries(this._obj).length;
    for( const x in this._obj ) {
      buf.push("\"" + printer.EscapeStringLiteral(x) + "\"");
      buf.push(":");
      buf.push(_DoPrint(this._obj[x],l));

      if(idx == len - 1) {
        buf.push("\n");
        --l
        printer.DoIndent(buf,l);
      } else {
        buf.push(",\n");
        printer.DoIndent(buf,l);
      }

      ++idx;
    }
    buf.push("}");
    return buf.join("");
  }
};

class JSONArrayIterator {
  constructor(obj) {
    this._arr = obj;
    this._cursor = 0;
  }

  HasNext() { return this._cursor < this._arr.length; }
  Next   () { ++this._cursor; }
  GetValue(){ return _New(this._arr[this._cursor]); }
};

class JSONArray extends obj.UserObject {
  constructor(obj) {
    super("JSONArray");
    this._arr = obj;
  }

  Index(idx) {
    if(idx instanceof obj.Number) {
      if(idx.value < this._arr.length) {
        return _New(this._arr[idx.value]);
      }
      throw new obj.OOB(util.format("oob access for JSONArray with length:%d and index:%d",this._arr.length,idx.value));
    }
    throw new obj.TypeMismatch(util.format("expect Number but get %s",x.GetName()));
  }

  Slice(start,end,stride) {
    if(start instanceof obj.Number && end instanceof obj.Number && stride instanceof obj.Number) {
      let sidx = start.value;
      let eidx = end.value;
      let stidx= stride.value;

      // check whether a infinit loop
      if(eidx - (sidx + stidx) >= eidx - sidx) {
        throw new SliceOOB("the slice index specified forms an infinit loop");
      }

      let res = new obj.List();
      for( ; sidx < eidx ; sidx += stidx ) {
        res.push(this._arr[sidx]);
      }
      return res;
    }
    throw new TypeMismatch(util.format("expect Number for all 3 slice arguments , but get type (%s,%s,%s)",
                                       start.GetName(),end.GetName(),stride.GetName()));

  }

  GetAttribute(x) {
    if(x instanceof obj.String) {
      if(x.value == "size") {
        return new obj.Number(this._arr.length);
      } else if(x.value == "empty") {
        return new obj.Boolean(this._arr.length == 0);
      } else if(x.value == "type") {
        return new obj.String("JSONArray");
      }
      throw new obj.NoAttribute(util.format("no such attribute %s found in type JSONArray",x.value));
    }
    throw new obj.TypeMismatch(util.format("expect String but get %s",x.GetName()));
  }

  GetIterator() {
    return new JSONArrayIterator(this._arr);
  }

  Print(l) {
    ++l;
    let buf = ["[\n"];
    printer.DoIndent(buf,l);

    let idx = 0;
    for(const x of this._arr) {
      buf.push(_DoPrint(x,l));
      if(idx == this._arr.length - 1) {
        buf.push("\n");
        --l;
        printer.DoIndent(buf,l);
      } else {
        buf.push(",\n");
        printer.DoIndent(buf,l);
      }

      ++idx;
    }
    buf.push("]");
    return buf.join("");
  }
};

class JSONDriver extends obj.UserObject {
  constructor() {
    super("JSON");
  }
  Invoke(e,arg) {
    if(arg.length != 1) {
      throw new obj.FunctionArgumentNumberMismatch(
        util.format("mismatch argument count,JSON function requires 1 string argument"));
    }

    if(arg[0] instanceof obj.String) {
      return _New(JSON.parse(loader(arg[0].value)));
    }
    throw new obj.TypeMismatch(
      util.format("expect String as 1st argument for function JSON but get type %s",arg[0].GetName()));
  }
};

module.exports = function(buf) {
  buf["JSON"] = new JSONDriver();
};
