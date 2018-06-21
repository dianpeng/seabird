// A printer that can print the output into human readable Json or Extended Json
// format

const obj    = require("./object.js");
const assert = require("assert");
const util   = require("util");

const Indentation = "  ";

function EscapeStringLiteral(xx) {
  let buf = [];
  for( const x of xx ) {
    switch(x) {
      case '\t': buf.push("\\"); buf.push("t"); break;
      case '\n': buf.push("\\"); buf.push("n"); break;
      case '\r': buf.push("\\"); buf.push("r"); break;
      case '\\': buf.push("\\"); buf.push("\\");break;
      case '\v': buf.push("\\"); buf.push("v"); break;
      case '\b': buf.push("\\"); buf.push("b"); break;
      case '"' : buf.push("\\"); buf.push('"'); break;
      default: buf.push(x); break;
    }
  }
  return buf.join("");
}

function DoIndent(buf,level) {
  for( let i = 0 ; i < level ; ++i ) {
    buf.push(Indentation);
  }
}

class StrictJSON {
  Print(x) {
    this._output = [];
    this._level  = 0;
    this._PrintNode(x);
    return this._output.join("");
  }
  _BumpIndent() {
    ++this._level;
    this._DoIndent();
  }

  _DoIndent() {
    DoIndent(this._output,this._level);
  }

  _PrintNumber(x) {
    this._output.push(util.format("%d",x.value));
  }

  _PrintBoolean(x) {
    this._output.push(util.format("%s",x.value ? "true":"false"));
  }

  _PrintNull(x) {
    this._output.push(util.format("null"));
  }

  _PrintString(x) {
    this._output.push("\"");
    this._output.push(EscapeStringLiteral(x.value));
    this._output.push("\"");
  }

  // Structurize type print
  _PrintIterable(x,start,end) {

    let itr = x.GetIterator();
    if(!itr.HasNext()) {
      this._output.push(util.format("%s%s\n",start,end));
      this._DoIndent();
    } else {
      this._level++;

      this._output.push(util.format("%s\n",start));
      this._DoIndent();

      do {

        this._PrintNode(itr.GetValue());

        itr.Next();
        if(itr.HasNext()) {
          this._output.push(",\n");
          this._DoIndent();
        } else {
          this._output.push("\n");
          this._level--;
          this._DoIndent();
          this._output.push(end);
          break;
        }
      } while(true);
    }
  }

  _PrintPair(x) {
    this._PrintNode(x.key);
    this._output.push(":");
    this._PrintNode(x.value);
  }

  _PrintNode(x) {
    if(x instanceof obj.Number)  return this._PrintNumber(x);
    if(x instanceof obj.String)  return this._PrintString(x);
    if(x instanceof obj.Null  )  return this._PrintNull  (x);
    if(x instanceof obj.Boolean) return this._PrintBoolean(x);
    if(x instanceof obj.Pair)    return this._PrintPair(x);
    if(x instanceof obj.List)    return this._PrintIterable(x,"[","]");
    if(x instanceof obj.Dict)    return this._PrintIterable(x,"{","}");
    if(obj.IsInheritFrom(x,obj.ResultSet))
      return this._PrintIterable(x,"[","]");

    if(x instanceof obj.UserObject) return this._output.push(x.Print(this._level));
    assert(false,typeof x);
  }
};

class ExtendedJSON extends StrictJSON {
  _PrintPair(x) {
    this._output.push("(");
    this._PrintNode(x.key);
    this._output.push(":");
    this._PrintNode(x.value);
    this._output.push(")");
  }
};


module.exports = {
  StrictJSON   : StrictJSON,
  ExtendedJSON : ExtendedJSON,
  EscapeStringLiteral : EscapeStringLiteral,
  DoIndent : DoIndent
};
