import sg from "syntax-cli/dist/grammar/lex-grammar.js";

export default new sg.default({
    rules: [
        [
            '"(?:[^\\\\"]|\\\\.)*"',
            `yytext = yytext.slice(1, -1); return 'STRING';`,
        ],
        ["\\s", "/*skip whitespace*/"],
        ["\\/\\/.*?(\\n|$)", "/*skip comments*/"],
        [",", "/*skip commas*/"],
        [
            "r[0-3](?=(\\s|$|,))",
            "yytext=yytext.toLowerCase(); return 'REGISTER'",
        ],
        [
            "\\$[a-z][a-z_0-9]*(?=(\\s|$))",
            "yytext = yytext.slice(1); return 'CONST_SET'",
        ],
        ["[a-z][a-z_0-9]*:", "yytext = yytext.slice(0, -1); return 'LABEL'"],
        ["(0x[0-9a-f]+|-?[\\d]+)", "return 'NUMBER'"],
        [
            "(and|orr|add|sub|cmp|tst|str|ldr|mov|lsl|lsr|asr|b)(\\.[a-z]+)?(?=(\\s|$))",
            "yytext = yytext.toLowerCase(); return 'INSTRUCTION'",
        ],
        [
            "\\.(var|at|fill|bin_include)",
            "yytext = yytext.slice(1).toLowerCase(); return 'DIRECTIVE'",
        ],
        ["[a-z][a-z_0-9]*", "return 'NAME'"],
    ],
    options: {
        "case-insensitive": true,
    },
});
