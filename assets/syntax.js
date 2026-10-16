/* syntax.js — tiny dependency-free syntax highlighter.
   window.Syntax.highlight(text, lang) -> HTML string (input is escaped).
   Rules are [regexSource, class, flags?] with sticky matching.
   Class may be a function(text, rest) -> class.
   Languages: sql, js, cypher, csharp, python, bash, json, yaml, text.
   Never throws: unknown language or odd input falls back to escaped text. */
(function () {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeSet(s) {
    var set = Object.create(null);
    s.split(/\s+/).forEach(function (w) { if (w) set[w] = true; });
    return set;
  }

  var SQL_KEYWORDS = makeSet(
    "select from where group by having order top with ties offset fetch next rows only " +
    "insert into values update set delete create alter drop table view procedure proc function " +
    "index constraint primary key foreign references check unique default schema database use " +
    "join inner left right full outer on cross apply union all except intersect " +
    "case when then else end and or not null is in like between exists distinct as " +
    "declare begin end while if else print exec execute output inserted deleted " +
    "go tran commit rollback try catch throw " +
    "asc desc collate nchar ntext identity bulk openrowset bcp"
  );
  var SQL_TYPES = makeSet(
    "int integer bigint smallint tinyint bit decimal numeric money smallmoney float real " +
    "char varchar nchar nvarchar text ntext date datetime datetime2 datetimeoffset time " +
    "uniqueidentifier varbinary binary image xml cursor table"
  );
  var JS_KEYWORDS = makeSet(
    "const let var function return if else for while do new class extends typeof instanceof " +
    "import export from default async await try catch finally throw switch case break continue " +
    "this null undefined true false delete in of yield static get set"
  );
  var CYPHER_KEYWORDS = makeSet(
    "match return where create with optional null as order by limit skip detach delete set " +
    "merge unwind call yield count distinct true false and or not asc desc index unique " +
    "constraint exists"
  );
  var CSHARP_KEYWORDS = makeSet(
    "using namespace class struct public private protected internal static readonly const void " +
    "var new return if else for foreach while do switch case break continue try catch finally " +
    "throw this base null true false int string bool double decimal long byte object dynamic " +
    "override virtual async await interface enum record get set is as in out ref"
  );
  var PYTHON_KEYWORDS = makeSet(
    "def class if elif else for while return import from as with lambda None True False " +
    "in not and or is pass try except finally raise yield global nonlocal assert del break continue"
  );
  var PYTHON_BUILTINS = makeSet(
    "print len range str int float list dict set tuple bool max min sum abs sorted enumerate zip open"
  );
  var BASH_KEYWORDS = makeSet(
    "if then else elif fi for while do done case esac function local export return exit " +
    "echo cd docker sqlcmd grep sed awk cat mkdir rm cp mv chmod curl wget printf source"
  );
  var JSON_KEYWORDS = makeSet("true false null");

  var LANGS = {
    sql: [
      ["\\/\\*[\\s\\S]*?\\*\\/", "comment"],
      ["--[^\\n]*", "comment"],
      ["N?'(?:''|[^'])*'", "string"],
      ["\"(?:[^\"]|\"\")+\"", "string"],
      ["\\[[^\\]]+\\]", "plain"],
      ["@@?[A-Za-z_\\u0600-\\u06FF][\\w\\u0600-\\u06FF]*", "variable"],
      ["#[A-Za-z_][\\w]*", "type"],
      ["\\d+(?:\\.\\d+)?", "number"],
      ["[A-Za-z_][\\w]*", function (t, rest) {
        var lower = t.toLowerCase();
        if (SQL_KEYWORDS[lower]) return "keyword";
        if (SQL_TYPES[lower]) return "type";
        if (/^\s*\(/.test(rest)) return "function";
        return "plain";
      }],
      ["<>|<=|>=|[=<>+\\-*/%|&^!~]", "operator"],
      ["[(),.;:]", "plain"],
    ],
    js: [
      ["\\/\\*[\\s\\S]*?\\*\\/", "comment"],
      ["\\/\\/[^\\n]*", "comment"],
      ["'(?:''|[^'])*'", "string"],
      ["\"(?:\"|[^\"])*\"", "string"],
      ["`(?:`|[^`])*`", "string"],
      ["\\d+(?:\\.\\d+)?", "number"],
      ["[A-Za-z_$][\\w$]*", function (t, rest) {
        if (JS_KEYWORDS[t]) return "keyword";
        if (/^\s*\(/.test(rest)) return "function";
        return "plain";
      }],
      ["=>|===|!==|==|!=|<=|>=|&&|\\|\\||[=<>+\\-*/%!&|^~?:]", "operator"],
      ["[{}()\\[\\].,;]", "plain"],
    ],
    cypher: [
      ["\\/\\/[^\\n]*", "comment"],
      ["\\/\\*[\\s\\S]*?\\*\\/", "comment"],
      ["'(?:''|[^'])*'", "string"],
      ["\"(?:\"|[^\"])*\"", "string"],
      ["\\$[A-Za-z_][\\w]*", "variable"],
      ["\\d+(?:\\.\\d+)?", "number"],
      ["[A-Za-z_][\\w]*", function (t, rest) {
        if (CYPHER_KEYWORDS[t.toLowerCase()]) return "keyword";
        if (/^\s*\(/.test(rest)) return "function";
        return "plain";
      }],
      ["<>|<=|>=|[=<>+\\-*/%|&!]", "operator"],
      ["[{}()\\[\\].,;:]", "plain"],
    ],
    csharp: [
      ["\\/\\*[\\s\\S]*?\\*\\/", "comment"],
      ["\\/\\/[^\\n]*", "comment"],
      ["@?\"(?:\"|[^\"])*\"", "string"],
      ["'(?:''|[^'])*'", "string"],
      ["\\d+(?:\\.\\d+)?[fFdDmM]?", "number"],
      ["[A-Za-z_][\\w]*", function (t, rest) {
        if (CSHARP_KEYWORDS[t]) return "keyword";
        if (/^[A-Z]/.test(t)) return "type";
        if (/^\s*\(/.test(rest)) return "function";
        return "plain";
      }],
      ["=>|==|!=|<=|>=|&&|\\|\\||\\+\\+|--|[=<>+\\-*/%!&|^~?:]", "operator"],
      ["[{}()\\[\\].,;]", "plain"],
    ],
    python: [
      ["#[^\\n]*", "comment"],
      ["[rbuf]?'''[\\s\\S]*?'''", "string"],
      ["[rbuf]?\"\"\"[\\s\\S]*?\"\"\"", "string"],
      ["[rbuf]?'(?:''|[^'])*'", "string"],
      ["[rbuf]?\"(?:\"|[^\"])*\"", "string"],
      ["\\d+(?:\\.\\d+)?", "number"],
      ["@?[A-Za-z_][\\w]*", function (t, rest) {
        var w = t.replace(/^@/, "");
        if (PYTHON_KEYWORDS[w]) return "keyword";
        if (PYTHON_BUILTINS[w]) return "function";
        if (/^[A-Z]/.test(w)) return "type";
        if (/^\s*\(/.test(rest)) return "function";
        return "plain";
      }],
      ["==|!=|<=|>=|\\+=|-=|\\*=|\\/=|[=<>+\\-*/%!&|^~]", "operator"],
      ["[{}()\\[\\].,;:]", "plain"],
    ],
    bash: [
      ["#[^\\n]*", "comment"],
      ["'(?:[^'])*'", "string"],
      ["\"(?:\"|[^\"])*\"", "string"],
      ["\\$\\{[^}]*\\}|\\$[A-Za-z_][\\w]*|\\$\\d+", "variable"],
      ["\\d+(?:\\.\\d+)?", "number"],
      ["[A-Za-z_][\\w.-]*", function (t, rest) {
        if (BASH_KEYWORDS[t]) return "keyword";
        if (/^\s*[=(]/.test(rest)) return "function";
        return "plain";
      }],
      [">>|&&|\\|\\||[|&<>=+\\-*/%]", "operator"],
      ["[{}()\\[\\].,;:]", "plain"],
    ],
    json: [
      ["\"(?:\"|[^\"])*\"(?=\\s*:)", "type"],
      ["\"(?:\"|[^\"])*\"", "string"],
      ["-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?", "number"],
      ["true|false|null(?![A-Za-z0-9_])", "keyword"],
      ["[{}\\[\\],:]", "operator"],
    ],
    yaml: [
      ["#[^\\n]*", "comment"],
      ["^[ \\t]*[^\\n:#-][^\\n:#]*(?=:)", "type", "m"],
      ["'(?:[^'])*'", "string"],
      ["\"(?:\"|[^\"])*\"", "string"],
      ["true|false|null(?![A-Za-z0-9_])", "keyword", "i"],
      ["-?\\d+(?:\\.\\d+)?", "number"],
      ["[:\\-\\[\\]{},]", "operator"],
    ],
    text: []
  };

  // pre-compile (sticky)
  Object.keys(LANGS).forEach(function (lang) {
    LANGS[lang] = LANGS[lang].map(function (rule) {
      return {
        re: new RegExp(rule[0], "y" + (rule[2] || "")),
        cls: rule[1]
      };
    });
  });

  function highlight(text, lang) {
    try {
      text = String(text == null ? "" : text);
      var rules = LANGS[String(lang || "text").toLowerCase()] || LANGS.text;
      var out = [];
      var plain = "";
      var i = 0;
      while (i < text.length) {
        var matched = null;
        var cls = null;
        for (var r = 0; r < rules.length; r++) {
          rules[r].re.lastIndex = i;
          var m = rules[r].re.exec(text);
          if (m && m[0].length > 0) {
            matched = m[0];
            cls = typeof rules[r].cls === "function"
              ? rules[r].cls(m[0], text.slice(i + m[0].length))
              : rules[r].cls;
            break;
          }
        }
        if (!matched) { plain += text.charAt(i); i++; continue; }
        if (plain) { out.push(esc(plain)); plain = ""; }
        out.push('<span class="tok-' + cls + '">' + esc(matched) + "</span>");
        i += matched.length;
      }
      if (plain) out.push(esc(plain));
      return out.join("");
    } catch (e) {
      return esc(text);
    }
  }

  window.Syntax = { highlight: highlight, esc: esc, langs: Object.keys(LANGS) };
})();
