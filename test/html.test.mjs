import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, fill } from '../lib/html.mjs';

test('escapeHtml escapes the five HTML specials', () => {
  assert.equal(
    escapeHtml(`<a href="x">fract'ol & co</a>`),
    '&lt;a href=&quot;x&quot;&gt;fract&#39;ol &amp; co&lt;/a&gt;'
  );
});

test('fill: {{x}} escapes and {{{x}}} is raw', () => {
  assert.equal(fill('<p>{{a}}|{{{b}}}</p>', { a: '<i>', b: '<i>' }), '<p>&lt;i&gt;|<i></p>');
});

test('fill: replacement patterns inside values stay literal', () => {
  assert.equal(fill('{{{a}}}', { a: 'cost $& $1 {{b}}' }), 'cost $& $1 {{b}}');
});

test('fill: an unknown variable throws and names it', () => {
  assert.throws(() => fill('{{missing}}', {}), /missing/);
});
