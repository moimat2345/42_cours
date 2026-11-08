(function () {
  var instances = 0;

  // ---- model (no DOM) -----------------------------------------------------------------------------------------------
  // The triangle of the control cases: a(0,0), b(10,0), c(5,10). The point goes through Point(float, float), so its
  // coordinates become Fixed values: float rounded to 32 bits, then roundf( x * 256 ) / 256.
  var A = { x: 0, y: 0 };
  var B = { x: 10, y: 0 };
  var C = { x: 5, y: 10 };
  var STEP = 0.5;   // clicks on the drawing snap to this step
  var LIMIT = 1000; // typed coordinates must stay in [-LIMIT, LIMIT]
  var VIEW_MIN = -2;
  var VIEW_MAX = 22;

  function roundf(x) { return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5); }
  function quantize(v) { return roundf(Math.fround(v) * 256) / 256; }
  function clean(v) { return v === 0 ? 0 : v; } // never "-0"

  // Exact decimal text of a multiple of 2^-16, without useless trailing zeros.
  function plain(x) {
    var s = x.toFixed(16).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  // Cross product (p - o) x (q - o): twice the signed area of the triangle o, p, q.
  function cross(o, p, q) { return (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x); }
  function sign(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }

  // The verdict of bsp( a, b, c, point ) with the details the page shows.
  function evaluate(px, py) {
    var P = { x: quantize(px), y: quantize(py) };
    var d = [cross(A, B, P), cross(B, C, P), cross(C, A, P)];
    var s = d.map(sign);
    var zeros = s.filter(function (v) { return v === 0; }).length;
    var kind;
    var which = -1; // index of the zero product (edge) or of the vertex
    if (zeros === 0) {
      kind = s[0] === s[1] && s[1] === s[2] ? 'inside' : 'outside';
    } else if (zeros === 1) {
      var z = s.indexOf(0);
      var others = s.filter(function (v) { return v !== 0; });
      kind = others[0] === others[1] ? 'edge' : 'line';
      which = z;
    } else {
      kind = 'vertex';
      // d1 = 0 and d3 = 0: a ; d1 = 0 and d2 = 0: b ; d2 = 0 and d3 = 0: c
      which = s[0] === 0 && s[2] === 0 ? 0 : (s[0] === 0 && s[1] === 0 ? 1 : 2);
    }
    return { P: P, d: d, s: s, kind: kind, which: which, result: kind === 'inside', sum: d[0] + d[1] + d[2], area2: cross(A, B, C) };
  }
  // ---- end of the model ---------------------------------------------------------------------------------------------

  var EDGES = ['ab', 'bc', 'ca'];
  var VERTICES = ['a', 'b', 'c'];
  var EXPRS = ['(b - a) \u00d7 (p - a)', '(c - b) \u00d7 (p - b)', '(a - c) \u00d7 (p - c)'];

  (window.Demos = window.Demos || {})['cpp02-bsp'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.classList.add('demo-body');
    mount.textContent = '';

    instances += 1;
    var uid = 'cpp02bsp' + instances;
    var PRESETS = [[5, 5], [5, 0], [0, 0], [20, 20], [5, 10]];
    var current = { x: 5, y: 5 };
    var last = null;

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
    function numberField(id, label, value) {
      var input = el('input');
      input.type = 'number';
      input.id = id;
      input.step = String(STEP);
      input.value = String(value);
      var lab = el('label', null, label);
      lab.setAttribute('for', id);
      var box = el('div', 'bsp-field');
      box.appendChild(lab);
      box.appendChild(input);
      return { box: box, input: input };
    }

    // ---- interface ----
    var title = el('p', 'bsp-title', t('title'));
    var fx = numberField(uid + '-x', t('xLabel'), current.x);
    var fy = numberField(uid + '-y', t('yLabel'), current.y);
    var fields = el('div', 'bsp-fields');
    fields.appendChild(fx.box);
    fields.appendChild(fy.box);

    var presetsLabel = el('p', 'bsp-lbl', t('presetsLabel'));
    var presets = el('div', 'demo-actions');
    presets.setAttribute('role', 'group');
    presets.setAttribute('aria-label', t('presetsLabel'));
    PRESETS.forEach(function (p) {
      presets.appendChild(button('(' + p[0] + ', ' + p[1] + ')', function () { setPoint(p[0], p[1]); }));
    });

    var hint = el('p', 'bsp-hint', f('hint', { step: STEP }));
    var wrap = el('div', 'bsp-canvas-wrap');
    var canvas = el('canvas', 'bsp-canvas');
    canvas.setAttribute('role', 'img');
    wrap.appendChild(canvas);

    var result = el('div', 'verdict-box show');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    var pointLine = el('p', 'bsp-pointline');
    var offNote = el('p', 'bsp-note');

    var tableLabel = el('p', 'bsp-lbl', t('tableLabel'));
    var tw = el('div', 'table-wrap bsp-table');
    var table = el('table');
    var thead = el('thead');
    var hr = el('tr');
    ['colEdge', 'colExpr', 'colValue', 'colSign'].forEach(function (k) { hr.appendChild(el('th', null, t(k))); });
    thead.appendChild(hr);
    var tbody = el('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    tw.appendChild(table);
    var sumLine = el('p', 'bsp-sum');

    [title, fields, presetsLabel, presets, hint, wrap, result, pointLine, offNote, tableLabel, tw, sumLine]
      .forEach(function (n) { mount.appendChild(n); });

    // ---- drawing ----
    var size = 360;
    function color(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }

    function draw() {
      var avail = wrap.clientWidth || 360;
      size = Math.max(220, Math.min(420, avail));
      var dpr = window.devicePixelRatio || 1;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var span = VIEW_MAX - VIEW_MIN;
      var k = size / span;
      function X(x) { return (x - VIEW_MIN) * k; }
      function Y(y) { return size - (y - VIEW_MIN) * k; }
      var accent = color('--accent', '#5b9dff');
      var muted = color('--muted', '#8a93a6');
      var good = color('--stack', '#3ee6b0');
      var bad = color('--err', '#ff5d73');
      var warn = color('--amber', '#ffb454');
      var text = color('--text', '#e9ebf0');

      ctx.fillStyle = '#0c0f15';
      ctx.fillRect(0, 0, size, size);

      // grid: every unit, stronger every 5
      var u;
      for (u = VIEW_MIN; u <= VIEW_MAX; u++) {
        var strong = u % 5 === 0;
        ctx.strokeStyle = strong ? 'rgba(150,170,200,.22)' : 'rgba(150,170,200,.08)';
        ctx.lineWidth = u === 0 ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(X(u), 0); ctx.lineTo(X(u), size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, Y(u)); ctx.lineTo(size, Y(u)); ctx.stroke();
      }
      ctx.fillStyle = muted;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (u = 0; u <= VIEW_MAX; u += 5) {
        if (u !== 0) ctx.fillText(String(u), X(u), Y(0) + 4);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (u = 5; u <= VIEW_MAX; u += 5) ctx.fillText(String(u), X(0) - 5, Y(u));

      // triangle
      ctx.beginPath();
      ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(B.x), Y(B.y)); ctx.lineTo(X(C.x), Y(C.y)); ctx.closePath();
      ctx.fillStyle = 'rgba(91,157,255,.16)';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      // vertices
      ctx.fillStyle = text;
      ctx.font = '12px monospace';
      [[A, 'a(0,0)', 'left', 'top', -2, 8], [B, 'b(10,0)', 'left', 'bottom', 6, -8], [C, 'c(5,10)', 'left', 'bottom', 8, -6]].forEach(function (v) {
        ctx.beginPath(); ctx.arc(X(v[0].x), Y(v[0].y), 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = v[2]; ctx.textBaseline = v[3];
        ctx.fillText(v[1], X(v[0].x) + v[4], Y(v[0].y) + v[5]);
      });

      // the point: circle = inside, diamond = on the boundary, cross = outside
      if (last && last.P.x >= VIEW_MIN && last.P.x <= VIEW_MAX && last.P.y >= VIEW_MIN && last.P.y <= VIEW_MAX) {
        var px = X(last.P.x);
        var py = Y(last.P.y);
        var r = 7;
        ctx.lineWidth = 3;
        if (last.kind === 'inside') {
          ctx.fillStyle = good; ctx.strokeStyle = '#0c0f15';
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (last.kind === 'edge' || last.kind === 'vertex') {
          ctx.fillStyle = warn; ctx.strokeStyle = '#0c0f15';
          ctx.beginPath(); ctx.moveTo(px, py - r - 2); ctx.lineTo(px + r + 2, py); ctx.lineTo(px, py + r + 2); ctx.lineTo(px - r - 2, py); ctx.closePath();
          ctx.fill(); ctx.stroke();
        } else {
          ctx.strokeStyle = bad;
          ctx.beginPath(); ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r); ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r); ctx.stroke();
        }
        ctx.fillStyle = text;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('p', px + 10, py - 8);
      }
    }

    // ---- state ----
    function showError(key, vars) {
      last = null;
      tbody.textContent = '';
      tableLabel.hidden = true;
      tw.hidden = true;
      sumLine.textContent = '';
      pointLine.textContent = '';
      offNote.textContent = '';
      result.className = 'verdict-box show bad';
      result.textContent = f(key, vars);
      canvas.setAttribute('aria-label', f('canvasAriaEmpty', {}));
      draw();
    }

    function readNumber(input) {
      var v = input.valueAsNumber;
      if (v === undefined || v !== v) v = input.value.trim() === '' ? NaN : Number(input.value);
      return v;
    }

    function update() {
      var x = readNumber(fx.input);
      var y = readNumber(fy.input);
      if (!isFinite(x) || !isFinite(y)) { showError('errNumber'); return; }
      if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) { showError('errRange', { limit: LIMIT }); return; }
      current = { x: x, y: y };
      var e = evaluate(x, y);
      last = e;

      result.className = 'verdict-box show ' + (e.result ? 'good' : 'bad');
      var vars = { edge: EDGES[e.which] || '', vertex: VERTICES[e.which] || '' };
      result.textContent = f('v_' + e.kind, vars);
      canvas.setAttribute('aria-label', f('canvasAria', {
        x: plain(e.P.x), y: plain(e.P.y), verdict: f('s_' + e.kind, vars)
      }));

      pointLine.textContent = f('pointLine', { x: plain(e.P.x), y: plain(e.P.y) });
      var off = e.P.x < VIEW_MIN || e.P.x > VIEW_MAX || e.P.y < VIEW_MIN || e.P.y > VIEW_MAX;
      offNote.textContent = off ? f('offNote', { lo: VIEW_MIN, hi: VIEW_MAX }) : '';

      tableLabel.hidden = false;
      tw.hidden = false;
      tbody.textContent = '';
      for (var i = 0; i < 3; i++) {
        var tr = el('tr');
        tr.appendChild(el('td', null, EDGES[i]));
        tr.appendChild(el('td', null, EXPRS[i]));
        tr.appendChild(el('td', 'bsp-val', plain(clean(e.d[i]))));
        tr.appendChild(el('td', null, e.s[i] > 0 ? '> 0' : (e.s[i] < 0 ? '< 0' : '= 0')));
        if (e.s[i] === 0) tr.className = 'zero';
        tbody.appendChild(tr);
      }
      sumLine.textContent = f('sumLine', { sum: plain(clean(e.sum)), area2: plain(e.area2), area: plain(e.area2 / 2) });
      draw();
    }

    function setPoint(x, y) {
      fx.input.value = String(clean(x));
      fy.input.value = String(clean(y));
      update();
    }

    function fromEvent(ev) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      var span = VIEW_MAX - VIEW_MIN;
      var x = VIEW_MIN + ((ev.clientX - rect.left) / rect.width) * span;
      var y = VIEW_MAX - ((ev.clientY - rect.top) / rect.height) * span;
      setPoint(Math.round(x / STEP) * STEP, Math.round(y / STEP) * STEP);
    }

    canvas.addEventListener('pointerdown', fromEvent);
    canvas.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'mouse' && ev.buttons === 1) fromEvent(ev);
    });
    fx.input.addEventListener('input', update);
    fy.input.addEventListener('input', update);
    var lastWidth = 0;
    function redrawIfResized() {
      if (wrap.clientWidth === lastWidth) return;
      lastWidth = wrap.clientWidth;
      draw();
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { window.requestAnimationFrame(redrawIfResized); }).observe(wrap);
    } else {
      window.addEventListener('resize', redrawIfResized);
    }

    update();
  };
})();
