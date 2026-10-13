import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from '../build.mjs';
import { check, parseArgs } from '../scripts/check.mjs';
import { makeFixture, project, REPO } from './helpers.mjs';

const GOOD_DEMO = "(window.Demos = window.Demos || {})['d1-x'] = function (root, T) {};";
const demo = (keys = '{"a":"A"}') =>
  `<div class="demo" data-demo="d1-x"><div class="demo-mount"></div><script type="application/json" class="demo-i18n">${keys}</script></div>`;
const page = (extra = '') =>
  `<header class="hero"><h1 class="title">T</h1></header><section><h2>One</h2><p>text ${extra}</p></section>`;

// Builds a one-course site (d1) and returns its root. rootFiles: extra files written at the site root.
function site({ fr, en, demos = { 'd1-x': GOOD_DEMO }, rootFiles = {} }) {
  const root = makeFixture({
    projects: [project({ id: 'd1', name: 'd1' })],
    fragments: { 'courses/d1/fr.html': fr, 'courses/d1/en.html': en ?? fr },
    demos,
  });
  for (const [name, text] of Object.entries(rootFiles)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  build({ root });
  return root;
}

function run(opts) {
  return check({ root: site(opts) }).join('\n');
}

test('a clean site has no error', () => {
  assert.equal(run({ fr: page(demo()) }), '');
});

test('broken internal link', () => {
  assert.match(run({ fr: page('<a href="/fr/nope/">x</a>') }), /broken link.*\/fr\/nope\//);
});

test('unknown in-page anchor', () => {
  assert.match(run({ fr: page('<a href="#missing">x</a>') }), /#missing/);
});

test('external script is rejected, Google Fonts is allowed', () => {
  assert.match(run({ fr: page('<script src="https://cdn.example.com/x.js"></script>') }), /external/);
  assert.doesNotMatch(run({ fr: page() }), /external/);
});

test('duplicate id', () => {
  assert.match(run({ fr: page('<i id="dup"></i><b id="dup"></b>') }), /duplicate id "dup"/);
});

test('demo without its script file', () => {
  assert.match(run({ fr: page(demo()), demos: {} }), /demo "d1-x".*missing/);
});

test('demo script with a syntax error', () => {
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'function (' } }), /d1-x\.js: syntax error/);
});

test('invalid demo-i18n JSON', () => {
  assert.match(run({ fr: page(demo('{oops')) }), /invalid demo-i18n JSON/);
});

test('FR/EN parity: sections and i18n keys must match', () => {
  const two = page(demo()) + '<section><h2>Two</h2></section>';
  assert.match(run({ fr: two, en: page(demo()) }), /parity.*section/);
  assert.match(run({ fr: page(demo('{"a":"A"}')), en: page(demo('{"a":"A","b":"B"}')) }), /i18n keys differ.*d1-x/);
});

test('--only filters errors to one course', () => {
  const root = makeFixture({
    projects: [project({ id: 'd1', name: 'd1' }), project({ id: 'd2', order: 2, name: 'd2' })],
    fragments: {
      'courses/d1/fr.html': page('<a href="/fr/nope/">x</a>'),
      'courses/d2/fr.html': page('<a href="/fr/also-nope/">x</a>'),
    },
  });
  build({ root });
  const only = check({ root, only: 'd2' }).join('\n');
  assert.match(only, /also-nope/);
  assert.doesNotMatch(only, /\/fr\/nope\//);
});

// ---- Fix round 1 ----------------------------------------------------------------------------

// A. one entry per demo occurrence
test('a repeated demo: an invalid block is not hidden by a later valid one', () => {
  const out = run({ fr: page(demo('{oops') + demo()) });
  assert.match(out, /fr\/d1\/index\.html: invalid demo-i18n JSON/);
});

test('a repeated demo: i18n keys are compared occurrence by occurrence', () => {
  const ab = '{"a":"A","b":"B"}';
  const out = run({ fr: page(demo(ab) + demo(ab)), en: page(demo('{"a":"A"}') + demo(ab)) });
  assert.match(out, /i18n keys differ for demo "d1-x" \(occurrence 1\): only in FR: b; only in EN: \(none\)/);
  assert.doesNotMatch(out, /occurrence 2/);
});

test('a repeated demo: a different number of occurrences is a parity error', () => {
  const out = run({ fr: page(demo() + demo()), en: page(demo()) });
  assert.match(out, /parity — i18n keys differ for demo "d1-x": FR has 2 occurrence\(s\), EN has 1/);
});

test('a demo with an i18n block in one language only is reported', () => {
  const noBlock = '<div class="demo" data-demo="d1-x"><div class="demo-mount"></div></div>';
  assert.match(run({ fr: page(demo()), en: page(noBlock) }), /i18n keys differ for demo "d1-x": EN has no demo-i18n block/);
  assert.equal(run({ fr: page(noBlock) }), '');
});

// B. demo scripts are classic scripts
test('demo script written as an ES module is rejected (classic script semantics)', () => {
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'export const x = 1;' } }), /d1-x\.js: syntax error — SyntaxError: .*export/);
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'await 1;' } }), /d1-x\.js: syntax error — SyntaxError: .*await/);
});

