// Minimal static file server for tests
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const port = process.env.PORT ? parseInt(process.env.PORT,10) : 8000;

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);
    if (!filePath.startsWith(root)) {
      res.statusCode = 403; res.end('Forbidden'); return;
    }
    fs.stat(filePath, (err, stats) => {
      if (err) { res.statusCode = 404; res.end('Not found'); return; }
      if (stats.isDirectory()) {
        const index = path.join(filePath, 'index.html');
        if (fs.existsSync(index)) {
          streamFile(index, res);
        } else { res.statusCode = 404; res.end('Not found'); }
      } else {
        streamFile(filePath, res);
      }
    });
  } catch (e) { res.statusCode = 500; res.end('Server error'); }
}).listen(port, () => console.log(`Dev server running at http://localhost:${port}/`));

function streamFile(p, res) {
  const ext = path.extname(p).toLowerCase();
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
  const stream = fs.createReadStream(p);
  stream.on('error', () => { res.statusCode = 500; res.end('Server file error'); });
  stream.pipe(res);
}
