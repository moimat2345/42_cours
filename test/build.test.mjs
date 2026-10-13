import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from '../build.mjs';
import { makeFixture, project } from './helpers.mjs';

const FRAG =
  '<header class="hero"><h1 class="title">T</h1></header>' +
  '<section><h2>Alpha</h2><p>cost $& {{x}} $1</p></section>' +
  '<section><h2>Beta</h2><div data-demo="fractol-canvas"></div></section>';

const projects = [
  project({ id: 'fractol', group: 'gfx', order: 1, name: "fract'ol & co", summary: { fr: "L'ensemble <b>", en: 'Set' } }),
  project({ id: 'libft', order: 2, name: 'libft' }),
  project({ id: 'cpp00', group: 'cpp', order: 3, name: 'CPP00' }),
];

function site(extra = {}) {
  const root = makeFixture({
    projects,
    extras: [project({ id: 'pvp', group: 'extras', order: 1, name: 'public vs private' })],
    fragments: {
      'courses/fractol/fr.html': FRAG,
      'courses/cpp00/fr.html': FRAG,
      'courses/cpp00/en.html': FRAG,
      'extras/pvp/fr.html': FRAG,
      ...extra,
    },
  });
  const out = join(root, 'dist');
  return { root, out };
}
const read = (out, rel) => readFileSync(join(out, rel), 'utf8');

test('builds both homes and the root redirect page', () => {
  const { root, out } = site();
  build({ root, out });
  for (const rel of ['fr/index.html', 'en/index.html', 'index.html']) assert.ok(existsSync(join(out, rel)), rel);
  assert.match(read(out, 'index.html'), /location\.replace/);
});

test('ready courses are links, missing ones are non-clickable "soon" cards', () => {
  const { root, out } = site();
  build({ root, out });
  const home = read(out, 'fr/index.html');
  assert.match(home, /<a class="pcard" data-group="gfx"[^>]*href="\/fr\/fractol\/"/);
  assert.match(home, /<div class="pcard soon" data-group="c"[^>]*aria-disabled="true"/);
  assert.ok(!existsSync(join(out, 'fr/libft/index.html')));
});

