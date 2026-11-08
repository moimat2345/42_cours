(function () {
  var instances = 0;

  // ---- model (no DOM) -----------------------------------------------------------------------------------------------
  // Mirrors a Fixed class with an `int` raw value and N fractional bits (the subject fixes N = 8, p. 10).
  var INT_MIN = -2147483648;
  var INT_MAX = 2147483647;
  var FIXED_BITS = 8; // p. 10 : "its value will always be the integer literal 8"

  // roundf(): halfway cases go away from zero
  function roundf(x) { return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5); }

  // The typed text -> { mode, ... } or { error: <T key> }. Floats are rounded to 32 bits like a C++ `float`.
  function parseInput(text, mode) {
    var s = String(text).trim();
    if (s === '') return { error: 'errEmpty' };
    if (mode === 'int') {
      if (!/^[+-]?\d+$/.test(s)) return { error: 'errNotInt' };
      var n = Number(s);
      if (n < INT_MIN || n > INT_MAX) return { error: 'errIntRange' };
      if (n === 0) n = 0; // never "-0"
      return { mode: 'int', n: n, lit: n === INT_MIN ? 'INT_MIN' : String(n) };
    }
    var m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[fF]?$/);
    if (!m) return { error: 'errNotFloat' };
    var typed = Number(m[1]);
    var fx = Math.fround(typed);
    if (!isFinite(fx)) return { error: 'errFloatRange' };
    return { mode: 'float', typed: typed, fx: fx, lit: (/[.eE]/.test(m[1]) ? m[1] : m[1] + '.0') + 'f' };
  }

  // Exact decimal text of a multiple of 2^-bits, without useless trailing zeros ("42.421875", "10", "-1.5").
  function plain(x, bits) {
    var s = x.toFixed(bits);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  // A few significant digits of a double, the way a C++ literal would be written.
  function shortNum(x, digits) { return String(Number(x.toPrecision(digits || 12))); }

  // What `std::cout << aFloat` prints: %g with 6 significant digits. Halfway cases round to even on the EXACT value
  // (1.015625 prints 1.01562). x must be a multiple of 2^-bits, so toFixed(bits) gives its exact digits.
  function coutFloat(x, bits) {
    var P = 6;
    if (x === 0) return '0';
    var s = Math.abs(x).toFixed(bits);
    var dot = s.indexOf('.');
    var intLen = dot < 0 ? s.length : dot;
    var digits = s.replace('.', '');
    var first = 0;
    while (first < digits.length && digits.charAt(first) === '0') first++;
    var exp = intLen - first - 1;
    var sig = digits.slice(first);
    var head = sig.slice(0, P);
    var rest = sig.slice(P);
    while (head.length < P) head += '0';
    var up = false;
    if (rest.length) {
      var c = rest.charAt(0);
      if (c > '5') up = true;
      else if (c === '5') up = /[1-9]/.test(rest.slice(1)) ? true : Number(head.charAt(P - 1)) % 2 === 1;
    }
    if (up) {
      var arr = head.split('');
      var i = P - 1;
      while (i >= 0) {
        if (arr[i] === '9') { arr[i] = '0'; i--; } else { arr[i] = String(Number(arr[i]) + 1); break; }
      }
      if (i < 0) { head = '100000'; exp++; } else head = arr.join('');
    }
    var out;
    if (exp < -4 || exp >= P) {
      var mant = (head.charAt(0) + '.' + head.slice(1)).replace(/0+$/, '').replace(/\.$/, '');
      var e = Math.abs(exp);
      out = mant + 'e' + (exp < 0 ? '-' : '+') + (e < 10 ? '0' + e : String(e));
    } else if (exp >= 0) {
      var fp = head.slice(exp + 1).replace(/0+$/, '');
      out = head.slice(0, exp + 1) + (fp ? '.' + fp : '');
    } else {
      out = ('0.' + new Array(-exp).join('0') + head).replace(/0+$/, '').replace(/\.$/, '');
    }
    return (x < 0 ? '-' : '') + out;
  }

  // The conversion itself. Returns { ok: false, kind, ... } on overflow, else every figure the page shows.
  function convert(p, bits) {
    var scale = Math.pow(2, bits);
    var lo = INT_MIN / scale;
    var hi = INT_MAX / scale;
    var raw, prod;
    if (p.mode === 'int') {
      prod = p.n * scale;
      if (prod < INT_MIN || prod > INT_MAX) {
        return { ok: false, kind: 'int', scale: scale, prod: prod, wrapped: p.n << bits, loInt: Math.ceil(lo), hiInt: Math.floor(hi) };
      }
      raw = prod;
    } else {
      prod = p.fx * scale;
      var r = roundf(prod);
      if (r > INT_MAX || r < INT_MIN) return { ok: false, kind: 'float', scale: scale, prod: prod };
      raw = r;
    }
    if (raw === 0) raw = 0;
    var tf = Math.fround(Math.fround(raw) / scale); // (float)_value / (1 << bits)
    var shift = raw >> bits;                          // arithmetic shift: rounds toward minus infinity
    var div = Math.trunc(raw / scale);                // integer division: rounds toward zero
    var fp = raw & (scale - 1);
    var bin = (raw >>> 0).toString(2);
    while (bin.length < 32) bin = '0' + bin;
    var typedValue = p.mode === 'int' ? p.n : p.typed;
    var err = tf - typedValue;
    return {
      ok: true, scale: scale, raw: raw, prod: prod, bin: bin,
      tf: tf, tfText: plain(tf, bits), coutText: coutFloat(tf, bits),
      shift: shift, div: div, fp: fp, fv: plain(fp / scale, bits),
      eps: plain(1 / scale, bits), lo: plain(lo, bits), hi: plain(hi, bits),
      err: err === 0 ? '0' : shortNum(err, 4)
    };
  }
  // ---- end of the model ---------------------------------------------------------------------------------------------

  (window.Demos = window.Demos || {})['cpp02-fixed-point'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.classList.add('demo-body');
    mount.textContent = '';

    instances += 1;
    var uid = 'cpp02fx' + instances;
    var mode = 'float';
    var bits = FIXED_BITS;
    var PRESETS = [['int', '10'], ['float', '42.42f'], ['float', '1234.4321f'], ['float', '-1.5f']];

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

    // ---- interface ----
    var title = el('p', 'fx-title', t('title'));

    var modeLabel = el('p', 'fx-lbl', t('modeLabel'));
    var modes = el('div', 'demo-actions');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', t('modeLabel'));
    var modeBtns = {};
    [['int', 'Fixed( int )'], ['float', 'Fixed( float )']].forEach(function (m) {
      var b = button(m[1], function () { mode = m[0]; render(); });
      b.setAttribute('aria-pressed', 'false');
      modeBtns[m[0]] = b;
      modes.appendChild(b);
    });

    var input = el('input');
    input.type = 'text';
    input.id = uid + '-value';
    input.value = '42.42f';
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', 'off');
    var inLab = el('label', null, t('valueLabel'));
    inLab.setAttribute('for', input.id);
    var field = el('div', 'fx-field');
    field.appendChild(inLab);
    field.appendChild(input);

    var presetsLabel = el('p', 'fx-lbl', t('presetsLabel'));
    var presets = el('div', 'demo-actions');
    presets.setAttribute('role', 'group');
    presets.setAttribute('aria-label', t('presetsLabel'));
    PRESETS.forEach(function (p) {
      presets.appendChild(button(p[1], function () { mode = p[0]; input.value = p[1]; render(); }));
    });

    var slider = el('input');
    slider.type = 'range';
    slider.id = uid + '-bits';
    slider.min = '0';
    slider.max = '16';
    slider.step = '1';
    slider.value = String(FIXED_BITS);
    var bitsLab = el('label', null, t('bitsLabel'));
    bitsLab.setAttribute('for', slider.id);
    var bitsVal = el('span', 'fx-bitsval');
    var bitsRow = el('div', 'fx-bitsrow');
    bitsRow.appendChild(bitsLab);
    bitsRow.appendChild(slider);
    bitsRow.appendChild(bitsVal);
    // the button hides itself once the value is back to 8: hand the keyboard focus to the slider so it is not lost
    var backTo8 = button(t('backTo8'), function () { slider.value = String(FIXED_BITS); bits = FIXED_BITS; render(); slider.focus(); });
    var bitsNote = el('p', 'fx-note');

    var codeEl = el('div', 'mem-code fx-code');

    var result = el('div', 'verdict-box show');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    var rows = el('dl', 'fx-rows');
    var rawVal = el('dd', 'fx-big');
    var calcVal = el('dd', 'fx-mono');
    var binVal = el('dd');
    var tfVal = el('dd', 'fx-mono');
    var coutVal = el('dd', 'fx-mono');
    var tiVal = el('dd', 'fx-mono');
    var errVal = el('dd', 'fx-mono');
    var precVal = el('dd', 'fx-mono');
    [['rawLabel', rawVal], ['calcLabel', calcVal], ['binLabel', binVal], ['toFloatLabel', tfVal], ['coutLabel', coutVal],
     ['toIntLabel', tiVal], ['errLabel', errVal], ['precLabel', precVal]].forEach(function (r) {
      var row = el('div', 'fx-row');
      row.appendChild(el('dt', null, t(r[0])));
      row.appendChild(r[1]);
      rows.appendChild(row);
    });

    var bitsEl = el('div', 'fx-bits');
    bitsEl.setAttribute('role', 'img');
    var legend = el('p', 'fx-legend');
    var splitEl = el('p', 'fx-split');
    binVal.appendChild(bitsEl);
    binVal.appendChild(legend);
    binVal.appendChild(splitEl);

    [title, modeLabel, modes, field, presetsLabel, presets, bitsRow, backTo8, bitsNote, codeEl, result, rows]
      .forEach(function (n) { mount.appendChild(n); });

    function line(parent, text) { parent.appendChild(el('div', null, text)); }

    function clearResults() {
      codeEl.textContent = '';
      rows.hidden = true;
    }

    function render() {
      bits = Number(slider.value);
      bitsVal.textContent = String(bits);
      bitsNote.textContent = t(bits === FIXED_BITS ? 'bitsIsEight' : 'bitsNotEight');
      backTo8.hidden = bits === FIXED_BITS;
      ['int', 'float'].forEach(function (m) { modeBtns[m].setAttribute('aria-pressed', String(m === mode)); });

      var p = parseInput(input.value, mode);
      if (p.error) {
        clearResults();
        result.className = 'verdict-box show bad';
        result.textContent = t(p.error);
        return;
      }
      codeEl.textContent = 'Fixed const a( ' + p.lit + ' );';
      var c = convert(p, bits);
      if (!c.ok) {
        rows.hidden = true;
        result.className = 'verdict-box show bad';
        if (c.kind === 'int') {
          result.textContent = f('errIntOverflow', {
            n: p.n, bits: bits, prod: c.prod, wrapped: c.wrapped, lo: c.loInt, hi: c.hiInt
          });
        } else {
          result.textContent = f('errFloatOverflow', {
            fx: shortNum(p.fx, 9), scale: c.scale, prod: String(c.prod), min: INT_MIN, max: INT_MAX
          });
        }
        return;
      }
      rows.hidden = false;
      result.className = 'verdict-box show good';
      result.textContent = f('okLine', { raw: c.raw, tf: c.tfText, ti: c.shift });

      // raw
      rawVal.textContent = String(c.raw);

      // the computation
      calcVal.textContent = '';
      if (p.mode === 'int') {
        line(calcVal, f('stepInt', { n: p.n, bits: bits, scale: c.scale, raw: c.raw }));
      } else {
        if (String(p.typed) !== String(p.fx)) line(calcVal, f('stepFloatReal', { lit: p.lit, fx: shortNum(p.fx, 9) }));
        line(calcVal, f('stepFloat', { fx: shortNum(p.fx, 9), scale: c.scale, prod: String(c.prod), raw: c.raw }));
      }

      // the 32 bits
      var groups = c.bin.replace(/(.{4})(?=.)/g, '$1 ');
      bitsEl.textContent = '';
      bitsEl.setAttribute('aria-label', f('bitsAria', { bin: groups, n: bits }));
      for (var g = 0; g < 8; g++) {
        var nib = el('div', 'fx-nib');
        nib.setAttribute('aria-hidden', 'true');
        for (var k = 0; k < 4; k++) {
          var idx = g * 4 + k;
          var cls = 'fx-bit' + (c.bin.charAt(idx) === '1' ? ' on' : '') + (idx >= 32 - bits ? ' frac' : '') + (idx === 0 ? ' sign' : '');
          nib.appendChild(el('span', cls, c.bin.charAt(idx)));
        }
        bitsEl.appendChild(nib);
      }
      legend.textContent = t('legend');
      splitEl.textContent = f('splitLine', { bits: bits, ip: c.shift, fp: c.fp, scale: c.scale, fv: c.fv });

      // the floats
      tfVal.textContent = f('toFloatText', { tf: c.tfText, raw: c.raw, scale: c.scale });
      coutVal.textContent = f('coutText', { out: c.coutText });
      tiVal.textContent = c.shift === c.div
        ? f('toIntText', { ti: c.shift, bits: bits })
        : f('toIntNeg', { shift: c.shift, div: c.div, scale: c.scale, bits: bits });
      errVal.textContent = f('errText', { err: c.err });
      precVal.textContent = f('precText', { eps: c.eps, scale: c.scale, lo: c.lo, hi: c.hi });
    }

    input.addEventListener('input', render);
    slider.addEventListener('input', render);

    render();
  };
})();
