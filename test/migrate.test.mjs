import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../scripts/migrate-page.mjs';

const SRC = `<!DOCTYPE html><html><head><title>t</title>
<link href="https://fonts.googleapis.com/css2?family=Sora" rel="stylesheet">
<style>
  :root{--stack:#3ee6b0}
  nav.top{position:sticky}
  nav.top .in{display:flex}
  .reveal{opacity:0}
  .reveal.show{opacity:1}
  .hero .reveal-x{color:red}
</style></head><body>
<nav class="top"><div class="in">x</div></nav>
<header class="hero"><h1>Hi</h1></header>
<div class="wrap"><section><h2>A</h2></section></div>
<footer>f</footer>
<script>var a = 1;</script>
</body></html>`;

test('keeps :root, hero, wrap and the inline script', () => {
  const out = migrate(SRC);
  assert.match(out, /:root\{--stack:#3ee6b0\}/);
  assert.match(out, /<header class="hero"><h1>Hi<\/h1><\/header>/);
  assert.match(out, /<div class="wrap"><section><h2>A<\/h2><\/section><\/div>/);
  assert.match(out, /<script>var a = 1;<\/script>/);
});

test('drops the page nav, its CSS, the footer and the fonts link', () => {
  const out = migrate(SRC);
  assert.doesNotMatch(out, /nav\.top/);
  assert.doesNotMatch(out, /<nav class="top">/);
  assert.doesNotMatch(out, /<footer/);
  assert.doesNotMatch(out, /googleapis/);
});

test('hides .reveal only when JS runs, and leaves similarly named classes alone', () => {
  const out = migrate(SRC);
  assert.match(out, /\.js \.reveal\{opacity:0\}/);
  assert.match(out, /\.js \.reveal\.show\{opacity:1\}/);
  assert.match(out, /\.hero \.reveal-x\{color:red\}/);
});

test('starts with a <style> block and ends with a newline', () => {
  const out = migrate(SRC);
  assert.ok(out.startsWith('<style>'));
  assert.ok(out.endsWith('\n'));
});

const FOOTER_SRC = `<!DOCTYPE html><html><head><title>t</title>
<style>
  :root{--stack:#3ee6b0}
  footer{text-align:center;padding:50px 24px 70px}
  footer .line{width:60px;height:1px}
  footer b{color:var(--muted)}
  footer a:hover{color:red}
  .footer-note{color:blue}
  .site-footer{color:green}
  a, footer{color:pink}
  .box footer{color:gray}
  .keep{color:black}
</style></head><body>
<div class="wrap"><footer class="x" id="y"><p>inside</p></footer></div>
<footer>f</footer>
</body></html>`;

test('drops footer CSS rules whose single selector starts with footer', () => {
  const out = migrate(FOOTER_SRC);
  assert.doesNotMatch(out, /^\s*footer\s*\{/m);
  assert.doesNotMatch(out, /footer\{text-align/);
  assert.doesNotMatch(out, /footer \.line/);
  assert.doesNotMatch(out, /footer b\{/);
  assert.doesNotMatch(out, /footer a:hover/);
  assert.match(out, /:root\{--stack:#3ee6b0\}/);
  assert.match(out, /\.keep\{color:black\}/);
});

test('keeps rules that only mention footer in the middle of a name or a selector list', () => {
  const out = migrate(FOOTER_SRC);
  assert.match(out, /\.footer-note\{color:blue\}/);
  assert.match(out, /\.site-footer\{color:green\}/);
  assert.match(out, /a, footer\{color:pink\}/);
  assert.match(out, /\.box footer\{color:gray\}/);
});

test('drops a <footer> element with attributes', () => {
  const out = migrate(FOOTER_SRC);
  assert.doesNotMatch(out, /<footer class="x" id="y">/);
  assert.doesNotMatch(out, /inside/);
  assert.match(out, /<div class="wrap"><\/div>/);
});

test('still drops a bare <footer> element', () => {
  const out = migrate(`<html><head><style>a{color:red}</style></head><body><p>keep</p><footer>f</footer></body></html>`);
  assert.doesNotMatch(out, /<footer/);
  assert.doesNotMatch(out, />f</);
  assert.match(out, /<p>keep<\/p>/);
});
