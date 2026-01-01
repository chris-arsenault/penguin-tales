export const cannonGrammar = String.raw`
{
  function span(loc) {
    const file = (options && options.file) ? options.file : '<unknown>';
    return {
      file,
      start: { line: loc.start.line, column: loc.start.column, offset: loc.start.offset },
      end: { line: loc.end.line, column: loc.end.column, offset: loc.end.offset }
    };
  }
}

Start
  = _ statements:Statement* { return statements.filter(Boolean); }

Statement
  = Block LineEnd?
  / Attribute LineEnd?
  / LineEnd { return null; }

Block
  = name:Identifier labels:Label* _ "do" _ LineEnd? body:Statement* _ "end" {
      return {
        type: "block",
        name,
        labels,
        body,
        span: span(location())
      };
    }

Label
  = _ value:(String / KindSubtype / Identifier) { return value; }

KindSubtype
  = kind:Identifier ":" subtype:Identifier { return kind + ":" + subtype; }

Attribute
  = key:(Identifier / String) _ ("=" _)? values:InlineValues {
      return {
        type: "attribute",
        key,
        value: values,
        span: span(location())
      };
    }

InlineValues
  = values:InlineValueList { return values; }
  / value:Value { return value; }

InlineValueList
  = head:Value tail:(_ Value)+ {
      const rest = tail.map(t => t[1]);
      return {
        type: "array",
        items: [head, ...rest],
        span: span(location())
      };
    }

Value
  = Array
  / Object
  / Null
  / Boolean
  / Number
  / String
  / IdentifierValue

IdentifierValue
  = id:Identifier {
      return {
        type: "identifier",
        value: id,
        span: span(location())
      };
    }

Array
  = "[" _ items:ValueList? _ "]" {
      return {
        type: "array",
        items: items || [],
        span: span(location())
      };
    }

ValueList
  = head:Value tail:(_ "," _ Value)* {
      const rest = tail.map(t => t[3]);
      return [head, ...rest];
    }

Object
  = "{" _ entries:PairList? _ "}" {
      return {
        type: "object",
        entries: entries || [],
        span: span(location())
      };
    }

PairList
  = head:Pair tail:(_ "," _ Pair)* {
      const rest = tail.map(t => t[3]);
      return [head, ...rest];
    }

Pair
  = key:(Identifier / String) _ ":" _ value:Value {
      return {
        key,
        value,
        span: span(location())
      };
    }

Boolean
  = "true" { return true; }
  / "false" { return false; }

Null
  = "null" { return null; }

Number
  = sign:"-"? int:[0-9]+ frac:("." [0-9]+)? {
      const num = sign ? "-" + int.join("") : int.join("");
      return frac ? parseFloat(num + "." + frac[1].join("")) : parseInt(num, 10);
    }

String
  = "\"" chars:Char* "\"" { return chars.join(""); }

Char
  = "\\" escaped:EscapeSequence { return escaped; }
  / !"\"" .

EscapeSequence
  = "\"" { return "\""; }
  / "\\" { return "\\"; }
  / "/" { return "/"; }
  / "b" { return "\b"; }
  / "f" { return "\f"; }
  / "n" { return "\n"; }
  / "r" { return "\r"; }
  / "t" { return "\t"; }

Identifier
  = !Keyword $([a-zA-Z_][a-zA-Z0-9_\-]*)

Keyword
  = "do" / "end" / "true" / "false" / "null"

LineEnd = _ (Newline / ";")+
Newline = "\r"? "\n"

_ = (Whitespace / Comment)*
Whitespace = [ \t]+ 
Comment = "#" [^\n]* / "//" [^\n]*
`;
