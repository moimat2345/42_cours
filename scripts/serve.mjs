import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const port = Number(arg('--port', process.env.PORT || 4242));
const given = arg('--dir', null);
const dist = given ? resolve(given) : join(root, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

// Without --dir we own dist/: build it (with the dev template course) and rebuild on change.
const rebuild = () => {
  try { build({ root, out: dist, withTemplate: true }); console.log('built'); } catch (e) { console.error(e.message); }
};
if (!given) {
  rebuild();
  if (args.includes('--watch')) {
    let timer;
    watch(root, { recursive: true }, (_event, name) => {
      // macOS also reports the watched root itself (name === its basename) whenever dist/ is deleted and recreated
      // by a rebuild: without this guard every rebuild triggers the next one, forever.
      if (!name || name === basename(root) || /^(dist|\.tmp|node_modules|\.git|\.superpowers|\.claude)(\/|$)/.test(name)) return;
      clearTimeout(timer);
      timer = setTimeout(rebuild, 150);
    });
  }
}

createServer((req, res) => {
  // A malformed request target ("/%", "/%zz", "//") makes URL or decodeURIComponent throw: answer 400, never crash the server.
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) {
    res.writeHead(400, { 'content-type': 'text/plain' }); res.end('400'); return;
  }
  let file = resolve(join(dist, pathname));
  if (file !== dist && !file.startsWith(dist + sep)) { res.writeHead(403); res.end('403'); return; }
  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) { // e.g. dist/ being rebuilt between the existence check and the read
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end('500');
  }
}).listen(port, () => console.log(`http://localhost:${port}  (dir: ${dist})`));