test('demo syntax errors name the line', () => {
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'var a = 1;\nvar b = ;' } }), /d1-x\.js: syntax error — SyntaxError: Unexpected token ';' \(line 2\)/);
});

test('valid classic and sloppy-mode demo code is accepted (and never executed)', () => {
  const sloppy = `${GOOD_DEMO}\nwith (Math) { var z = PI; }\nfunction f() { return this; }\nthrow new Error('must not run');`;
  assert.equal(run({ fr: page(demo()), demos: { 'd1-x': sloppy } }), '');
});

test('the demo syntax check does not depend on a package.json "type":"module" above dist', () => {
  const rootFiles = { 'package.json': '{"type":"module"}' };
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'export const x = 1;' }, rootFiles }), /d1-x\.js: syntax error/);
  assert.match(run({ fr: page(demo()), demos: { 'd1-x': 'await 1;' }, rootFiles }), /d1-x\.js: syntax error/);
  assert.equal(run({ fr: page(demo()), demos: { 'd1-x': `${GOOD_DEMO}\nwith (Math) { var z = PI; }` }, rootFiles }), '');
});

// C. tolerant demo-i18n recognition + safety net
test('demo-i18n blocks are recognised with single quotes and extra classes', () => {
  const single = (keys) => `<div class="demo" data-demo="d1-x"><script type='application/json' class='demo-i18n'>${keys}</script></div>`;
  const extra = (keys) => `<div class="demo" data-demo="d1-x"><script type="application/json" class="demo-i18n x">${keys}</script></div>`;
  assert.match(run({ fr: page(single('{oops')) }), /invalid demo-i18n JSON/);
  assert.match(run({ fr: page(extra('{oops')) }), /invalid demo-i18n JSON/);
  assert.equal(run({ fr: page(extra('{"a":"A"}')) }), '');
  assert.match(run({ fr: page(extra('{"a":"A"}')), en: page(extra('{"a":"A","b":"B"}')) }), /i18n keys differ.*d1-x/);
});

test('demo-i18n JSON must be an object', () => {
  assert.match(run({ fr: page(demo('["a"]')) }), /invalid demo-i18n JSON/);
  assert.match(run({ fr: page(demo('null')) }), /invalid demo-i18n JSON/);
});

test('a demo-i18n element that is not a recognised block is an error, not a silent skip', () => {
  const notScript = '<div class="demo" data-demo="d1-x"><div class="demo-i18n">{"a":"A"}</div></div>';
  assert.match(run({ fr: page(notScript) }), /fr\/d1\/index\.html: 1 demo-i18n element\(s\) not recognised/);
  const lookalike = '<div class="demo" data-demo="d1-x"><script type="application/json" class="my-demo-i18n">{}</script></div>';
  assert.match(run({ fr: page(lookalike) }), /not recognised/);
});

