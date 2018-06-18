const lexer = require("./lexer.js");
const assert= require("assert");

function _testOp() {
  let src    = "+ - * / , ; : [] {} ()" +
               "> >= < <= == != =";
  let l      = new lexer.Lexer(src);
  let result = [ lexer.Token.Add , lexer.Token.Sub, lexer.Token.Mul, lexer.Token.Div,
                 lexer.Token.Comma, lexer.Token.Semicolon ,lexer.Token.Colon,
                 lexer.Token.LSqr, lexer.Token.RSqr, lexer.Token.LBra, lexer.Token.RBra,
                 lexer.Token.LPar, lexer.Token.RPar, lexer.Token.Gt , lexer.Token.Ge,
                 lexer.Token.Lt  , lexer.Token.Le  , lexer.Token.Eq , lexer.Token.Ne,
                 lexer.Token.Assign , lexer.Token.Eof ];

  for( const s of result ) {
    let lexeme = l.Next();
    assert(l.lexeme.token == s);
  }
}

function _testKW() {
  let src = "true false true_ false2 null nullxx let let_ if if_ else else_ fn fn_ this this_";
  let result = [ [lexer.Token.True,null] ,
                 [lexer.Token.False,null],
                 [lexer.Token.Variable,"true_"],
                 [lexer.Token.Variable,"false2"],
                 [lexer.Token.Null,null],
                 [lexer.Token.Variable,"nullxx"],
                 [lexer.Token.Let,null],
                 [lexer.Token.Variable,"let_"],
                 [lexer.Token.If,null],
                 [lexer.Token.Variable,"if_"],
                 [lexer.Token.Else,null],
                 [lexer.Token.Variable,"else_"],
                 [lexer.Token.Fn,null],
                 [lexer.Token.Variable,"fn_"],
                 [lexer.Token.This,null],
                 [lexer.Token.Variable,"this_"],
                 [lexer.Token.Eof,null]
                ];
  let l = new lexer.Lexer(src);

  for( const s of result ) {
    let lexeme = l.Next(); 
    assert(s[0] == lexeme.token);
    if(lexeme.token == lexer.Token.Variable)
      assert( lexeme.text === s[1] );
  }
}

function _testNum() {
  let src = "1234 _123 1.1 1.0 0.2";
  let res = [
    [lexer.Token.Number,1234],
    [lexer.Token.Variable,"_123"],
    [lexer.Token.Number,1.1],
    [lexer.Token.Number,1.0],
    [lexer.Token.Number,0.2],
    [lexer.Token.Eof,null]
  ];

  let l = new lexer.Lexer(src);

  for( const r of res ) {
    let lexeme = l.Next();
    assert(lexeme.token == r[0]);
    if(r[0] == lexer.Token.Number) {
      assert(r[1] == lexeme.number);
    } else if(r[1] == lexer.Token.Variable) {
      assert(r[1] === lexeme.text);
    }
  }
}

function _testStr() {
  let src = `"" "hello" "\\n" "\\t" "\\"" "\\r" "\\\\"`;
  let res = [
    [lexer.Token.String,""],
    [lexer.Token.String,"hello"],
    [lexer.Token.String,"\n"],
    [lexer.Token.String,"\t"],
    [lexer.Token.String,"\""],
    [lexer.Token.String,"\r"],
    [lexer.Token.String,"\\"],
    [lexer.Token.Eof,null]
  ];
  let l = new lexer.Lexer(src);

  for( const s of res ) {
    let lexeme = l.Next();
    assert(lexeme.token == s[0]);
    if(s[0] == lexer.Token.String) {
      assert(s[1] === lexeme.text);
    }
  }
}

function _testComment() {
  let src = "xxx #line\n" +
            "#line comment\n" +
            "xxx\n" +
            "#comment";
  let res = [lexer.Token.Variable,lexer.Token.Variable,lexer.Token.Eof];
  let l   = new lexer.Lexer(src);

  for( const s of res ) {
    let lexeme = l.Next();
    assert(s == lexeme.token);
  }
}

_testOp();
_testKW();
_testNum();
_testStr();
_testComment