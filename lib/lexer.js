const util = require("./port/util.js");

class Token {
  // arithmetic operator
  static get Add() { return 1; }
  static get Sub() { return 2; }
  static get Mul() { return 3; }
  static get Div() { return 4; }
  static get Mod() { return 61;} // add this one later
  static get Gt () { return 5; }
  static get Ge () { return 6; }
  static get Lt () { return 7; }
  static get Le () { return 8; }
  static get Eq () { return 9; }
  static get Ne () { return 10; }

  // punctual
  static get Comma    () { return 11; }
  static get Semicolon() { return 12; }
  static get Colon    () { return 13; }
  static get LPar     () { return 14; }
  static get RPar     () { return 15; }
  static get LSqr     () { return 16; }
  static get RSqr     () { return 17; }
  static get LBra     () { return 18; }
  static get RBra     () { return 19; }
  static get Dollar   () { return 20; }
  static get Assign   () { return 21; }
  static get Predicate() { return 22; }
  static get Rewrite  () { return 23; }
  static get Dot      () { return 24; }

  // logical
  static get And      () { return 25; }
  static get Or       () { return 26; }
  static get Not      () { return 27; }

  // wildcard
  static get Wildcard () { return 28; }

  // keywords
  static get Let      () { return 30; }
  static get True     () { return 31; }
  static get False    () { return 32; }
  static get If       () { return 33; }
  static get Else     () { return 34; }
  static get Fn       () { return 35; }
  static get Null     () { return 36; }
  static get This     () { return 37; }

  // constant
  static get Number   () { return 41; }
  static get Variable () { return 42; }
  static get Attribute() { return 43; }
  static get String   () { return 44; }

  // rest
  static get Eof      () { return 51; }

  static GetTokenName(tk) {
    switch(tk) {
      case Token.Add:       return "+";
      case Token.Sub:       return "-";
      case Token.Mul:       return "*";
      case Token.Div:       return "/";
      case Token.Ge :       return ">=";
      case Token.Gt :       return ">";
      case Token.Lt :       return "<";
      case Token.Le :       return "<=";
      case Token.Eq :       return "==";
      case Token.Ne :       return "!=";
      case Token.And:       return "&&";
      case Token.Or:        return "||";
      case Token.Not:       return "!";
      case Token.Comma:     return ",";
      case Token.Semicolon: return ";";
      case Token.Colon:     return ":";
      case Token.LPar:      return "(";
      case Token.RPar:      return ")";
      case Token.LBra:      return "{";
      case Token.RBra:      return "}";
      case Token.LSqr:      return "[";
      case Token.RSqr:      return "]";
      case Token.Predicate: return "[?";
      case Token.Rewrite:   return "[|";
      case Token.Dot:       return ".";
      case Token.Wildcard:  return "**";
      case Token.Dollar:    return "$";
      case Token.Assign:    return "=";
      case Token.True:      return "true";
      case Token.False:     return "false";
      case Token.If:        return "if";
      case Token.Else:      return "else";
      case Token.Fn:        return "fn";
      case Token.Null:      return "null";
      case Token.Let:       return "let";
      case Token.Number:    return "<number>";
      case Token.Variable:  return "<variable>";
      case Token.Attribute: return "<attribute>";
      case Token.String:    return "<string>";
      case Token.Eof:       return "<eof>";
      default:
        return "";
    }
  }
};

class Lexeme {
  constructor() {
    this.length = 0;
    this.number = 0;
    this.text   = "";
  }
};

class Position {
  constructor( source , start , end ) {
    this.source = source;
    this.start  = start;
    this.end    = end;
  }

  GetCodeSnippet() {
    return this.source.substr(this.start,this.end-this.start);
  }
};

class Lexer {
  constructor(source) {
    this.source = source;
    this.line   = 1;
    this.ccount = 1;
    this.cursor = 0;
    this.lexeme = new Lexeme();
  }

  GetToken() {
    return this.lexeme.token;
  }

  GetTokenName() {
    return Token.GetTokenName(this.lexeme.token);
  }

  GetTokenPosition() {
    return this.cursor - this.lexeme.length;
  }

  _NewLexeme(tk , length, offset) {
    this.lexeme.token = tk;
    this.lexeme.length= length;
    this.cursor += offset;
    this.ccount += length;
    return this.lexeme;
  }

  _Predicate1(lookahead , tk1 , tk2) {
    if (this.cursor+1 < this.source.length) {
      let c = this.source.charAt(this.cursor + 1);
      if (c == lookahead) {
        return this._NewLexeme(tk2, 2, 2);
      }
    }
    return this._NewLexeme(tk1,1,1);
  }

