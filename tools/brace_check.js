const fs = require('fs');
const path = require('path');
const file = path.resolve(process.argv[2] || 'script.js');
const txt = fs.readFileSync(file, 'utf8');
let line = 1;
let col = 0;
let stack = [];
let inSingle = false, inDouble = false, inTemplate = false, inLineComment = false, inBlockComment = false, prev = '';
const openings = [];
for (let i=0;i<txt.length;i++){
  const ch = txt[i];
  const next = txt[i+1] || '';
  col++;
  if (ch === '\n') { line++; col=0; inLineComment=false; }
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
  if (ch === '{') { stack.push({line,col,index:i}); openings.push({line,col,index:i}); }
  else if (ch === '}') {
    if (stack.length===0) {
      console.log('Unmatched closing brace at line',line,'col',col,'index',i);
    } else {
      stack.pop();
    }
  }
  prev = ch;
}
console.log('Total openings:', openings.length, 'Remaining unclosed:', stack.length);
if (stack.length) {
  console.log('First unclosed opening at line', stack[0].line, 'col', stack[0].col, 'index', stack[0].index);
  console.log('Last unclosed opening at line', stack[stack.length-1].line, 'col', stack[stack.length-1].col, 'index', stack[stack.length-1].index);
}
// Print context around last unclosed if any
if (stack.length) {
  const last = stack[stack.length-1];
  const start = Math.max(0, last.index-80);
  const end = Math.min(txt.length, last.index+80);
  console.log('\nContext around last unclosed opening:\n---\n' + txt.slice(start,end) + '\n---');
}
process.exit(stack.length?1:0);
