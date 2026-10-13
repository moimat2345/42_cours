import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../lib/validate.mjs';

const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const SHARED_DEMO = 'bit-toggler'; // the only demo a course may use without its own "<id>-" prefix
const USAGE = 'usage: node scripts/check.mjs [--dist <dir>] [--only <id>]';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// True when the internal URL resolves to a file (or a directory index) inside dist.
function target(dist, url) {
  let clean;
  try { clean = decodeURIComponent(url.split('#')[0].split('?')[0]); } catch { return false; }
  const base = join(dist, clean);
  const rel = relative(dist, base);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false; // escapes dist
  if (clean.endsWith('/')) return existsSync(join(base, 'index.html'));
  return (existsSync(base) && statSync(base).isFile()) || existsSync(join(base, 'index.html'));
}

// ---- external resources: the site may load nothing from outside, except Google Fonts ----------------------------
const ATTRS = `(?:"[^"]*"|'[^']*'|[^>"'])*`; // the inside of a tag: a ">" in a quoted value does not end it
const EXTERNAL = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i; // http://x, https://x, //x (data:, #id, /path and relative URLs never match)
const ENTITIES = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&', '#39': "'" };
const decode = (v) => v.replace(/&(quot|apos|lt|gt|amp|#39);/g, (_, e) => ENTITIES[e]);

function hostOf(url) {
  try { return new URL(/^\s*\/\//.test(url) ? `https:${url.trim()}` : url.trim()).hostname; } catch { return null; }
}
const isAllowed = (url) => ALLOWED_HOSTS.includes(hostOf(url));

// URLs of a srcset value ("a.png 1x, b.png 2x"). A data: URL may contain commas, so split the way a browser does.
function srcsetUrls(value) {
  const urls = [];
  for (let i = 0; i < value.length;) {
    while (i < value.length && /[\s,]/.test(value[i])) i += 1;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i += 1;
    const url = value.slice(start, i).replace(/,+$/, '');
    if (url) urls.push(url);
    if (value[i - 1] !== ',') while (i < value.length && value[i] !== ',') i += 1; // skip the "2x" / "300w" descriptor
  }
  return urls;
}

// url(...) and @import in a piece of CSS (comments ignored): the external URLs whose host is not allowed
function cssExternals(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const urls = [
    ...[...text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/gi)].map((m) => m[1] ?? m[2] ?? m[3]),
    ...[...text.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)\s;"']+))/gi)].map((m) => m[1] ?? m[2] ?? m[3]),
  ];
  return urls.filter((u) => EXTERNAL.test(u) && !isAllowed(u)).map((u) => u.trim());
}

// Everything a page loads from outside: [{ kind: 'script' | 'resource', url }]. Hyperlinks (<a href>) are not loads.
function externalResources(html) {
  const found = [];
  const css = [];
  // comments are not loaded; <style> bodies are scanned as CSS; <script> bodies (code, JSON data) are not markup
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`<(script|style)\\b(${ATTRS})>([\\s\\S]*?)<\\/\\1\\s*>`, 'gi'), (_, tag, attrs, body) => {
      if (tag.toLowerCase() === 'style') { css.push(body); return ''; }
      return `<script${attrs}>`;
    });
  for (const [, tagName, attrText] of markup.matchAll(new RegExp(`<([a-zA-Z][\\w:-]*)(${ATTRS})>`, 'g'))) {
    const tag = tagName.toLowerCase();
    const flag = (url) => found.push({ kind: tag === 'script' ? 'script' : 'resource', url: url.trim() });
    for (const [, rawName, dq, sq, bare] of attrText.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = rawName.toLowerCase();
      const value = decode(dq ?? sq ?? bare ?? '');
      if (name === 'style') css.push(value);
      else if (name === 'srcset') srcsetUrls(value).filter((u) => EXTERNAL.test(u)).forEach(flag);
      else if (['src', 'poster', 'data'].includes(name) && EXTERNAL.test(value)) flag(value);
      else if ((name === 'href' || name === 'xlink:href') && EXTERNAL.test(value)) {
        // <link> may only point at an allowed host; SVG <image>/<use> never load from outside; <a href> is a hyperlink
        if (tag === 'link' ? !isAllowed(value) : ['image', 'use', 'feimage'].includes(tag)) flag(value);
      }
    }
  }
  for (const text of css) for (const url of cssExternals(text)) found.push({ kind: 'resource', url });
  return found;
}

const DEMO_ATTR = /\bdata-demo=(["'])([\w-]+)\1/g;
const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

const classOf = (attrs) => {
  const m = attrs.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  return m ? (m[1] ?? m[2] ?? m[3]) : '';
};

// sorted keys of a demo-i18n JSON object, or 'invalid'
function i18nKeys(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : 'invalid';
  } catch { return 'invalid'; }
}

// every recognised <script class="… demo-i18n …"> block, in document order
function i18nBlocks(html) {
  return [...html.matchAll(SCRIPT_TAG)]
    .filter((m) => classOf(m[1]).split(/\s+/).includes('demo-i18n'))
    .map((m) => ({ at: m.index, keys: i18nKeys(m[2]) }));
}

// { demoName: [one entry per occurrence, in document order] }
// entry = sorted i18n keys | null (no block in that occurrence) | 'invalid'
function demoI18n(html) {
  const marks = [...html.matchAll(DEMO_ATTR)].map((m) => ({ name: m[2], at: m.index }));
  const blocks = i18nBlocks(html);
  const out = {};
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : Infinity;
    const block = blocks.find((b) => b.at > mark.at && b.at < end);
    (out[mark.name] ??= []).push(block ? block.keys : null);
  });
  return out;
}

