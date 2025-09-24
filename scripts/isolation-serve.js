#!/usr/bin/env node
/**
 * Lightweight static file server to host the project root so Firebase Auth works
 * (serving over http://localhost instead of file://). Automatically opens the
 * isolation global alerts test page in the default browser.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let DESIRED_PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const ROOT = process.cwd();
const DEFAULT_PAGE = '/tests/isolation-global-alerts.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers={}) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers));
  res.end(body);
}

// Preload firebaseConfig from firebase.js (simple static parse)
let injectedFirebaseConfig = null;
try {
  const fbPath = path.join(ROOT, 'firebase.js');
  const src = fs.readFileSync(fbPath, 'utf8');
  const match = src.match(/const\s+firebaseConfig\s*=\s*({[\s\S]*?});/);
  if (match) {
    injectedFirebaseConfig = match[1];
    console.log('[isolation-serve] Extracted firebaseConfig for injection');
  } else {
    console.warn('[isolation-serve] firebaseConfig not found in firebase.js');
  }
} catch (e) {
  console.warn('[isolation-serve] Could not read firebase.js for config injection:', e.message);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath.replace(/^(\\|\/)+/, ''));
  if (urlPath === '/' || urlPath === '') filePath = path.join(ROOT, DEFAULT_PAGE);
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      return send(res, 404, 'Not Found: ' + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err2, data) => {
      if (err2) return send(res, 500, 'Error reading file');
      // If serving the isolation HTML, inject config before </head>
      if (injectedFirebaseConfig && /isolation-global-alerts\.html$/.test(filePath) && mime.startsWith('text/html')) {
        let html = data.toString('utf8');
        if (!/window\.firebaseConfig\s*=/.test(html)) {
          const snippet = `\n<script>/* injected firebaseConfig */\nwindow.firebaseConfig = ${injectedFirebaseConfig};\n</script>\n`;
          if (/<\/head>/i.test(html)) {
            html = html.replace(/<\/head>/i, snippet + '</head>');
          } else {
            html = snippet + html;
          }
          console.log('[isolation-serve] Injected firebaseConfig into isolation page');
        }
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
        return res.end(html);
      }
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
});

function startServer(port) {
  server.listen(port, () => {
    const url = `http://localhost:${port}${DEFAULT_PAGE}`;
    console.log('\n[isolation-serve] Serving static files from: ' + ROOT);
    console.log('[isolation-serve] Port chosen: ' + port);
    console.log('[isolation-serve] Open: ' + url + '\n');
    const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    try { exec(cmd); } catch(_) {}
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (port < DESIRED_PORT + 15) {
        console.warn(`[isolation-serve] Port ${port} in use, trying ${port+1}...`);
        startServer(port + 1);
      } else {
        console.error('[isolation-serve] Could not find a free port in range. Aborting.');
        process.exit(1);
      }
    } else {
      console.error('[isolation-serve] Server error:', err);
      process.exit(1);
    }
  });
}

startServer(DESIRED_PORT);
