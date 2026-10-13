(window.Demos = window.Demos || {})['ft_printf-format-parser'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var SPECS = 'cspdiuxX%';
  var DEFAULT_FORMAT = '%d items%%\\n';
  var DEFAULT_ARGS = '42';

  function t(k) { return T[k] != null ? String(T[k]) : k; }
  function f(k, vars) {
    return t(k).replace(/\{(\w+)\}/g, function (m, n) { return vars && vars[n] != null ? String(vars[n]) : m; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, onClick) {
    var b = el('button', 'btn', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // "\n" typed in a field becomes a real newline, as in a C string literal. A NUL ends the string, as in C.
  function unescape(s) {
    var out = '', i = 0;
    while (i < s.length) {
      var c = s.charAt(i), n = s.charAt(i + 1);
      if (c === '\\' && n === 'n') { out += '\n'; i += 2; }
      else if (c === '\\' && n === 't') { out += '\t'; i += 2; }
      else if (c === '\\' && n === '0') { out += '\0'; i += 2; }
      else if (c === '\\' && n === '\\') { out += '\\'; i += 2; }
      else { out += c; i += 1; }
    }
    return out;
  }
  function cutNul(s) {
    var k = s.indexOf('\0');
    return k < 0 ? s : s.slice(0, k);
  }
  // visible form of a character, so that nothing disappears from the display (control codes use the Unicode "control pictures")
  function vis(s, spaces) {
    return s.replace(/[\u0000-\u001f\u007f ]/g, function (c) {
      if (c === '\n') return '\u21b5';
      if (c === '\t') return '\u21e5';
      if (c === ' ') return spaces ? '\u2423' : ' ';
      if (c === '\u007f') return '\u2421';
      return String.fromCharCode(0x2400 + c.charCodeAt(0));
    });
  }
  // the byte written by %c: printable ASCII as is, a code of 128 or more as \xNN (one byte all the same)
  function charOf(code) {
    return code > 127 ? '\\x' + (code < 16 ? '0' : '') + code.toString(16).toUpperCase() : String.fromCharCode(code);
  }
  function bytes(s) {
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
  }

  function tokenize(fmt) {
    var chars = Array.from(fmt), toks = [], i = 0;
    while (i < chars.length) {
      var ch = chars[i];
      if (ch !== '%') { toks.push({ kind: 'lit', raw: ch }); i += 1; continue; }
      var nx = chars[i + 1];
      if (nx === undefined) { toks.push({ kind: 'end', raw: '%' }); i += 1; }
      else if (SPECS.indexOf(nx) >= 0) { toks.push({ kind: 'conv', spec: nx, raw: '%' + nx }); i += 2; }
      else { toks.push({ kind: 'bad', raw: '%' + nx }); i += 2; }
    }
    return toks;
  }

  // %c takes an int, converted to an unsigned char like in C (65 gives A, 200 and -1 give one byte each),
  // or a single ASCII character: 'A', '\n', or a bare A
  function charArg(arg) {
    var s = arg.trim(), m, u, v;
    if (/^[+-]?\d+$/.test(s)) {
      v = Number(s);
      if (v < -2147483648 || v > 2147483647) return { error: 'errRange' };
      return { code: v & 255 };
    }
    m = /^'(.*)'$/.exec(s);
    u = unescape(m ? m[1] : arg);
    if (Array.from(u).length === 1 && u.charCodeAt(0) <= 127) return { code: u.charCodeAt(0) };
    return { error: 'errChar' };
  }

  // one conversion: returns { text, n (bytes written), note } or { error }
  function convert(spec, arg) {
    var v, m, h;
    if (spec === 'c') {
      var cc = charArg(arg);
      if (cc.error) return { error: cc.error };
      return { text: charOf(cc.code), n: 1 };
    }
    if (spec === 's') {
      if (arg === 'NULL') return { text: '(null)', note: 'noteNullStr' };
      return { text: cutNul(unescape(arg)) };
    }
    if (spec === 'p') {
      if (arg === 'NULL') return { text: '(nil)', note: 'noteNilPtr' };
      m = /^0x([0-9a-f]{1,16})$/i.exec(arg.trim());
      if (!m) return { error: 'errPtr' };
      h = m[1].toLowerCase().replace(/^0+(?=.)/, '');
      if (h === '0') return { text: '(nil)', note: 'noteNilPtr' };
      return { text: '0x' + h };
    }
    var s = arg.trim();
    if (!/^[+-]?\d+$/.test(s)) return { error: 'errInt' };
    v = Number(s);
    var signed = spec === 'd' || spec === 'i';
    if (v < -2147483648 || v > (signed ? 2147483647 : 4294967295)) return { error: 'errRange' };
    if (v === 0) v = 0; // never "-0"
    if (signed) return { text: String(v) };
    v = v >>> 0;
    if (spec === 'u') return { text: String(v) };
    return { text: spec === 'x' ? v.toString(16) : v.toString(16).toUpperCase() };
  }

  // ---- interface ----
  var title = el('p', 'fp-title', t('title'));

  var fmtIn = el('input');
  fmtIn.type = 'text';
  fmtIn.value = DEFAULT_FORMAT;
  fmtIn.setAttribute('spellcheck', 'false');
  fmtIn.setAttribute('autocomplete', 'off');
  fmtIn.setAttribute('autocapitalize', 'off');
  var fmtLab = el('label', 'fp-field');
  fmtLab.appendChild(el('span', null, t('formatLabel')));
  fmtLab.appendChild(fmtIn);

  var argIn = el('input');
  argIn.type = 'text';
  argIn.value = DEFAULT_ARGS;
  argIn.setAttribute('spellcheck', 'false');
  argIn.setAttribute('autocomplete', 'off');
  argIn.setAttribute('autocapitalize', 'off');
  var argLab = el('label', 'fp-field');
  argLab.appendChild(el('span', null, t('argsLabel')));
  argLab.appendChild(argIn);

  var hint = el('p', 'fp-hint', t('hint'));

  var actions = el('div', 'demo-actions');
  var stepBtn = button(t('step'), function () { step(); });
  var runBtn = button(t('run'), function () { runAll(); });
  var resetBtn = button(t('reset'), function () { reset(); });
  actions.appendChild(stepBtn);
  actions.appendChild(runBtn);
  actions.appendChild(resetBtn);

  var tokLabel = el('p', 'fp-lbl', t('tokensLabel'));
  var tokRow = el('ol', 'fp-toks');
  tokRow.setAttribute('aria-label', t('tokensLabel'));
  var legend = el('p', 'fp-legend', t('legend'));

  var panel = el('div', 'fp-panel');
  var outBox = el('div', 'fp-box');
  outBox.appendChild(el('span', 'fp-lbl', t('output')));
  var outEl = el('code', 'fp-out');
  outBox.appendChild(outEl);
  var retBox = el('div', 'fp-box fp-retbox');
  var retLbl = el('span', 'fp-lbl');
  var retEl = el('span', 'fp-ret');
  retBox.appendChild(retLbl);
  retBox.appendChild(retEl);
  panel.appendChild(outBox);
  panel.appendChild(retBox);

  var msg = el('div', 'verdict-box show');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  [title, fmtLab, argLab, hint, actions, tokLabel, tokRow, legend, panel, msg].forEach(function (n) { mount.appendChild(n); });

  // ---- state ----
  var S;

  function reset() {
    var fmt = cutNul(unescape(fmtIn.value));
    var raw = argIn.value;
    S = {
      toks: tokenize(fmt),
      args: raw === '' ? [] : raw.split('|'),
      pos: 0, argi: 0, out: '', count: 0, done: false, error: null, msg: null
    };
    if (!S.toks.length) { S.done = true; S.msg = { cls: 'good', key: 'emptyFormat', vars: {} }; }
    else S.msg = { cls: '', key: 'idle', vars: {} };
    render();
  }

  function fail(tok, key) {
    S.error = true;
    S.msg = { cls: 'bad', key: key, vars: { raw: tok.raw, arg: S.args[S.argi] } };
  }

  function step() {
    if (S.done || S.error) return;
    var tok = S.toks[S.pos];
    var written = '', vars, key, cls = '', n = 0;
    if (tok.kind === 'lit') {
      written = tok.raw; n = bytes(written); key = 'msgLit'; vars = { ch: vis(tok.raw, true), n: n };
    } else if (tok.kind === 'end') {
      key = 'msgEnd'; vars = {};
    } else if (tok.kind === 'bad') {
      written = tok.raw; n = bytes(written); key = 'msgBad'; vars = { raw: tok.raw, n: n };
    } else if (tok.spec === '%') {
      written = '%'; n = 1; key = 'msgPercent'; vars = {};
    } else {
      if (S.argi >= S.args.length) { fail(tok, 'errMissing'); render(); return; }
      var arg = S.args[S.argi];
      var r = convert(tok.spec, arg);
      if (r.error) { fail(tok, r.error); render(); return; }
      written = r.text;
      n = r.n != null ? r.n : bytes(written);
      S.argi += 1;
      key = 'msgConv';
      vars = { raw: tok.raw, spec: tok.spec, arg: vis(arg, false), text: vis(written, false), n: n };
      vars.note = r.note ? ' ' + t(r.note) : '';
    }
    tok.written = written;
    tok.done = true;
    S.out += written;
    S.count += n;
    S.pos += 1;
    var line = f(key, vars);
    S.msg = { cls: cls, key: key, vars: vars };
    if (S.pos >= S.toks.length) finish(line);
    render();
  }

  function finish(line) {
    S.done = true;
    var left = S.args.length - S.argi;
    S.msg = { cls: 'good', key: left > 0 ? 'doneExtra' : 'done', vars: { n: S.count, left: left, last: line } };
  }

  function runAll() {
    var guard = 0;
    while (!S.done && !S.error && guard < 10000) { step(); guard += 1; }
  }

  // ---- drawing ----
  function render() {
    tokRow.textContent = '';
    S.toks.forEach(function (tok, i) {
      var cls = 'fp-tok ' + (tok.kind === 'conv' ? 'conv' : (tok.kind === 'lit' ? 'lit' : 'bad'));
      if (tok.done) cls += ' done';
      if (i === S.pos && !S.done && !S.error) cls += ' cur';
      if (i === S.pos && S.error) cls += ' err';
      var li = el('li', cls);
      if (i === S.pos && !S.done && !S.error) li.setAttribute('aria-current', 'step');
      li.appendChild(el('span', 'fp-raw', vis(tok.raw, true)));
      li.appendChild(el('span', 'fp-kind', t(tok.kind === 'conv' ? 'kindConv' : (tok.kind === 'lit' ? 'kindLit' : 'kindBad'))));
      li.appendChild(el('span', 'fp-wr', tok.done ? '→ ' + (tok.written === '' ? '∅' : vis(tok.written, true)) : ' '));
      tokRow.appendChild(li);
    });
    outEl.textContent = S.out === '' ? '∅' : vis(S.out, false);
    retLbl.textContent = S.done ? t('ret') : t('counter');
    retEl.textContent = S.error ? String(S.count) + ' ?' : String(S.count);
    retBox.classList.toggle('final', S.done);
    var m = S.msg;
    msg.className = 'verdict-box show' + (m.cls ? ' ' + m.cls : '');
    msg.textContent = f(m.key, m.vars).trim();
    stepBtn.setAttribute('aria-disabled', String(S.done || !!S.error));
    runBtn.setAttribute('aria-disabled', String(S.done || !!S.error));
  }

  function onEdit() { reset(); }
  fmtIn.addEventListener('input', onEdit);
  argIn.addEventListener('input', onEdit);
  [fmtIn, argIn].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); reset(); runAll(); } });
  });

  reset();
};