  _Predicate2(l1,l2,tk1,tk2,tk3) {
    if(this.cursor+1 < this.source.length) {
      let c = this.source.charAt(this.cursor+1);
      if(c == l1) return this._NewLexeme(tk2,2,2);
      if(c == l2) return this._NewLexeme(tk3,2,2);
    }

    return this._NewLexeme(tk1,1,1);
  }

  _Expect(lookahead,tk) {
    if(this.cursor+1 < this.source.length) {
      let c = this.source.charAt(this.cursor+1);
      if(c == lookahead) {
        return this._NewLexeme(tk,2,2);
      }
    }
    this._Error(util.format("unrecognized token here, did you mean token %s?", Token.GetTokenName(tk)));
  }

  _Error(msg) {
    throw util.format("At (%d,%d) has an error:%s\n%s",this.line,this.ccount,msg,new Error().stack);
  }

  Next() {
    while(this.cursor < this.source.length) {
      let c = this.source.charAt(this.cursor);
      switch(c) {
        case ' ' :
        case '\t':
        case '\r':
        case '\b':
          ++this.ccount;
          ++this.cursor;
          break;
        case '\n':
          ++this.cursor;
          ++this.line;
          this.ccount = 1;
          break;
        case "#" : this._LexComment(); break;
        case "+" : return this._NewLexeme( Token.Add, 1, 1);
        case "-" : return this._NewLexeme( Token.Sub, 1, 1);
        case "*" : return this._Predicate1( "*" , Token.Mul, Token.Wildcard );
        case "/" : return this._NewLexeme( Token.Div, 1, 1);
        case "%" : return this._NewLexeme( Token.Mod, 1, 1);
        case ">" : return this._Predicate1( "=" , Token.Gt, Token.Ge );
        case "<" : return this._Predicate1( "=" , Token.Lt, Token.Le );
        case "=" : return this._Predicate1( "=" , Token.Assign , Token.Eq );
        case "!" : return this._Predicate1( "=" , Token.Not, Token.Ne );
        case "&" : return this._Expect    ( "&" , Token.And );
        case "|" : return this._Expect    ( "|" , Token.Or  );
        case "." : return this._NewLexeme( Token.Dot  , 1, 1);
        case "," : return this._NewLexeme( Token.Comma, 1, 1);
        case ":" : return this._NewLexeme( Token.Colon, 1, 1);
        case ";" : return this._NewLexeme( Token.Semicolon , 1, 1);
        case "(" : return this._NewLexeme( Token.LPar , 1, 1);
        case ")" : return this._NewLexeme( Token.RPar , 1, 1);
        case "[" : return this._Predicate2( "|" , "?" , Token.LSqr     ,
                                                        Token.Rewrite  ,
                                                        Token.Predicate );
        case "]" : return this._NewLexeme( Token.RSqr , 1, 1);
        case "{" : return this._NewLexeme( Token.LBra , 1, 1);
        case "}" : return this._NewLexeme( Token.RBra , 1, 1);
        case "$" : return this._NewLexeme( Token.Dollar, 1, 1);
        case "\"": return this._LexString();
        case "0" : case "1" : case "2" : case "3" : case "4" :
        case "5" : case "6" : case "7" : case "8" : case "9" :
          return this._LexNumber();
        default:
          return this._LexVariableOrKeyword(c);
      }
    }

    return this._NewLexeme(Token.Eof,0,0);
  }

  _LexComment() {
    for( ++this.cursor; this.cursor < this.source.length ; ++this.cursor ) {
      let c = this.source.charAt(this.cursor);
      if(c == '\n') break;
    }

    if(this.cursor < this.source.length) {
      ++this.cursor;
    }
  }

  _LexString() {
    let buf = [];
    let c   = "a";
    let start = this.cursor;

    for( ++this.cursor ; this.cursor < this.source.length ; ++this.cursor ) {
      c  = this.source.charAt(this.cursor);
      if(c == "\\") {
        if(this.cursor + 1 == this.source.length) {
          this._Error("string literal not properly closed");
        }
        let nc = this.source.charAt(this.cursor+1);
        switch(nc) {
          case "\\": buf.push("\\"); ++this.cursor; break;
          case "\"": buf.push("\""); ++this.cursor; break;
          case "t" : buf.push("\t"); ++this.cursor; break;
          case "b" : buf.push("\b"); ++this.cursor; break;
          case "r" : buf.push("\r"); ++this.cursor; break;
          case "n" : buf.push("\n"); ++this.cursor; break;
          case "v" : buf.push("\v"); ++this.cursor; break;
          default:
            this._Error(util.format("unknown escape character %s",nc));
            break;
        }
      } else {
        if(c == "\"") break;
        buf.push(c);
      }
    }

    if(c != "\"") {
      return this._Error("string literal not properly closed");
    } else {
      ++this.cursor;
    }

    this.lexeme.token = Token.String;
    this.lexeme.text  = buf.join("");
    this.lexeme.length= (this.cursor - start);
    return this.lexeme;
  }

