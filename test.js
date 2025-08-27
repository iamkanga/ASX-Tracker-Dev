const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const HOST = 'localhost';

let server;
let browser;
let page;

// Function to start a simple static file server
function startServer() {
    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            let filePath = '.' + req.url.split('?')[0];
            if (filePath === './') {
                filePath = './index.html';
            }

            const extname = String(path.extname(filePath)).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.wav': 'audio/wav',
                '.mp4': 'video/mp4',
                '.woff': 'application/font-woff',
                '.ttf': 'application/font-ttf',
                '.eot': 'application/vnd.ms-fontobject',
                '.otf': 'application/font-otf',
                '.wasm': 'application/wasm'
            };

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if (error.code == 'ENOENT') {
                        console.error(`File not found: ${filePath}`);
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('404 Not Found');
                    } else {
                        res.writeHead(500);
                        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        }).listen(PORT, HOST, () => {
            console.log(`Server running at http://${HOST}:${PORT}/`);
            resolve();
        });

        server.on('error', (err) => {
            reject(err);
        });
    });
}

async function runTest() {
    try {
        await startServer();

        browser = await chromium.launch();
        page = await browser.newPage();

        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Console error: ${msg.text()}`);
                consoleErrors.push(msg.text());
            }
        });

        await page.goto(`http://${HOST}:${PORT}`, { waitUntil: 'networkidle' });

        // Wait for the splash screen sign-in button to be visible,
        // which indicates that the app has initialized correctly in a signed-out state.
        await page.waitForSelector('#splashSignInBtn', { timeout: 10000 });

        console.log('App loaded successfully.');

        // Take a screenshot
        await page.screenshot({ path: 'verification.png' });
        console.log('Screenshot taken: verification.png');

        if (consoleErrors.length > 0) {
            console.error('Test failed: Console errors were found.');
            process.exit(1);
        } else {
            console.log('Test passed: No console errors found.');
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        if (server) server.close();
    }
}

runTest();