// D. no vacuous OK
test('an empty or wrong dist is an error, not a vacuous OK', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cours-empty-'));
  try {
    assert.match(check({ root: dir, dist: dir }).join('\n'), /no pages found in .*wrong --dist/);
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'x.html'), '<html></html>');
    assert.match(check({ root: dir, dist: dir, only: 'd1' }).join('\n'), /no pages found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// E. strict CLI arguments
test('parseArgs accepts --dist/--only in both forms', () => {
  assert.deepEqual(parseArgs([]), { dist: null, only: null });
  assert.deepEqual(parseArgs(['--dist', 'out', '--only', 'libft']), { dist: 'out', only: 'libft' });
  assert.deepEqual(parseArgs(['--dist=out', '--only=libft']), { dist: 'out', only: 'libft' });
  assert.deepEqual(parseArgs(['--only=a=b']), { dist: null, only: 'a=b' });
});

test('parseArgs rejects unknown flags, stray arguments and bad values with a one-line message', () => {
  const bad = [
    [['--bogus'], /unknown option "--bogus"/],
    [['-x'], /unknown option "-x"/],
    [['--dist-dir=x'], /unknown option/],
    [['stray'], /unexpected argument "stray"/],
    [['--dist'], /--dist needs a value/],
    [['--only'], /--only needs a value/],
    [['--dist', '--only', 'x'], /--dist needs a value/],
    [['--dist=-x'], /--dist needs a value/],
    [['--only='], /--only needs a value/],
    [['--dist', 'a', '--dist', 'b'], /--dist given more than once/],
    [['--dist', 'a', 'extra'], /unexpected argument "extra"/],
  ];
  for (const [argv, re] of bad) {
    assert.throws(() => parseArgs(argv), (e) => e instanceof Error && re.test(e.message) && !e.message.includes('\n'), JSON.stringify(argv));
  }
});

test('the CLI exits 1 with a one-line ✗ message on a bad flag', () => {
  const r = spawnSync(process.execPath, [join(REPO, 'scripts/check.mjs'), '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  const lines = r.stderr.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^✗ unknown option "--bogus"/);
});

test('the CLI honours --dist=<dir> and --only, and reports OK / errors accordingly', () => {
  const cli = (...args) => spawnSync(process.execPath, [join(REPO, 'scripts/check.mjs'), ...args], { encoding: 'utf8' });
  const bad = site({ fr: page('<a href="/fr/nope/">x</a>') });
  const r = cli(`--dist=${join(bad, 'dist')}`, '--only', 'd1');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^✗ fr\/d1\/index\.html: broken link \/fr\/nope\//m);
  const good = site({ fr: page(demo()) });
  const ok = cli('--dist', join(good, 'dist'), '--only=d1');
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.trim(), 'OK');
  const missing = cli('--dist', join(good, 'nope'), '--only=d1');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^✗ .*not found/);
});

// F. target() robustness
test('a malformed %-escape is a broken link, not a crash that hides the other errors', () => {
  const out = run({ fr: page('<a href="/fr/100%/">x</a><a href="/fr/nope/">y</a>') });
  assert.match(out, /fr\/d1\/index\.html: broken link \/fr\/100%\//);
  assert.match(out, /broken link \/fr\/nope\//);
});

test('a link escaping dist is broken even if the target exists outside', () => {
  const out = run({
    fr: page('<a href="/../package.json">x</a><a href="/fr/../fr/">ok</a><a href="/%2e%2e/package.json">y</a>'),
    rootFiles: { 'package.json': '{}' },
  });
  assert.match(out, /broken link \/\.\.\/package\.json/);
  assert.match(out, /broken link \/%2e%2e\/package\.json/);
  assert.doesNotMatch(out, /broken link \/fr\/\.\.\/fr\//);
});

// G. noise and diagnosability
test('identical errors are reported once', () => {
  const out = check({ root: site({ fr: page('<a href="/fr/nope/">x</a><a href="/fr/nope/">y</a>'), en: page() }) });
  assert.equal(out.filter((e) => e === 'fr/d1/index.html: broken link /fr/nope/').length, 1);
  assert.equal(new Set(out).size, out.length);
});

test('parity messages name the offending ids, sections and keys', () => {
  const ids = run({ fr: page('<i id="a"></i><i id="b"></i>'), en: page('<i id="c"></i>') });
  assert.match(ids, /parity — ids only in FR: a, b; only in EN: c/);
  const two = page() + '<section><h2>Deux</h2></section>';
  assert.match(run({ fr: two, en: page() }), /parity — FR has 2 <section>, EN has 1 \(FR: One, Deux; EN: One\)/);
  const keys = run({ fr: page(demo('{"a":1,"b":2}')), en: page(demo('{"b":2,"c":3}')) });
  assert.match(keys, /i18n keys differ for demo "d1-x": only in FR: a; only in EN: c/);
});

// ---- Task 9b: F1 (no external resource) and F2 (demo names carry the course id) -------------------

const FIRST_ERROR = /^fr\/d1\/index\.html: external /m;

test('F1: every kind of external resource is rejected, with the page path first', () => {
  const bad = {
    img: '<img src="https://cdn.example.com/a.png" alt="">',
    iframe: '<iframe src="//x.example/y"></iframe>',
    poster: '<video poster="https://cdn.example.com/p.png"></video>',
    styleAttr: '<div style="background:url(https://cdn.example.com/a.png)">x</div>',
    styleAttrQuoted: `<div style="background-image:url('//cdn.example.com/a.png')">x</div>`,
    styleAttrEntity: '<div style="background:url(&quot;https://cdn.example.com/a.png&quot;)">x</div>',
    styleImport: '<style>@import url(https://cdn.example.com/a.css);</style>',
    styleImportString: '<style>@import "//cdn.example.com/a.css";</style>',
    styleUrl: '<style>.a{background:url( "https://cdn.example.com/a.png" )}</style>',
    linkNoScheme: '<link rel="stylesheet" href="//cdn.example.com/x.css">',
    linkSingleQuote: "<link rel='stylesheet' href='https://cdn.example.com/x.css'>",
    linkOtherHost: '<link rel="stylesheet" href="https://evil.example/css?family=Sora">',
    scriptSingleQuote: "<script src='https://cdn.example.com/x.js'></script>",
    scriptNoScheme: '<script src="//cdn.example.com/x.js"></script>',
    srcset: '<img srcset="/a.png 1x, https://cdn.example.com/b.png 2x" alt="">',
    object: '<object data="https://cdn.example.com/x.swf"></object>',
    source: '<audio><source src="http://cdn.example.com/a.mp3"></audio>',
    embed: '<embed src="https://cdn.example.com/x.pdf">',
    track: '<video><track src="//cdn.example.com/x.vtt"></video>',
    inputImage: '<input type="image" src="https://cdn.example.com/b.png" alt="go">',
    unquoted: '<img src=https://cdn.example.com/a.png alt="">',
    upperCase: '<IMG SRC="HTTPS://CDN.EXAMPLE.COM/A.PNG" ALT="">',
    svgImage: '<svg><image href="https://cdn.example.com/a.png"/></svg>',
    svgUse: '<svg><use xlink:href="//cdn.example.com/s.svg#a"/></svg>',
  };
  for (const [name, html] of Object.entries(bad)) {
    assert.match(run({ fr: page(html) }), FIRST_ERROR, name);
  }
});

test('F1: the offending URL is named in the message', () => {
  assert.match(run({ fr: page('<img src="https://cdn.example.com/a.png" alt="">') }), /external resource https:\/\/cdn\.example\.com\/a\.png/);
  assert.match(run({ fr: page('<script src="//cdn.example.com/x.js"></script>') }), /external script \/\/cdn\.example\.com\/x\.js/);
});

test('F1: Google Fonts (link and CSS) stays accepted', () => {
  const css = 'https://fonts.googleapis.com/css2?family=Sora:wght@300&display=swap';
  const ok = [
    page(), // the template itself carries the preconnect and stylesheet links
    page(`<link href='${css}' rel="stylesheet">`),
    page('<link rel="stylesheet" href="//fonts.googleapis.com/css?family=Sora">'),
    page('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'),
    page(`<style>@import url(${css});</style>`),
    page('<style>@font-face{font-family:X;src:url(https://fonts.gstatic.com/s/x.woff2)}</style>'),
  ];
  for (const fr of ok) assert.equal(run({ fr }), '', fr);
});

test('F1: hyperlinks and internal URLs are not external resources', () => {
  const out = run({
    fr: page('<a href="https://github.com/x">gh</a><a href="//example.org/y">y</a><a href="/fr/d1/">self</a><img src="/assets/demos/x.png" alt="">'),
    rootFiles: { 'assets/demos/x.png': 'png' },
  });
  assert.equal(out, '');
});

test('F1: data: URIs, url(#id) fragments and relative URLs are not external', () => {
  const svg = '<svg viewBox="0 0 4 4"><defs><marker id="arr"></marker></defs><path d="M0 0L4 4" marker-end="url(#arr)" fill="url(#arr)"/></svg>';
  const fr = page(
    '<img src="data:image/png;base64,iVBORw0KGgo=" alt="">' +
      '<img srcset="data:image/png;base64,//8AAA 1x, data:image/png;base64,//9BBB 2x" alt="">' +
      '<div style="background:url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=) no-repeat">x</div>' +
      '<div style="filter:url(#arr);background:url(images/a.png)">y</div>' +
      '<style>.a{background:url("data:image/png;base64,AAAA")}.b{clip-path:url(#arr);mask:url(a.svg#m)}</style>' +
      svg,
  );
  assert.doesNotMatch(run({ fr }), /external/);
});

test('F1: code samples are not mistaken for real markup', () => {
  const sample = '<p class="body">Écris <code class="inline">&lt;img src="https://example.com/a.png"&gt;</code> ou src="https://x.example/y" ou url(https://x.example/z).</p>';
  const inline = `<script>var html = '<img src="https://cdn.example.com/a.png">'; var u = "url(https://cdn.example.com/b.png)"; if (a<b) { go('//x.example/'); }</script>`;
  const commented = '<!-- <img src="https://cdn.example.com/a.png"> --><style>/* url(https://cdn.example.com/a.png) */ .a{color:red}</style>';
  const json = '<script type="application/json" class="demo-i18n">{"u":"https://example.com/x"}</script>';
  assert.equal(run({ fr: page(sample + inline + commented + json) }), '');
});

test('F1: the allowed external hosts do not whitelist other attributes', () => {
  assert.match(run({ fr: page('<img src="https://fonts.gstatic.com/a.png" alt="">') }), FIRST_ERROR);
});

// F2: demo names must start with "<id>-" (or be the shared bit-toggler)
function siteWithExtra({ frCourse, frExtra, demos = {} }) {
  const root = makeFixture({
    projects: [project({ id: 'd1', name: 'd1' })],
    extras: [project({ id: 'e1', group: 'extras', name: 'e1' })],
    fragments: { 'courses/d1/fr.html': frCourse, 'extras/e1/fr.html': frExtra },
    demos,
  });
  build({ root });
  return check({ root }).join('\n');
}
const plain = (name) => `<div class="demo" data-demo="${name}"><div class="demo-mount"></div></div>`;
const GOOD = (name) => `(window.Demos = window.Demos || {})['${name}'] = function (root, T) {};`;

test('F2: a demo not prefixed by the course id is reported, naming the page and the rule', () => {
  const out = run({ fr: page(plain('stack-sim')), demos: { 'stack-sim': GOOD('stack-sim') } });
  assert.match(out, /^fr\/d1\/index\.html: demo "stack-sim" must be named "d1-<name>" \(or be the shared "bit-toggler"\)$/m);
  assert.match(out, /^en\/d1\/index\.html: demo "stack-sim" must be named/m, 'EN page is checked too');
});

test('F2: <id>-<name> and the shared bit-toggler pass', () => {
  assert.equal(run({ fr: page(plain('d1-x') + plain('d1-y-z') + plain('bit-toggler')), demos: { 'd1-x': GOOD('d1-x'), 'd1-y-z': GOOD('d1-y-z') } }), '');
});

test('F2: the prefix is "<id>-" exactly (d10-x, d1x and a bare d1 do not match course d1)', () => {
  const demos = { 'd10-x': GOOD('d10-x'), d1x: GOOD('d1x'), d1: GOOD('d1') };
  const out = run({ fr: page(plain('d10-x') + plain('d1x') + plain('d1')), demos });
  for (const name of ['d10-x', 'd1x', 'd1']) assert.match(out, new RegExp(`fr/d1/index\\.html: demo "${name}" must be named`), name);
});

test('F2: an extra follows the same rule with its own id', () => {
  const ok = siteWithExtra({ frCourse: page(), frExtra: page(plain('e1-x') + plain('bit-toggler')), demos: { 'e1-x': GOOD('e1-x') } });
  assert.equal(ok, '');
  const bad = siteWithExtra({ frCourse: page(), frExtra: page(plain('d1-x')), demos: { 'd1-x': GOOD('d1-x') } });
  assert.match(bad, /^fr\/extras\/e1\/index\.html: demo "d1-x" must be named "e1-<name>"/m);
});

test('F2: --only <id> surfaces the prefix error of that course only', () => {
  const root = makeFixture({
    projects: [project({ id: 'd1', name: 'd1' }), project({ id: 'd2', order: 2, name: 'd2' })],
    fragments: { 'courses/d1/fr.html': page(plain('stack-sim')), 'courses/d2/fr.html': page(plain('queue-sim')) },
    demos: { 'stack-sim': GOOD('stack-sim'), 'queue-sim': GOOD('queue-sim') },
  });
  build({ root });
  const only = check({ root, only: 'd1' }).join('\n');
  assert.match(only, /demo "stack-sim" must be named "d1-<name>"/);
  assert.doesNotMatch(only, /queue-sim/);
});

test('F2: home pages and the root index are exempt (a demo there is not held to the "<id>-" rule)', () => {
  const root = makeFixture({
    projects: [project({ id: 'd1', name: 'd1' })],
    fragments: { 'courses/d1/fr.html': page() },
    demos: { 'zzz-home': GOOD('zzz-home') },
  });
  build({ root });
  // the built homes never contain a demo: put one there, by hand, that the rule would flag if homes were not exempt
  for (const rel of ['dist/fr/index.html', 'dist/en/index.html', 'dist/index.html']) {
    const file = join(root, rel);
    writeFileSync(file, readFileSync(file, 'utf8').replace('</body>', `${plain('zzz-home')}</body>`));
  }
  assert.deepEqual(check({ root }), [], 'no F2 error on the homes or the root index');
  // control: the very same markup on a course page IS reported, so the empty result above is not a blind spot
  const course = join(root, 'dist/fr/d1/index.html');
  writeFileSync(course, readFileSync(course, 'utf8').replace('</body>', `${plain('zzz-home')}</body>`));
  const out = check({ root }).join('\n');
  assert.match(out, /^fr\/d1\/index\.html: demo "zzz-home" must be named "d1-<name>"/m);
  assert.doesNotMatch(out, /^(fr\/index|en\/index|index)\.html: /m);
});

// ---- Fix round 1: stylesheets under assets/ are scanned for external resources too --------------------------------

const cssSite = (rootFiles, only = null) => {
  const root = site({ fr: page(demo()), rootFiles });
  return check({ root, only }).join('\n');
};
const CSS_FILE = /^assets\/demos\/d1-x\.css: external resource /m;

test('css: a demo stylesheet that @imports or url()s an external host is reported, with and without --only', () => {
  const cases = {
    import: ['@import url(https://cdn.example.com/a.css);', 'https://cdn.example.com/a.css'],
    importString: ["@import '//cdn.example.com/a.css';", '//cdn.example.com/a.css'],
    url: ['[data-demo="d1-x"] .a{background:url(https://cdn.example.com/a.png)}', 'https://cdn.example.com/a.png'],
    urlQuoted: ['[data-demo="d1-x"] .a{background:url( "//cdn.example.com/a.png" )}', '//cdn.example.com/a.png'],
    fontFace: ['@font-face{font-family:X;src:url(https://evil.example/x.woff2)}', 'https://evil.example/x.woff2'],
  };
  for (const [name, [css, url]] of Object.entries(cases)) {
    for (const only of [null, 'd1']) {
      const out = cssSite({ 'assets/demos/d1-x.css': css }, only);
      assert.match(out, CSS_FILE, `${name} only=${only}`);
      assert.ok(out.includes(`assets/demos/d1-x.css: external resource ${url}`), `${name} names the URL`);
    }
  }
});

test('css: --only <id> does not surface the stylesheet errors of another course', () => {
  assert.equal(cssSite({ 'assets/demos/d2-x.css': '@import url(https://cdn.example.com/a.css);' }, 'd1'), '');
  assert.match(cssSite({ 'assets/demos/d2-x.css': '@import url(https://cdn.example.com/a.css);' }), /^assets\/demos\/d2-x\.css: external resource /m);
});

test('css: the shared stylesheet and nested folders are scanned too', () => {
  assert.match(cssSite({ 'assets/site.css': 'body{background:url(https://cdn.example.com/b.png)}' }), /^assets\/site\.css: external resource https:\/\/cdn\.example\.com\/b\.png$/m);
  assert.match(cssSite({ 'assets/more/deep/x.css': '@import "https://cdn.example.com/c.css";' }), /^assets\/more\/deep\/x\.css: external resource /m);
});

test('css: data: URIs, url(#id), relative URLs, comments and Google Fonts are accepted', () => {
  const css = [
    '/* url(https://cdn.example.com/in-a-comment.png) */',
    '@import url(https://fonts.googleapis.com/css2?family=Sora);',
    '@font-face{font-family:S;src:url(https://fonts.gstatic.com/s/sora.woff2)}',
    '[data-demo="d1-x"] .a{background:url(data:image/png;base64,AAAA)}',
    '[data-demo="d1-x"] .b{fill:url(#a);mask:url(sprite.svg#m);background:url("img/a.png")}',
  ].join('\n');
  assert.equal(cssSite({ 'assets/demos/d1-x.css': css }), '');
  assert.equal(cssSite({ 'assets/demos/d1-x.css': css }, 'd1'), '');
});
