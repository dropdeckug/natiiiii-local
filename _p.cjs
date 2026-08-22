const ts = require("typescript");
const fs = require("fs");
const src = fs.readFileSync("supabase/functions/build-apk/index.ts","utf8");
const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, src);
let depth = 0, maxDepth=0, maxLine=0, minAt = null;
const tmplStack = []; // stack of open template braces
let kind;
while ((kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
  const pos = scanner.getTokenPos();
  const line = ts.getLineAndCharacterOfPosition(ts.createSourceFile("f.ts",src,ts.ScriptTarget.Latest,false),pos).line + 1;
  if (kind === ts.SyntaxKind.OpenBraceToken) { depth++; if(depth>maxDepth){maxDepth=depth;maxLine=line;} }
  else if (kind === ts.SyntaxKind.CloseBraceToken) { depth--; }
}
console.log("final depth", depth, "max", maxDepth, "at line", maxLine);
