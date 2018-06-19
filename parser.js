// parser for seabird grammar, check the README.md to see the full grammar
const ast   = require("./ast.js");
const lexer = require("./lexer.js");
const util  = require("util");
const assert= require("assert");

class Parser {
  // helper function to generate the position object
  _MoveAndNewPosition(start) {
    this.lexer.Next();
    return new lexer.Position(this.lexer.source, start,this.lexer.GetTokenPosition());
  }

  _NewPosition(start) {
    return new lexer.Position(this.lexer.source,start,this.lexer.GetTokenPosition());
  }

  _NewPosition2(start,end) {
    return new lexer.Position(this.lexer.source,start,end);
  }

  _Error(msg) {
    throw util.format("parser failed at (%d,%d) with error:%s\n%s",this.lexer.line,
                                                                   this.lexer.ccount,msg,
                                                                   new Error().stack);
  }

  _Expect(tk) {
    if(this.lexer.lexeme.token != tk) {
      this._Error(util.format("expect %s here,but get %s",lexer.Token.GetTokenName(tk),
                                                          this.lexer.GetTokenName()));
    }
  }

  _MoveAndExpect(tk) {
    this.lexer.Next();
    this._Expect(tk);
  }

  // private methods for parsing each stuff
  _ParseList() {
    let start_pos = this.lexer.GetTokenPosition();
    this.lexer.Next();
    if(this.lexer.GetToken() == lexer.Token.RSqr) {
      return new ast.List([],this._MoveAndNewPosition(start_pos));
    } else {
      let list = [];
      do {
        let expr = this._ParseExpression();
        list.push(expr);

        if(this.lexer.GetToken() == lexer.Token.Comma) {
          this.lexer.Next();
        } else if(this.lexer.GetToken() == lexer.Token.RSqr) {
          this.lexer.Next();
          break;
        } else {
          this._Error("expect \"]\" or \",\" here");
        }
      } while(true);
      return new ast.List(list,this._NewPosition(start_pos));
    }
  }

  _ParsePairOrSubExpr() {
    let start_pos = this.lexer.GetTokenPosition();

    this.lexer.Next();
    if(this.lexer.GetToken() == lexer.Token.RPar) {
      this._Error("empty sub-expression or pair expression ?");
    }

    let first = this._ParseExpression();
    if(this.lexer.GetToken() == lexer.Token.Colon) {
      this.lexer.Next();
      let second = this._ParseExpression();
      return new ast.Pair(first,second,this._MoveAndNewPosition(start_pos));
    } else {
      this._Expect(lexer.Token.RPar);
      this.lexer.Next();
      return first;
    }
  }

  _ParseDict() {
    let start_pos = this.lexer.GetTokenPosition();
    this.lexer.Next();
    if(this.lexer.GetToken() == lexer.Token.RBra) {
      return new ast.Dict([],this._MoveAndNewPosition(start_pos));
    } else {
      let dict = [];

      do {
        let pair_start_pos = this.lexer.GetTokenPosition();
        // key
        let key = this._ParseExpression();
        // colon
        this._Expect(lexer.Token.Colon);
        this.lexer.Next();
        // value
        let val = this._ParseExpression();

        dict.push(new ast.Pair(key,val,this._NewPosition(pair_start_pos)));

        if(this.lexer.GetToken() == lexer.Token.Comma) {
          this.lexer.Next();
        } else if(this.lexer.GetToken() == lexer.Token.RBra) {
          this.lexer.Next();
          break;
        } else {
          this._Error("expect \"}\" or \",\" here");
        }
      } while(true);

      return new ast.Dict(dict,this._NewPosition(start_pos));
    }
  }

  _ParseFunction() {
    let start_pos = this.lexer.GetTokenPosition();

    this.lexer.Next();
    this._Expect(lexer.Token.LPar);
    this.lexer.Next();

    let arg = [];

    // Parsing function's argument list
    if(this.lexer.GetToken() != lexer.Token.RPar) {
      do {
        let arg_start_pos = this.lexer.GetTokenPosition();
        this._Expect(lexer.Token.Variable);
        arg.push(this.lexer.lexeme.text);
        this.lexer.Next();

        if(this.lexer.GetToken() == lexer.Token.Comma) {
          this.lexer.Next();
        } else if(this.lexer.GetToken() == lexer.Token.RPar) {
          this.lexer.Next();
          break;
        } else {
          this._Error("expect \",\" or \")\" here");
        }
      } while(true);
    } else {
      this.lexer.Next();
    }
    // function body
    let body = this._ParseExpression();
    return new ast.Function(arg,body,this._NewPosition(start_pos));
  }