const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const demoNames = (html) => [...new Set([...html.matchAll(DEMO_ATTR)].map((m) => m[2]))];

// one label per <section>: its heading text, else its id, else its position
const sectionTitles = (html) => [...html.matchAll(/<section\b([^>]*)>\s*(?:<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>)?/g)].map((m, i) => {
  const title = (m[2] || '').replace(/<[^>]*>/g, '').trim();
  return title || (m[1].match(/\sid="([^"]+)"/) || [])[1] || `#${i + 1}`;
});

const onlyIn = (a, b) => a.filter((x) => !b.includes(x));
const names = (a) => (a.length ? a.join(', ') : '(none)');
const diff = (a, b) => `only in FR: ${names(onlyIn(a, b))}; only in EN: ${names(onlyIn(b, a))}`;

export function check({ root, dist = join(root, 'dist'), only = null }) {
  const errors = [];
  if (!existsSync(dist)) return [`${dist} not found: run "npm run build" first`];
  const pages = walk(dist).filter((f) => f.endsWith('.html')).filter((f) => {
    const rel = relative(dist, f);
    return rel === 'index.html' || rel.startsWith('fr/') || rel.startsWith('en/');
  });
  const htmlOf = new Map(pages.map((f) => [relative(dist, f), readFileSync(f, 'utf8')]));
  if (!htmlOf.has('fr/index.html') && !htmlOf.has('en/index.html')) {
    return [`no pages found in ${dist} (wrong --dist, or the build failed?)`];
  }

  for (const [rel, html] of htmlOf) {
    const dir = rel.split('/')[0];
    if ((dir === 'fr' || dir === 'en') && !new RegExp(`<html lang="${dir}"`).test(html)) errors.push(`${rel}: <html lang> must be "${dir}"`);
    if (!/<title>[^<]*\S[^<]*<\/title>/.test(html)) errors.push(`${rel}: empty or missing <title>`);

    const seen = new Set();
    for (const id of ids(html)) {
      if (seen.has(id)) errors.push(`${rel}: duplicate id "${id}"`);
      seen.add(id);
    }
    for (const m of html.matchAll(/\b(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      if (!target(dist, m[1])) errors.push(`${rel}: broken link ${m[1]}`);
    }
    for (const m of html.matchAll(/\bhref="#([^"]+)"/g)) {
      if (!seen.has(m[1])) errors.push(`${rel}: anchor #${m[1]} has no target`);
    }
    for (const { kind, url } of externalResources(html)) errors.push(`${rel}: external ${kind} ${url}`);
    // A course page (fr|en/<id>/ or fr|en/extras/<id>/) names its demos "<id>-<name>": two courses can then never overwrite
    // each other's assets/demos/ files, and --only <id> finds the errors of its demos. Home pages and the root index are exempt.
    const owner = (rel.match(/^(?:fr|en)\/(?:extras\/)?([^/]+)\/index\.html$/) || [])[1];
    for (const name of demoNames(html)) {
      if (owner && name !== SHARED_DEMO && !name.startsWith(`${owner}-`)) {
        errors.push(`${rel}: demo "${name}" must be named "${owner}-<name>" (or be the shared "${SHARED_DEMO}")`);
      }
      if (!existsSync(join(dist, 'assets/demos', `${name}.js`))) errors.push(`${rel}: demo "${name}" is missing assets/demos/${name}.js`);
    }

    // Safety net: every tag that mentions the demo-i18n class must have been recognised as a block.
    const blocks = i18nBlocks(html);
    const mentions = (html.match(/<[a-z][^<>]*\sclass\s*=\s*["']?[^"'>]*demo-i18n/gi) || []).length;
    if (mentions > blocks.length) {
      errors.push(`${rel}: ${mentions - blocks.length} demo-i18n element(s) not recognised (expected <script type="application/json" class="demo-i18n">…</script>)`);
    }
    if (blocks.some((b) => b.keys === 'invalid')) errors.push(`${rel}: invalid demo-i18n JSON`);
  }

  // Stylesheets are loaded by the pages too: the site stylesheet and every demo stylesheet obey the same "nothing external
  // except Google Fonts" rule as the markup. A demo stylesheet is named <id>-<name>.css, so --only <id> finds its errors.
  const assetsDir = join(dist, 'assets');
  if (existsSync(assetsDir)) {
    for (const file of walk(assetsDir).filter((f) => f.endsWith('.css'))) {
      const rel = relative(dist, file).split(sep).join('/');
      for (const url of cssExternals(readFileSync(file, 'utf8'))) errors.push(`${rel}: external resource ${url}`);
    }
  }

  // Demo scripts are loaded as classic <script defer src>: parse them as classic scripts
  // (never as ES modules, whatever package.json says), without running them.
  const demosDir = join(dist, 'assets/demos');
  if (existsSync(demosDir)) {
    for (const f of readdirSync(demosDir).filter((n) => n.endsWith('.js'))) {
      const file = join(demosDir, f);
      try {
        new Script(readFileSync(file, 'utf8'), { filename: file });
      } catch (e) {
        const line = String(e.stack || '').split('\n')[0].match(/:(\d+)$/);
        errors.push(`assets/demos/${f}: syntax error — ${e.name || 'Error'}: ${String(e.message).split('\n')[0]}${line ? ` (line ${line[1]})` : ''}`);
      }
    }
  }

  for (const [rel, fr] of htmlOf) {
    if (!rel.startsWith('fr/')) continue;
    const en = htmlOf.get(rel.replace(/^fr\//, 'en/'));
    if (en === undefined) continue;
    const sa = sectionTitles(fr);
    const sb = sectionTitles(en);
    if (sa.length !== sb.length) errors.push(`${rel}: parity — FR has ${sa.length} <section>, EN has ${sb.length} (FR: ${names(sa)}; EN: ${names(sb)})`);
    const ia = [...new Set(ids(fr))].sort();
    const ib = [...new Set(ids(en))].sort();
    if (onlyIn(ia, ib).length || onlyIn(ib, ia).length) errors.push(`${rel}: parity — ids ${diff(ia, ib)}`);
    const fa = demoI18n(fr);
    const fb = demoI18n(en);
    for (const name of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
      const a = fa[name] ?? [];
      const b = fb[name] ?? [];
      if (a.length !== b.length) errors.push(`${rel}: parity — i18n keys differ for demo "${name}": FR has ${a.length} occurrence(s), EN has ${b.length}`);
      const many = Math.max(a.length, b.length) > 1;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const [x, y] = [a[i], b[i]];
        if (x === 'invalid' || y === 'invalid' || JSON.stringify(x) === JSON.stringify(y)) continue; // invalid JSON is reported above
        const head = `${rel}: i18n keys differ for demo "${name}"${many ? ` (occurrence ${i + 1})` : ''}`;
        if (x === null || y === null) errors.push(`${head}: ${x === null ? 'FR' : 'EN'} has no demo-i18n block`);
        else errors.push(`${head}: ${diff(x, y)}`);
      }
    }
  }

  const unique = [...new Set(errors)];
  return only ? unique.filter((e) => e.includes(`/${only}/`) || e.includes(`${only}-`) || e.includes(`"${only}-`)) : unique;
}

// Strict CLI parsing: { dist, only } (null when absent). Throws a one-line Error on anything else.
export function parseArgs(argv) {
  const out = { dist: null, only: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const m = arg.match(/^(--dist|--only)(?:=([\s\S]*))?$/);
    if (!m) {
      throw new Error(arg.startsWith('-') ? `unknown option "${arg}" (${USAGE})` : `unexpected argument "${arg}" (${USAGE})`);
    }
    const [, flag, inline] = m;
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined || value === '' || value.startsWith('-')) {
      throw new Error(`${flag} needs a value, got ${value === undefined ? 'nothing' : `"${value}"`} (${USAGE})`);
    }
    if (seen.has(flag)) throw new Error(`${flag} given more than once (${USAGE})`);
    seen.add(flag);
    out[flag.slice(2)] = value;
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  const { only } = opts;
  const errors = [...(only ? [] : validateContent(root)), ...check({ root, dist: opts.dist ? resolve(opts.dist) : join(root, 'dist'), only })];
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'));
    process.exit(1);
  }
  console.log('OK');
}
