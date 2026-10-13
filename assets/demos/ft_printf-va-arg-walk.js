(window.Demos = window.Demos || {})['ft_printf-va-arg-walk'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var SPECS = 'cspdiuxX%';
  var NORMAL = { format: '%c%s%d', args: 'A|hi|7' };
  var WRONG = { format: '%s', args: '42' };
  var WANT = { c: 'int', d: 'int', i: 'int', u: 'unsigned int', x: 'unsigned int', X: 'unsigned int', s: 'char *', p: 'void *' };

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
  function textInput(value) {
    var i = el('input');
    i.type = 'text';
    i.value = value;
    i.setAttribute('spellcheck', 'false');
    i.setAttribute('autocomplete', 'off');
    i.setAttribute('autocapitalize', 'off');
    return i;
  }
  function field(label, input) {
    var l = el('label', 'va-field');
    l.appendChild(el('span', null, label));
    l.appendChild(input);
    return l;
  }

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
  function bytes(s) {
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
  }
  // the single byte written by %c (the int is converted to an unsigned char): printable ASCII as is,
  // a code of 128 or more shown as \xNN, which is still one byte
  function charOf(code) {
    code = code & 255;
    if (code > 127) return '\\x' + (code < 16 ? '0' : '') + code.toString(16).toUpperCase();
    return String.fromCharCode(code);
  }
  function hexOf(n) { return (n >>> 0).toString(16); }

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

  // an argument as the caller passed it: its value and its type
  function classify(raw) {
    var tr = raw.trim(), m = /^0x([0-9a-f]{1,16})$/i.exec(tr), v, u, c;
    if (raw === 'NULL') return { kind: 'null', show: 'NULL', type: 'void *' };
    if (m) {
      var h = m[1].toLowerCase().replace(/^0+(?=.)/, '');
      if (h === '0') return { kind: 'null', show: 'NULL', type: 'void *' };
      return { kind: 'ptr', show: '0x' + h, type: 'void *' };
    }
    if (/^[+-]?\d+$/.test(tr)) {
      v = Number(tr);
      if (v === 0) v = 0;
      if (v < -2147483648 || v > 4294967295) return { kind: 'long', value: v, show: String(v), type: 'long' };
      return { kind: 'int', value: v, show: String(v), type: 'int' };
    }
    u = unescape(raw);
    m = /^'(.*)'$/.exec(tr);
    c = m ? unescape(m[1]) : u; // 'A' is a char literal, 'hi' stays a string
    if (Array.from(c).length !== 1) c = u;
    if (Array.from(c).length === 1 && c.charCodeAt(0) <= 127) {
      return { kind: 'char', value: c.charCodeAt(0), text: c, show: "'" + vis(c, true) + "'", type: t('typeChar') };
    }
    u = cutNul(u);
    return { kind: 'str', text: u, show: '"' + vis(u, false) + '"', type: 'char *' };
  }

  function accepts(spec, slot) {
    if (spec === 's') return slot.kind === 'str' || slot.kind === 'null';
    if (spec === 'p') return slot.kind === 'ptr' || slot.kind === 'null' || slot.kind === 'str';
    return slot.kind === 'int' || slot.kind === 'char';
  }

  // what a conversion writes once va_arg returned the right type: { text to display, n bytes written }
  function render1(spec, slot, idx) {
    var v, w;
    if (spec === 'c') return { text: charOf(slot.value), n: 1 };
    if (spec === 's') w = slot.kind === 'null' ? '(null)' : slot.text;
    else if (spec === 'p') {
      if (slot.kind === 'null') w = '(nil)';
      else if (slot.kind === 'ptr') w = slot.show;
      else w = '0x7ffd' + (4096 + 16 * idx).toString(16); // made-up address: the demo has no real memory
    } else {
      v = slot.value;
      if (spec === 'd' || spec === 'i') w = String(v | 0);
      else if (spec === 'u') w = String(v >>> 0);
      else w = spec === 'x' ? hexOf(v) : hexOf(v).toUpperCase();
    }
    return { text: w, n: bytes(w) };
  }

  // ---- interface ----
  var title = el('p', 'va-title', t('title'));
  var fmtIn = textInput(NORMAL.format);
  var argIn = textInput(NORMAL.args);
  var hint = el('p', 'va-hint', t('hint'));

  var actions = el('div', 'demo-actions');
  var stepBtn = button(t('step'), function () { step(); });
  var runBtn = button(t('run'), function () { runAll(); });
  var resetBtn = button(t('reset'), function () { reset(); });
  var wrongBtn = button(t('wrong'), function () { toggleWrong(); });
  wrongBtn.setAttribute('aria-pressed', 'false');
  [stepBtn, runBtn, resetBtn, wrongBtn].forEach(function (b) { actions.appendChild(b); });

  var queueLabel = el('p', 'va-lbl', t('queueLabel'));
  var queue = el('ol', 'va-queue');
  queue.setAttribute('aria-label', t('queueLabel'));
  var fmtLabel = el('p', 'va-lbl', t('fmtLabel'));
  var toks = el('ol', 'va-toks');
  toks.setAttribute('aria-label', t('fmtLabel'));
  var traceLabel = el('p', 'va-lbl', t('traceLabel'));
  var trace = el('ol', 'va-trace');
  trace.setAttribute('aria-label', t('traceLabel'));

  var panel = el('div', 'va-panel');
  var outBox = el('div', 'va-box');
  outBox.appendChild(el('span', 'va-lbl', t('output')));
  var outEl = el('code', 'va-out');
  outBox.appendChild(outEl);
  var retBox = el('div', 'va-box va-retbox');
  var retLbl = el('span', 'va-lbl');
  var retEl = el('span', 'va-ret');
  retBox.appendChild(retLbl);
  retBox.appendChild(retEl);
  panel.appendChild(outBox);
  panel.appendChild(retBox);

  var msg = el('div', 'verdict-box show');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  [title, field(t('formatLabel'), fmtIn), field(t('argsLabel'), argIn), hint, actions, queueLabel, queue, fmtLabel, toks, traceLabel, trace, panel, msg]
    .forEach(function (n) { mount.appendChild(n); });

  // ---- state ----
  var S, wrong = false;

  function reset() {
    var raw = argIn.value;
    var list = raw === '' ? [] : raw.split('|');
    S = {
      toks: tokenize(cutNul(unescape(fmtIn.value))),
      slots: list.map(classify),
      used: [],
      pos: 0, ap: 0, out: '', count: 0, done: false, error: false, bad: -1,
      trace: ['va_start(ap, format)'],
      msg: { cls: '', key: 'idle', vars: {} }
    };
    if (!S.toks.length) finish('');
    render();
  }

  function setWrong(on) {
    wrong = on;
    wrongBtn.setAttribute('aria-pressed', String(on));
  }
  function toggleWrong() {
    var on = !wrong;
    var p = on ? WRONG : NORMAL;
    fmtIn.value = p.format;
    argIn.value = p.args;
    setWrong(on);
    reset();
    if (on) runAll();
  }

  function ub(key, tok, slot, idx) {
    S.error = true;
    S.msg = {
      cls: 'bad', key: key,
      vars: {
        raw: tok.raw, want: WANT[tok.spec], got: slot ? slot.type : '', val: slot ? slot.show : '',
        hex: slot && slot.value != null ? hexOf(slot.value) : '', n: idx + 1
      }
    };
  }

  function step() {
    if (S.done || S.error) return;
    var lines = [], lit = '';
    while (S.pos < S.toks.length) {
      var tok = S.toks[S.pos];
      S.pos += 1;
      if (tok.kind === 'lit') { tok.done = true; tok.written = tok.raw; lit += tok.raw; S.out += tok.raw; S.count += bytes(tok.raw); continue; }
      if (tok.kind === 'end') { tok.done = true; tok.written = ''; lines.push(f('msgEnd', {})); break; }
      if (tok.kind === 'bad') {
        tok.done = true; tok.written = tok.raw; S.out += tok.raw; S.count += bytes(tok.raw);
        lines.push(f('msgBad', { raw: tok.raw }));
        break;
      }
      if (tok.spec === '%') {
        tok.done = true; tok.written = '%'; S.out += '%'; S.count += 1;
        lines.push(f('msgPercent', {}));
        break;
      }
      var idx = S.ap, slot = S.slots[idx];
      S.trace.push('va_arg(ap, ' + WANT[tok.spec] + ')');
      if (!slot) {
        S.trace[S.trace.length - 1] += '  →  ???';
        S.bad = idx; tok.err = true;
        ub('ubEmpty', tok, null, idx);
        break;
      }
      if (!accepts(tok.spec, slot)) {
        S.trace[S.trace.length - 1] += '  →  ???';
        S.bad = idx; tok.err = true;
        var key = 'ubGeneric';
        if (tok.spec === 's' && (slot.kind === 'int' || slot.kind === 'char')) key = 'ubStrInt';
        else if (tok.spec !== 's' && tok.spec !== 'p' && (slot.kind === 'str' || slot.kind === 'ptr' || slot.kind === 'null')) key = 'ubIntPtr';
        else if (tok.spec === 'p') key = 'ubPtrInt';
        ub(key, tok, slot, idx);
        break;
      }
      var r1 = render1(tok.spec, slot, idx), w = r1.text;
      S.trace[S.trace.length - 1] += '  →  ' + slot.show;
      S.used[idx] = tok.raw;
      S.ap += 1;
      tok.done = true; tok.written = w;
      S.out += w; S.count += r1.n;
      lines.push(f('msgConsume', { raw: tok.raw, want: WANT[tok.spec], n: idx + 1, val: slot.show, text: vis(w, false) }));
      break;
    }
    if (S.error) { render(); return; }
    if (lit !== '') lines.unshift(f('msgLits', { text: vis(lit, true) }));
    var lastLine = lines.join(' ');
    if (S.pos >= S.toks.length) finish(lastLine);
    else S.msg = { cls: '', key: 'raw', vars: { text: lastLine } };
    render();
  }

  function finish(line) {
    S.done = true;
    S.trace.push('va_end(ap)');
    var left = S.slots.length - S.ap;
    S.msg = { cls: 'good', key: left > 0 ? 'doneExtra' : 'done', vars: { last: line, n: S.count, left: left } };
  }

  function runAll() {
    var guard = 0;
    while (!S.done && !S.error && guard < 10000) { step(); guard += 1; }
  }

  // ---- drawing ----
  function render() {
    // the queue of arguments, with the va_list cursor
    queue.textContent = '';
    var cursorAt = S.done ? -1 : (S.error ? S.bad : S.ap);
    S.slots.forEach(function (s, i) {
      var cls = 'va-slot';
      var state = ' ';
      if (S.used[i]) { cls += ' used'; state = '✓ ' + S.used[i]; }
      if (i === cursorAt) { cls += S.error ? ' bad' : ' cur'; state = S.error ? '✗ ?' : '▲ ap'; }
      var li = el('li', cls);
      if (i === cursorAt && !S.error) li.setAttribute('aria-current', 'step');
      li.appendChild(el('span', 'va-idx', '#' + (i + 1)));
      li.appendChild(el('span', 'va-val', s.show));
      li.appendChild(el('span', 'va-type', s.type));
      li.appendChild(el('span', 'va-state', state));
      queue.appendChild(li);
    });
    var endCls = 'va-slot va-endslot';
    var endState = ' ';
    if (cursorAt === S.slots.length) { endCls += S.error ? ' bad' : ' cur'; endState = S.error ? '✗ ?' : '▲ ap'; }
    var end = el('li', endCls);
    end.appendChild(el('span', 'va-idx', '∅'));
    end.appendChild(el('span', 'va-val', t('endOfQueue')));
    end.appendChild(el('span', 'va-type', ' '));
    end.appendChild(el('span', 'va-state', endState));
    queue.appendChild(end);

    // the format
    toks.textContent = '';
    S.toks.forEach(function (tok, i) {
      var cls = 'va-tok ' + (tok.kind === 'conv' ? 'conv' : (tok.kind === 'lit' ? 'lit' : 'bad'));
      if (tok.done) cls += ' done';
      if (tok.err) cls += ' err';
      if (i === S.pos && !S.done && !S.error) cls += ' cur';
      var li = el('li', cls, vis(tok.raw, true));
      toks.appendChild(li);
    });

    // the calls made so far
    trace.textContent = '';
    S.trace.forEach(function (line) {
      var li = el('li');
      li.appendChild(el('code', null, line));
      trace.appendChild(li);
    });

    outEl.textContent = S.out === '' ? '∅' : vis(S.out, false);
    retLbl.textContent = S.error ? t('retUndef') : (S.done ? t('ret') : t('counter'));
    retEl.textContent = S.error ? String(S.count) + ' ?' : String(S.count);
    retBox.classList.toggle('final', S.done && !S.error);
    retBox.classList.toggle('bad', S.error);

    var m = S.msg;
    msg.className = 'verdict-box show' + (m.cls ? ' ' + m.cls : '');
    msg.textContent = (m.key === 'raw' ? m.vars.text : f(m.key, m.vars)).trim();
    var off = String(S.done || S.error);
    stepBtn.setAttribute('aria-disabled', off);
    runBtn.setAttribute('aria-disabled', off);
  }

  function onEdit() { setWrong(false); reset(); }
  fmtIn.addEventListener('input', onEdit);
  argIn.addEventListener('input', onEdit);
  [fmtIn, argIn].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); reset(); runAll(); } });
  });

  reset();
};
