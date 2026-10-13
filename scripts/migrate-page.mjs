import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Turns a standalone course page into a fragment for the shared shell:
// keeps the page's own <style> (minus the nav.top and footer rules) and body, drops what the shell provides.
export function migrate(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join('\n')
    .replace(/[ \t]*nav\.top[^{}]*\{[^{}]*\}\n?/g, '')
    // footer rules (single selector starting with `footer`): the shell owns the footer, so they must not restyle it.
    .replace(/(?<=^|[{}])[ \t]*footer(?![\w-])[^{},]*\{[^{}]*\}[ \t]*\n?/gm, '')
    .replace(/(^|[\s,}])\.reveal(?=[.{\s,])/g, '$1.js .reveal');
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ''])[1]
    .replace(/<nav class="top">[\s\S]*?<\/nav>/, '')
    .replace(/<footer(?:\s(?:"[^"]*"|'[^']*'|[^>"'])*)?>[\s\S]*?<\/footer>/, '');
  return `<style>\n${css.trim()}\n</style>\n${body.trim()}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('usage: node scripts/migrate-page.mjs <source.html> <destination.html>');
    process.exit(1);
  }
  mkdirSync(dirname(resolve(dest)), { recursive: true });
  writeFileSync(dest, migrate(readFileSync(src, 'utf8')));
  console.log(`migrated ${src} → ${dest}`);
}
