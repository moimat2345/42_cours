(window.Demos = window.Demos || {})['ft_printf-base-convert'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var SPECS = ['d', 'u', 'x', 'X', 'p'];
  var PRESETS = ['-1', '255', '-2147483648', '0'];
  var spec = 'u';
  var env = 'linux';

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

  // the number typed by the reader, as a C int
  function parse(raw) {
    var s = raw.trim(), v;
    if (s === '') return { error: 'errEmpty' };
    if (!/^[+-]?\d+$/.test(s)) return { error: 'errNotInt' };
    v = Number(s);
    if (v < -2147483648 || v > 2147483647) return { error: 'errRange' };
    if (v === 0) v = 0; // never "-0"
    return { value: v };
  }

  // successive divisions: the last digit comes first, and a zero still gives one digit
  function divisions(n, base, upper) {
    var alpha = upper ? '0123456789ABCDEF' : '0123456789abcdef', rows = [], q, r;
    do {
      q = Math.floor(n / base);
      r = n % base;
      rows.push({ n: n, q: q, r: r, d: alpha.charAt(r) });
      n = q;
    } while (n > 0);
    return rows;
  }

  function compute(v, sp) {
    var u = v >>> 0, res = { spec: sp, base: 10, prefix: '', rows: [], nullPtr: false, intMin: false };
    if (sp === 'd') {
      res.intMin = v === -2147483648;
      res.prefix = v < 0 ? '-' : '';
      res.rows = divisions(Math.abs(v), 10, false);
    } else if (sp === 'u') {
      res.rows = divisions(u, 10, false);
    } else if (sp === 'x' || sp === 'X') {
      res.base = 16;
      res.rows = divisions(u, 16, sp === 'X');
    } else {
      res.base = 16;
      if (u === 0) res.nullPtr = true;
      else { res.prefix = '0x'; res.rows = divisions(u, 16, false); }
    }
    var digits = res.rows.map(function (r) { return r.d; }).reverse().join('');
    res.digits = digits;
    res.text = res.nullPtr ? (env === 'linux' ? '(nil)' : '0x0') : res.prefix + digits;
    return res;
  }

  // ---- interface ----
  var title = el('p', 'bc-title', t('title'));

  var input = el('input');
  input.type = 'text';
  input.value = '-1';
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');
  var inLab = el('label', 'bc-field');
  inLab.appendChild(el('span', null, t('numberLabel')));
  inLab.appendChild(input);

  var presetsLabel = el('p', 'bc-lbl', t('presetsLabel'));
  var presets = el('div', 'demo-actions');
  PRESETS.forEach(function (p) {
    var named = p === '-2147483648' ? 'INT_MIN' : null;
    var b = button(named || p, function () { input.value = p; render(); });
    // the accessible name must contain the visible text
    b.setAttribute('aria-label', named ? f('presetAriaNamed', { label: named, v: p }) : f('presetAria', { v: p }));
    presets.appendChild(b);
  });

  var convLabel = el('p', 'bc-lbl', t('convLabel'));
  var convs = el('div', 'demo-actions');
  convs.setAttribute('role', 'group');
  convs.setAttribute('aria-label', t('convLabel'));
  var convBtns = {};
  SPECS.forEach(function (s) {
    var b = button('%' + s, function () { spec = s; render(); });
    b.setAttribute('aria-pressed', 'false');
    convBtns[s] = b;
    convs.appendChild(b);
  });

  var envLabel = el('p', 'bc-lbl', t('envLabel'));
  var envs = el('div', 'demo-actions');
  envs.setAttribute('role', 'group');
  envs.setAttribute('aria-label', t('envLabel'));
  var envBtns = {};
  [['linux', t('envLinux')], ['mac', t('envMac')]].forEach(function (e) {
    var b = button(e[1], function () { env = e[0]; render(); });
    b.setAttribute('aria-pressed', 'false');
    envBtns[e[0]] = b;
    envs.appendChild(b);
  });

  var bitsLabel = el('p', 'bc-lbl', t('bitsLabel'));
  var bitsEl = el('div', 'bc-bits');
  bitsEl.setAttribute('role', 'img');
  var readings = el('ul', 'bc-reads');

  var codeEl = el('div', 'mem-code bc-code');

  var result = el('div', 'verdict-box show');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');

  var tableLabel = el('p', 'bc-lbl', t('tableLabel'));
  var wrap = el('div', 'table-wrap bc-table');
  var table = el('table');
  var thead = el('thead');
  var hr = el('tr');
  var th = [el('th'), el('th'), el('th'), el('th', null, t('colDigit'))];
  th.forEach(function (h) { hr.appendChild(h); });
  thead.appendChild(hr);
  var tbody = el('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  var order = el('p', 'bc-order');
  var warn = el('p', 'bc-warn');
  var note = el('p', 'bc-note');

  [title, inLab, presetsLabel, presets, convLabel, convs, envLabel, envs, bitsLabel, bitsEl, readings, codeEl, result, tableLabel, wrap, order, warn, note]
    .forEach(function (n) { mount.appendChild(n); });

  // ---- drawing ----
  function clearAll() {
    bitsEl.textContent = '';
    bitsEl.removeAttribute('aria-label');
    readings.textContent = '';
    codeEl.textContent = '';
    tbody.textContent = '';
    order.textContent = '';
    warn.textContent = '';
    note.textContent = '';
    tableLabel.hidden = true;
    wrap.hidden = true;
  }

  function render() {
    SPECS.forEach(function (s) { convBtns[s].setAttribute('aria-pressed', String(s === spec)); });
    ['linux', 'mac'].forEach(function (e) { envBtns[e].setAttribute('aria-pressed', String(e === env)); });

    var p = parse(input.value);
    if (p.error) {
      clearAll();
      result.className = 'verdict-box show bad';
      result.textContent = t(p.error);
      return;
    }
    var v = p.value, u = v >>> 0, r = compute(v, spec);

    // the 32 bits, in groups of four, with the hex digit of each group
    var bin = u.toString(2);
    while (bin.length < 32) bin = '0' + bin;
    bitsEl.textContent = '';
    bitsEl.setAttribute('aria-label', f('bitsAria', { bits: bin.replace(/(.{4})(?=.)/g, '$1 '), v: v }));
    for (var g = 0; g < 8; g++) {
      var group = el('div', 'bc-nib');
      group.setAttribute('aria-hidden', 'true');
      var row = el('div', 'bc-nibbits');
      for (var k = 0; k < 4; k++) {
        var idx = g * 4 + k;
        var bit = el('span', 'bc-bit' + (bin.charAt(idx) === '1' ? ' on' : '') + (idx === 0 && spec === 'd' ? ' sign' : ''), bin.charAt(idx));
        row.appendChild(bit);
      }
      var hex = parseInt(bin.slice(g * 4, g * 4 + 4), 2).toString(16);
      group.appendChild(row);
      group.appendChild(el('span', 'bc-hex', spec === 'X' ? hex.toUpperCase() : hex));
      bitsEl.appendChild(group);
    }

    // the same 32 bits, three ways to read them
    readings.textContent = '';
    [['d', String(v)], ['u', String(u)], ['x', u.toString(16)]].forEach(function (x) {
      var on = (spec === x[0]) || (spec === 'X' && x[0] === 'x') || (spec === 'p' && x[0] === 'x');
      var li = el('li', 'bc-read' + (on ? ' on' : ''));
      li.appendChild(el('code', null, '%' + x[0]));
      li.appendChild(el('span', null, x[1]));
      readings.appendChild(li);
    });

    // the call
    // INT_MIN, never the literal -2147483648: in C that literal is a long, which -Wall -Werror refuses for %d
    var arg = spec === 'p' ? (u === 0 ? '(void *)0' : '(void *)0x' + u.toString(16)) : (v === -2147483648 ? 'INT_MIN' : String(v));
    codeEl.textContent = 'ft_printf("%' + spec + '", ' + arg + ');';

    // the result
    result.className = 'verdict-box show good';
    result.textContent = f('result', { text: r.text, n: r.text.length });

    // the divisions
    tbody.textContent = '';
    if (r.nullPtr) {
      tableLabel.hidden = true;
      wrap.hidden = true;
      order.textContent = t('nullPtrOrder');
    } else {
      tableLabel.hidden = false;
      wrap.hidden = false;
      th[0].textContent = 'n';
      th[1].textContent = 'n / ' + r.base;
      th[2].textContent = 'n % ' + r.base;
      r.rows.forEach(function (row) {
        var tr = el('tr');
        tr.appendChild(el('td', null, String(row.n)));
        tr.appendChild(el('td', null, String(row.q)));
        tr.appendChild(el('td', null, String(row.r)));
        tr.appendChild(el('td', 'bc-digit', row.d));
        tbody.appendChild(tr);
      });
      order.textContent = f('order', { digits: r.digits, text: r.text });
    }

    var warns = [];
    if (r.intMin) warns.push(t('warnIntMin'));
    else if (spec === 'd' && v < 0) warns.push(t('negSign'));
    if (v === -2147483648) warns.push(t('intMinLiteral'));
    warn.textContent = warns.join(' ');
    note.textContent = spec === 'p' ? t(r.nullPtr ? 'nilNote' : 'ptrNote') : '';
  }

  input.addEventListener('input', render);

  render();
};
