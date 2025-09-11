const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node brace_debug.js <file>'); process.exit(2); }
const txt = fs.readFileSync(path,'utf8');
const lines = txt.split(/\n/);
let stack = [];
for (let i=0, idx=0; i<lines.length; i++) {
  const line = lines[i];
  for (let j=0; j<line.length; j++, idx++) {
    const ch = line[j];
    if (ch === '{') stack.push({line:i+1,col:j+1,idx});
    else if (ch === '}') {
      if (stack.length === 0) {
        console.log('Unmatched closing } at', i+1, j+1);
      } else stack.pop();
    }
  }
  // account for newline char
  idx++;
}
if (stack.length === 0) {
  console.log('All braces matched.');
} else {
  console.log('Unclosed openings:', stack.length);
  stack.forEach(s => console.log('Open at line', s.line, 'col', s.col));
}