  _ParsePrimary() {
    let start = this.lexer.GetTokenPosition();
    let value = null;
    switch(this.lexer.GetToken()) {
      // Constant
      case lexer.Token.Number:
        value = this.lexer.lexeme.number;
        return new ast.Number(value,this._MoveAndNewPosition(start));
      case lexer.Token.True:
        return new ast.Boolean(true,this._MoveAndNewPosition(start));
      case lexer.Token.False:
        return new ast.Boolean(false,this._MoveAndNewPosition(start));
      case lexer.Token.Null:
        return new ast.Null(this._MoveAndNewPosition(start));
      case lexer.Token.String:
        value = this.lexer.lexeme.text;
        return new ast.String(value,this._MoveAndNewPosition(start));
      // Identifier
      case lexer.Token.Variable:
        value = this.lexer.lexeme.text;
        return new ast.Variable(value,this._MoveAndNewPosition(start));
      case lexer.Token.Attribute:
        value = this.lexer.lexeme.text;
        return new ast.Attribute(value,this._MoveAndNewPosition(start));
      case lexer.Token.This:
        return new ast.This(this._MoveAndNewPosition(start));
      case lexer.Token.Dot:
        // shortcut to write `this` reference
        return new ast.This(this._NewPosition2(start,this.lexer.cursor));
      case lexer.Token.Dollar:
        return new ast.Dollar(this._MoveAndNewPosition(start));
      // Compound
      case lexer.Token.LSqr:
        return this._ParseList();
      case lexer.Token.LPar:
        return this._ParsePairOrSubExpr();
      case lexer.Token.LBra:
        return this._ParseDict();
      // function
      case lexer.Token.Fn:
        return this._ParseFunction();
      default:
        this._Error("expect a valid primary expression");
    }
  }

  _ParseIndex() {
    let start_pos = this.lexer.GetTokenPosition();

    let first = this._ParseExpression();
    let end   = null;
    let stride= null;

    if(this.lexer.GetToken() == lexer.Token.Colon) {
      this.lexer.Next();
      end = this._ParseExpression();
      if(this.lexer.GetToken() == lexer.TokenColon) {
        this.lexer.Next();
        stride = this._ParseExpression();
      }
    }

    let pos = this._NewPosition(start_pos);
    return new ast.Slice(first,end,stride,pos);
  }

  _ParsePrefix() {
    let start_pos = this.lexer.GetTokenPosition();
    let primary = this._ParsePrimary();
    let rest    = [];
    let pos     = null;

  prefix:
    do {
      switch(this.lexer.GetToken()) {
        case lexer.Token.Dot:
          switch(this.lexer.Next().token) {
            case lexer.Token.Variable:
              {
                let name = this.lexer.lexeme.text;
                pos      = this._NewPosition(start_pos);
                rest.push(ast.PrefixComponent.NewDot(new ast.Variable(name,pos),pos));
              }
              break;
            case lexer.Token.Mul:
              pos = this._NewPosition(start_pos);
              rest.push(ast.PrefixComponent.NewDot(new ast.Foreach(pos),pos));
              break;
            case lexer.Token.Wildcard:
              pos = this._NewPosition(start_pos);
              rest.push(ast.PrefixComponent.NewDot(new ast.Wildcard(pos),pos));
              break;
            default:
              assert(false);
              break;
          }

          this.lexer.Next();
          break;
        case lexer.Token.LSqr:
          {
            this.lexer.Next();
            let expr = this._ParseIndex();
            pos = this._NewPosition(start_pos);
            rest.push(ast.PrefixComponent.NewIndex(expr,pos));
            this._Expect(lexer.Token.RSqr);
            this.lexer.Next();
          }
          break;
        case lexer.Token.Predicate:
        case lexer.Token.Rewrite:
          {
            this.lexer.Next();
            let expr = this._ParseExpression();
            pos = this._NewPosition(start_pos);
            rest.push(ast.PrefixComponent.NewIndex(expr,pos));
            this._Expect(lexer.Token.RSqr);
            this.lexer.Next();
          }
          break;
        case lexer.Token.LPar:
          {
            // function call
            let call_arg = [];
            this.lexer.Next();
            while(this.lexer.GetToken() != lexer.Token.RPar) {
              let a = this._ParseExpression();
              call_arg.push(a);
              if(this.lexer.GetToken() == lexer.Token.Comma) {
                this.lexer.Next();
              } else if(this.lexer.GetToken() != lexer.Token.RPar) {
                this._Error("expect \",\" or \")\" when call a function");
              }
            }
            pos = this._NewPosition(start_pos);
            rest.push(ast.PrefixComponent.NewCall(call_arg,pos));
            this.lexer.Next();
          }
          break;
        default:
          break prefix;
      }
    } while(true);

    if(rest.length == 0)
      return primary;
    else
      return new ast.Prefix(primary,rest,this._NewPosition(start_pos));
  }

  _IsUnaryOperator() {
    return this.lexer.GetToken() == lexer.Token.Sub ||
           this.lexer.GetToken() == lexer.Token.Not;
  }