  _LexNumber() {
    let buf   = [];
    let start = this.cursor;
    const StWantDigitOnly      = 0;
    const StWantDotOrDigitOrEof= 1;
    const StWantDigitOrEof     = 2;

    let st = StWantDotOrDigitOrEof;

    for( ; this.cursor < this.source.length ; ++this.cursor ) {
      let c = this.source.charAt(this.cursor);
      if(st == StWantDigitOnly) {
        if (!this._IsDigit(c))     this._Error("expect a digit here");
        st = StWantDigitOrEof;
      } else if(st == StWantDigitOrEof) {
        if (!this._IsDigit(c)) break;
      } else {
        if(c == ".") {
          st = StWantDigitOnly;
        } else if(!this._IsDigit(c)) {
          break;
        }
      }

      buf.push(c);
    }

    if(st == StWantDigitOnly) {
      this._Error("number is not complete");
    }

    this.lexeme.number = parseFloat(buf.join(""));
    this.lexeme.length = (this.cursor - start);
    this.lexeme.token  = Token.Number;
    return this.lexeme;
  }

  _IsAlpha (c) {
    const letters = /^[A-Za-z]$/;
    return c.match(letters);
  }

  _IsDigit (c) {
    const digit = /^[0-9]$/;
    return c.match(digit);
  }

  _IsIdChar(c) {
    return this._IsAlpha(c) || c == "_";
  }

  _IsIdRestChar(c) {
    return this._IsIdChar(c) || this._IsDigit(c);
  }

  _MatchKeyword(start,kw) {
    const elen = kw.length;
    for( let i = 0 ; i < elen ; ++i ) {
      if((i+start) == this.source.length) return false;
      let c = this.source.charAt(i+start);
      if(c != kw.charAt(i)) return false;
    }

    // lastly check the trailing character
    if(elen + start < this.source.length) {
      return !this._IsIdRestChar(this.source.charAt(elen+start));
    }

    return true;
  }

  _LexVariable(c) {
    let start = this.cursor;
    let buf = [c];
    for( ++this.cursor ; this.cursor < this.source.length ; ++this.cursor ) {
      let c = this.source.charAt(this.cursor);
      if(!this._IsIdRestChar(c)) break;
      buf.push(c);
    }

    this.lexeme.token = Token.Variable;
    this.lexeme.length= (this.cursor - start);
    this.lexeme.text  = buf.join("");
    return this.lexeme;
  }

  _LexAttribute(c) {
    let buf = [c];
    ++this.cursor;
    if(!this._IsIdRestChar(this.source.charAt(this.cursor))) {
      this._Error("at least one valid identifier character should follow @ for attribute");
    }
    let lexer = this._LexVariable(this.source.charAt(this.cursor));
    lexer.token = Token.Attribute;
    lexer.length += 1;
    return lexer;
  }

  _LexVariableOrKeyword(c) {
    switch(c) {
      case "t":
        if(this._MatchKeyword(this.cursor+1,"rue"))
          return this._NewLexeme(Token.True,4,4);
        if(this._MatchKeyword(this.cursor+1,"his"))
          return this._NewLexeme(Token.This,4,4);
        break;
      case "f":
        if(this._MatchKeyword(this.cursor+1,"n"))
          return this._NewLexeme(Token.Fn,2,2);
        if(this._MatchKeyword(this.cursor+1,"alse"))
          return this._NewLexeme(Token.False,5,5);
        break;
      case "n":
        if(this._MatchKeyword(this.cursor+1,"ull"))
          return this._NewLexeme(Token.Null,4,4);
        break;
      case "i":
        if(this._MatchKeyword(this.cursor+1,"f"))
          return this._NewLexeme(Token.If,2,2);
        break;
      case "e":
        if(this._MatchKeyword(this.cursor+1,"lse"))
          return this._NewLexeme(Token.Else,4,4);
        break;
      case "l":
        if(this._MatchKeyword(this.cursor+1,"et"))
          return this._NewLexeme(Token.Let,3,3);
        break;
      default:
        break;
    }

    if(this._IsIdChar(c))
      return this._LexVariable(c);
    else if(c == "@")
      return this._LexAttribute(c);

    return this._Error(util.format("unknown character %s seen here",c));
  }
};

module.exports = {
  Position : Position,
  Token : Token ,
  Lexeme: Lexeme,
  Lexer : Lexer
};