test('special characters in names and summaries are escaped everywhere', () => {
  const { root, out } = site();
  build({ root, out });
  const home = read(out, 'fr/index.html');
  assert.match(home, /fract&#39;ol &amp; co/);
  assert.ok(!home.includes("fract'ol & co"));
  assert.match(home, /L&#39;ensemble &lt;b&gt;/);
  const page = read(out, 'fr/fractol/index.html');
  assert.match(page, /<title>fract&#39;ol &amp; co · Tag · \[siteName\]<\/title>/);
});

test('the fragment is inserted verbatim (no $ or {{ interpretation)', () => {
  const { root, out } = site();
  build({ root, out });
  assert.ok(read(out, 'fr/fractol/index.html').includes('<p>cost $& {{x}} $1</p>'));
});

test('course page: table of contents, demo script, language links, lang attribute', () => {
  const { root, out } = site();
  build({ root, out });
  const page = read(out, 'fr/fractol/index.html');
  assert.match(page, /<html lang="fr">/);
  assert.match(page, /<a href="#sec-1">Alpha<\/a><a href="#sec-2">Beta<\/a>/);
  assert.match(page, /<section id="sec-1">/);
  assert.match(page, /<script src="\/assets\/demos\/fractol-canvas\.js" defer><\/script>/);
  assert.match(page, /href="\/fr\/fractol\/" hreflang="fr" aria-current="true"/);
  assert.match(page, /href="\/en\/fractol\/" hreflang="en">/);
});

test('missing EN fragment falls back to FR with a banner (non-strict)', () => {
  const { root, out } = site();
  build({ root, out });
  const page = read(out, 'en/fractol/index.html');
  assert.match(page, /<html lang="en">/);
  assert.match(page, /class="fallback-banner"[^>]*>\[fallbackBanner\]</);
  assert.ok(!read(out, 'en/cpp00/index.html').includes('fallback-banner'));
});

// The fallback page is French text on an English page: lang="fr" goes on <main> only (<html lang> must stay the page language).
test('the FR fallback page marks its content <main lang="fr">; normal pages have a plain <main>', () => {
  const { root, out } = site();
  build({ root, out });
  const fallback = read(out, 'en/fractol/index.html');
  assert.match(fallback, /<main lang="fr">/);
  assert.match(fallback, /<html lang="en">/);
  assert.match(read(out, 'en/cpp00/index.html'), /<main>/, 'a translated page');
  assert.match(read(out, 'fr/fractol/index.html'), /<main>/, 'the French original');
  assert.ok(!read(out, 'en/cpp00/index.html').includes('<main lang'));
  assert.ok(!read(out, 'fr/fractol/index.html').includes('<main lang'));
});

test('strict mode throws on a missing fragment and names it', () => {
  const { root, out } = site();
  assert.throws(() => build({ root, out, strict: true }), /Missing (fr|en) fragment for courses\/(fractol|libft)/);
});

test('previous/next skip courses that are not built yet', () => {
  const { root, out } = site();
  build({ root, out });
  const page = read(out, 'fr/fractol/index.html');
  assert.match(page, /class="pager-next" href="\/fr\/cpp00\/"/);
  assert.ok(!page.includes('pager-prev'));
});

// A course with no neighbour gets no pager at all (an empty <nav> drew a rule and ~90px of nothing).
test('a lone course has no pager; a course with a neighbour keeps it', () => {
  const { root, out } = site();
  build({ root, out });
  assert.ok(!read(out, 'fr/extras/pvp/index.html').includes('class="pager"'), 'the only extra has no neighbour');
  assert.ok(!read(out, 'fr/extras/pvp/index.html').includes('pager-in'));
  const withNext = read(out, 'fr/fractol/index.html');
  assert.match(withNext, /<nav class="pager" aria-label="\[pagerLabel\]"><div class="pager-in"><span><\/span><a class="pager-next" href="\/fr\/cpp00\/">/);
  const both = makeFixture({
    projects: [project({ id: 'a', order: 1, name: 'a' }), project({ id: 'b', order: 2, name: 'b' }), project({ id: 'c', order: 3, name: 'c' })],
    fragments: Object.fromEntries(['a', 'b', 'c'].map((id) => [`courses/${id}/fr.html`, FRAG])),
  });
  build({ root: both, out: join(both, 'dist') });
  const middle = read(join(both, 'dist'), 'fr/b/index.html');
  assert.match(middle, /class="pager-prev" href="\/fr\/a\/"/);
  assert.match(middle, /class="pager-next" href="\/fr\/c\/"/);
  assert.equal(middle.match(/class="pager"/g).length, 1);
});

test('the pager <nav> is labelled with ui.pagerLabel of the page language (a missing one is invalid content: see build-strict)', () => {
  const { root, out } = site();
  const file = join(root, 'content/ui.json');
  const ui = JSON.parse(readFileSync(file, 'utf8'));
  ui.fr.pagerLabel = 'Cours voisins <"x">';
  ui.en.pagerLabel = 'Neighbouring courses';
  writeFileSync(file, JSON.stringify(ui));
  build({ root, out });
  assert.match(read(out, 'fr/fractol/index.html'), /<nav class="pager" aria-label="Cours voisins &lt;&quot;x&quot;&gt;">/);
  assert.match(read(out, 'en/cpp00/index.html'), /<nav class="pager" aria-label="Neighbouring courses">/);
});

test('extras live under /extras/', () => {
  const { root, out } = site();
  build({ root, out });
  assert.ok(existsSync(join(out, 'fr/extras/pvp/index.html')));
  assert.match(read(out, 'fr/index.html'), /href="\/fr\/extras\/pvp\/"/);
});

test('demo stylesheet is linked only when assets/demos/<name>.css exists', () => {
  const { root, out } = site();
  build({ root, out });
  assert.ok(!read(out, 'fr/fractol/index.html').includes('fractol-canvas.css'));
  const withCss = makeFixture({
    projects, fragments: { 'courses/fractol/fr.html': FRAG, 'courses/fractol/en.html': FRAG },
  });
  writeCss(withCss);
  build({ root: withCss, out: join(withCss, 'dist') });
  assert.match(read(join(withCss, 'dist'), 'fr/fractol/index.html'), /<link rel="stylesheet" href="\/assets\/demos\/fractol-canvas\.css">/);
});

function writeCss(root) {
  mkdirSync(join(root, 'assets/demos'), { recursive: true });
  writeFileSync(join(root, 'assets/demos/fractol-canvas.css'), '/* x */');
}

test('table of contents labels are decoded once and escaped once', () => {
  const { root, out } = site({
    'courses/fractol/fr.html': '<section><h2>Op&eacute;rateur &lt;&lt;</h2><p>x</p></section>',
  });
  build({ root, out });
  const page = read(out, 'fr/fractol/index.html');
  assert.ok(page.includes('<a href="#sec-1">Opérateur &lt;&lt;</a>'), 'chip is decoded once, escaped once');
  assert.ok(!page.includes('&amp;lt;'), 'no double escaping');
});

test('a demo declared with single quotes still gets its script injected', () => {
  const { root, out } = site({
    'courses/fractol/fr.html': "<section><h2>Alpha</h2><div data-demo='fractol-canvas'></div></section>",
  });
  build({ root, out });
  assert.match(read(out, 'fr/fractol/index.html'), /<script src="\/assets\/demos\/fractol-canvas\.js" defer><\/script>/);
});