  _ParseUnary() {
    if(this._IsUnaryOperator()) {
      let op = this.lexer.GetToken();
      let start_pos = this.lexer.GetTokenPosition();
      this.lexer.Next();
      let expr = this._ParseUnary();
      return new ast.Unary(op,expr,this._NewPosition(start_pos));
    } else {
      return this._ParsePrefix();
    }
  }

  // precedence attached for each operators
  _GetBinOpPrecedence(op) {
    switch(op) {
      case lexer.Token.Or :
        return 6;
      case lexer.Token.And:
        return 5;

      case lexer.Token.Gt:
      case lexer.Token.Ge:
      case lexer.Token.Lt:
      case lexer.Token.Le:
        return 4;
      case lexer.Token.Eq:
      case lexer.Token.Ne:
        return 3;
      case lexer.Token.Add:
      case lexer.Token.Sub:
        return 2;
      case lexer.Token.Mul:
      case lexer.Token.Div:
        return 1;
      default:
        return 0;
    }
  }

  _GetMaxOpPrecedence() {
    return 6;
  }

  _IsBinaryOperator() {
    switch(this.lexer.GetToken()) {
      case lexer.Token.Or:
      case lexer.Token.And:
      case lexer.Token.Gt:
      case lexer.Token.Ge:
      case lexer.Token.Lt:
      case lexer.Token.Le:
      case lexer.Token.Eq:
      case lexer.Token.Ne:
      case lexer.Token.Add:
      case lexer.Token.Sub:
      case lexer.Token.Mul:
      case lexer.Token.Div:
        return true;
      default:
        return false;
    }
  }

  _ParseBinaryExpr(precedence) {
    if(precedence == 0) {
      return this._ParseUnary();
    } else {
      let start_pos = this.lexer.GetTokenPosition();
      let expr = this._ParseBinaryExpr(precedence-1);
      while(this._IsBinaryOperator()) {
        let prece = this._GetBinOpPrecedence(this.lexer.GetToken());
        if(prece == precedence) {
          let op = this.lexer.GetToken();
          this.lexer.Next();
          // climbing down hills
          let rhs = this._ParseBinaryExpr(precedence-1);
          expr = new ast.Binary(op,expr,rhs,this._NewPosition(start_pos));
        } else {
          // the caller must be able to handle it
          break;
        }
      }
      return expr;
    }
  }

  _ParseBinary() { return this._ParseBinaryExpr(this._GetMaxOpPrecedence()); }

  _ParseTernary() {
    let start_pos = this.lexer.GetTokenPosition();
    let first = this._ParseBinary();
    if(this.lexer.GetToken() == lexer.Token.If) {
      this.lexer.Next();
      let cond = this._ParseBinary();
      this._Expect(lexer.Token.Else);
      this.lexer.Next();
      let second = this._ParseBinary();
      return new ast.Ternary(cond,first,second,this._NewPosition(start_pos));
    }
    return first;
  }

  _ParseExpression() { return this._ParseTernary(); }

  // scopes
  _ParseLet() {
    let start_pos = this.lexer.GetTokenPosition();
    this.lexer.Next();
    let vars = [];

    do {
      let define_start_pos = this.lexer.GetTokenPosition();
      this._Expect(lexer.Token.Variable);
      let name = this.lexer.lexeme.text;
      this._MoveAndExpect(lexer.Token.Assign);
      this.lexer.Next();
      let value = this._ParseExpression();
      vars.push(new ast.Define(name,value,this._NewPosition(define_start_pos)));

      if(this.lexer.GetToken() == lexer.Token.Comma) {
        this.lexer.Next();
      } else if(this.lexer.GetToken() == lexer.Token.Semicolon) {
        this.lexer.Next();
        break;
      } else {
        this._Error("expect \",\" or \";\" here");
      }
    } while(true);

    return new ast.Let( vars , this._NewPosition(start_pos) );
  }

  _ParseProgram() {
    let defines = null;
    let start_pos = this.lexer.GetTokenPosition();
    if(this.lexer.GetToken() == lexer.Token.Let) {
      defines = this._ParseLet();
    }
    if(defines == null) {
      defines = new ast.Let([],this._NewPosition(start_pos));
    }

    if(this.lexer.GetToken() == lexer.Token.Eof) {
      this._Error("empty program");
    }

    let query = this._ParseExpression();

    if(this.lexer.GetToken() != lexer.Token.Eof) {
      this._Error("dangling expression after the query!");
    }

    return new ast.Program(defines,query,this._NewPosition(start_pos));
  }

  Parse( source ) {
    this.lexer = new lexer.Lexer(source);
    this.lexer.Next();
    return this._ParseProgram();
  }
};

module.exports = function(source) {
  return new Parser().Parse(source);
};
