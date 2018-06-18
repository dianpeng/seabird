// parser for seabird grammar, check the README.md to see the full grammar
const ast   = require("./ast.js");
const lexer = require("./lexer.js");

class Parser {
  constructor( source ) {
    this.lexer = new lexer.Lexer(source);
  }

  // helper function to generate the position object
  _MoveAndNewPosition(start) {
    this.lexer.Next();
    return new lexer.Position(this.lexer.source, start,this.lexer.GetTokenPosition());
  }

  // private methods for parsing each stuff
  _ParsePrimary() {
    let start = this.lexer.GetTokenPosition();
    switch(this.lexer.GetToken()) {
      case lexer.Token.Integer:
        let value = this.lexer.lexeme.number;
        return new ast.Number(value,this._MoveAndNewPosition(start));
      case lexer.Token.True:
        return new ast.Boolean(true,this._MoveAndNewPosition(start));
      case lexer.Token.False:
        return new ast.Boolean(false,this._MoveAndNewPosition(start));
      case lexer.Token.Null:
        return new ast.Null(this._MoveAndNewPosition(start));
      case lexer.Token.String:
        let value = this.lexer.lexeme.text;
        return new ast.String(value,this._MoveAndNewPosition(start));
      case lexer.Token.Variable:
        let value = this.lexer.lexeme.text;
        return new ast.Variable(value,this._MoveAndNewPosition(start));
      case lexer.Token.Attribute:
        let value = this.lexer.lexeme.text;
        return new ast.Attribute(value,this._MoveAndNewPosition(start));
    }
  }
};

