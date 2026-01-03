import http from 'http';
import httpProxy from 'http-proxy';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create proxy server
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  preserveHeaderKeyCase: true
});

// Subdomain to folder mapping
const subdomainMap = {
  'auth.astravyn.local': 'auth',
  'time.astravyn.local': 'timesheet',
  'dating.astravyn.local': 'dating',
  'studio.astravyn.local': 'studio',
  'landing.astravyn.local': 'landing',
  'admin.astravyn.local': 'admin',
  'api.astravyn.local': 'api',
  'cdn.astravyn.local': 'cdn',
  'astravyn.local': '', // Root domain
  'www.astravyn.local': '' // www subdomain
};

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const hostname = req.headers.host ? req.headers.host.split(':')[0] : '';
  
  console.log(`[${new Date().toLocaleTimeString()}] ${hostname} ${req.method} ${req.url}`);

  // Get the subdomain folder mapping
  const baseFolder = subdomainMap[hostname];
  
  if (!baseFolder) {
    console.log(`⚠️  Unknown subdomain: ${hostname}`);
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`<h1>Unknown subdomain: ${hostname}</h1><p>Check your hosts file configuration.</p>`);
    return;
  }

  // Parse URL and build file path
  let urlPath = req.url.split('?')[0] || '/'; // Remove query string

  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  // Strip leading slash
  const safePath = urlPath.replace(/^\/+/, '');

  // Allow top-level folders (auth, shared, js, etc.) to bypass the subdomain folder
  const globalPrefixes = [
    'auth/', 'shared/', 'js/', 'timesheet/', 'dating/', 'studio/', 'landing/', 'admin/', 'api/', 'cdn/', 'example/'
  ];
  const effectiveBase = globalPrefixes.some((prefix) => safePath.startsWith(prefix)) ? '' : baseFolder;

  const fullPath = path.join(__dirname, effectiveBase, safePath);
  
  // Check if it's a directory and serve index.html
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const indexPath = path.join(fullPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveFile(indexPath, res);
      return;
    }
  }

  // Serve the file if it exists
  if (fs.existsSync(fullPath)) {
    serveFile(fullPath, res);
  } else {
    // Try with .html extension
    const htmlPath = fullPath + '.html';
    if (fs.existsSync(htmlPath)) {
      serveFile(htmlPath, res);
    } else {
      console.log(`⚠️  File not found: ${fullPath}`);
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<h1>404 Not Found</h1><p>File: ${urlPath}</p>`);
    }
  }
});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res && !res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error occurred');
  }
});

const PORT = 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🚀 Astravyn Local Development Server Started          ║
╚════════════════════════════════════════════════════════════════╝

Subdomain Routing Active on Port ${PORT} (Access with :${PORT}):

  🏠 Landing:      http://landing.astravyn.local:${PORT}
  🔐 Auth:         http://auth.astravyn.local:${PORT}
  ⏱️  Timesheet:    http://time.astravyn.local:${PORT}
  💝 Dating:       http://dating.astravyn.local:${PORT}
  🎨 Studio:       http://studio.astravyn.local:${PORT}
  👑 Admin:        http://admin.astravyn.local:${PORT}
  🔌 API:          http://api.astravyn.local:${PORT}
  📦 CDN:          http://cdn.astravyn.local:${PORT}

Firebase Emulator UI:
  🔥 Dashboard:    http://localhost:4000

Make sure Firebase emulators are running:
  → Run: firebase emulators:start

Press Ctrl+C to stop the server
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down proxy server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
