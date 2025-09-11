const fs = require('fs');
const path = require('path');
const file = path.resolve(process.argv[2] || 'script.js');
const start = parseInt(process.argv[3] || '13780', 10);
const end = parseInt(process.argv[4] || '14050', 10);
const txt = fs.readFileSync(file, 'utf8');
let line = 1;
let col = 0;
let stack = 0;
let inSingle = false, inDouble = false, inTemplate = false, inLineComment = false, inBlockComment = false, prev = '';
let lineBuf = '';
for (let i=0;i<txt.length;i++){
  const ch = txt[i];
  const next = txt[i+1] || '';
  col++;
  lineBuf += ch;
  if (ch === '\n') {
    if (line >= start && line <= end) {
      console.log(String(line).padStart(6), stack, lineBuf.replace(/\r?\n$/, ''));
    }
    line++; col=0; inLineComment=false; lineBuf = '';
  }
  if (inLineComment) { prev=ch; continue; }
  if (inBlockComment) {
    if (prev === '*' && ch === '/') inBlockComment=false;
    prev=ch; continue;
  }
  if (!inSingle && !inDouble && !inTemplate) {
    if (ch === '/' && next === '/') { inLineComment = true; }
    else if (ch === '/' && next === '*') { inBlockComment = true; prev=''; i++; col++; continue; }
  }
  if (!inSingle && !inDouble && ch === '`' && !inTemplate) { inTemplate = true; prev=ch; continue; }
  else if (inTemplate && ch === '`' && prev !== '\\') { inTemplate = false; prev=ch; continue; }
  if (!inTemplate && !inDouble && ch === "'" && !inSingle) { inSingle = true; prev=ch; continue; }
  else if (inSingle && ch === "'" && prev !== '\\') { inSingle = false; prev=ch; continue; }
  if (!inTemplate && !inSingle && ch === '"' && !inDouble) { inDouble = true; prev=ch; continue; }
  else if (inDouble && ch === '"' && prev !== '\\') { inDouble = false; prev=ch; continue; }
  if (inSingle || inDouble || inTemplate) { prev=ch; continue; }
  if (ch === '{') { stack++; }
  else if (ch === '}') { stack--; }
  prev = ch;
}
// flush last line if no trailing newline
if (lineBuf && line >= start && line <= end) {
  console.log(String(line).padStart(6), stack, lineBuf);
}