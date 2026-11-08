(function () {
  var seq = 0;

  (window.Demos = window.Demos || {})['cpp03-ctor-order'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.classList.add('demo-body');
    mount.textContent = '';
    seq += 1;
    var uid = 'cpp03co' + seq;

    // C++ names and declarations: code, identical in every language. Everything else comes from T.
    var CLASSES = [
      { name: 'ClapTrap', decl: ['class ClapTrap'], build: ['ClapTrap'], rows: [['ClapTrap']] },
      { name: 'ScavTrap', decl: ['class ScavTrap : public ClapTrap'], build: ['ClapTrap', 'ScavTrap'], rows: [['ClapTrap'], ['ScavTrap']] },
      { name: 'FragTrap', decl: ['class FragTrap : public ClapTrap'], build: ['ClapTrap', 'FragTrap'], rows: [['ClapTrap'], ['FragTrap']] },
      {
        name: 'DiamondTrap',
        decl: ['class ScavTrap : virtual public ClapTrap', 'class FragTrap : virtual public ClapTrap', 'class DiamondTrap : public ScavTrap, public FragTrap'],
        build: ['ClapTrap', 'ScavTrap', 'FragTrap', 'DiamondTrap'],
        rows: [['ClapTrap'], ['ScavTrap', 'FragTrap'], ['DiamondTrap']]
      }
    ];

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

    var cur = 0;       // index in CLASSES
    var phase = 'idle'; // idle | built | gone

    // ---- interface ----
    var title = el('p', 'co-title', t('title'));

    var pick = el('fieldset', 'co-pick');
    pick.appendChild(el('legend', 'co-lbl', t('classLabel')));
    var radios = CLASSES.map(function (c, i) {
      var id = uid + '-' + i;
      var wrap = el('span', 'co-opt');
      var input = el('input');
      input.type = 'radio';
      input.name = uid;
      input.id = id;
      input.value = String(i);
      input.checked = i === cur;
      input.addEventListener('change', function () {
        if (input.checked) { cur = i; phase = 'idle'; render(); }
      });
      var label = el('label', null, c.name);
      label.htmlFor = id;
      wrap.appendChild(input);
      wrap.appendChild(label);
      pick.appendChild(wrap);
      return input;
    });

    var declLabel = el('p', 'co-lbl', t('declLabel'));
    var declBox = el('div', 'mem-code co-code');
    var mainLabel = el('p', 'co-lbl', t('mainLabel'));
    var mainBox = el('div', 'mem-code co-code');

    var actions = el('div', 'demo-actions');
    var buildBtn = button(t('build'), function () {
      if (phase !== 'idle') return;
      phase = 'built';
      render();
    });
    var leaveBtn = button(t('leave'), function () {
      if (phase !== 'built') return;
      phase = 'gone';
      render();
    });
    var resetBtn = button(t('reset'), function () { phase = 'idle'; render(); });
    [buildBtn, leaveBtn, resetBtn].forEach(function (b) { actions.appendChild(b); });

    var layersLabel = el('p', 'co-lbl', t('layersLabel'));
    var layers = el('div', 'co-layers');
    layers.setAttribute('role', 'group');
    layers.setAttribute('aria-label', t('layersLabel'));

    var logLabel = el('p', 'co-lbl', t('logLabel'));
    var log = el('ol', 'co-log');
    log.setAttribute('aria-label', t('logLabel'));

    var msg = el('div', 'verdict-box show');
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');

    var left = el('div', 'co-col');
    [pick, declLabel, declBox, mainLabel, mainBox, actions].forEach(function (n) { left.appendChild(n); });
    var right = el('div', 'co-col');
    [layersLabel, layers, logLabel, log].forEach(function (n) { right.appendChild(n); });
    var grid = el('div', 'co-grid');
    grid.appendChild(left);
    grid.appendChild(right);

    [title, grid, msg].forEach(function (n) { mount.appendChild(n); });

    // ---- drawing ----
    function line(parent, text, isCurrent) {
      var d = el('span', 'co-cl' + (isCurrent ? ' cur' : ''));
      var mark = el('span', 'co-mark', isCurrent ? '▶' : ' ');
      mark.setAttribute('aria-hidden', 'true');
      d.appendChild(mark);
      d.appendChild(el('code', null, text));
      if (isCurrent) d.setAttribute('aria-current', 'step');
      parent.appendChild(d);
    }

    function stateOf() {
      if (phase === 'idle') return 'none';
      return phase === 'built' ? 'alive' : 'gone';
    }

    function render() {
      var c = CLASSES[cur];
      radios.forEach(function (r, i) { r.checked = i === cur; });

      // declarations and main()
      declBox.textContent = '';
      c.decl.forEach(function (d) { line(declBox, d, false); });
      mainBox.textContent = '';
      line(mainBox, '{', false);
      line(mainBox, '    ' + c.name + ' robo("Robo");', phase === 'built');
      line(mainBox, '}', phase === 'gone');

      // the object, as layers: the first one built is at the bottom (the DOM order is the construction order)
      layers.textContent = '';
      c.rows.forEach(function (row) {
        var r = el('div', 'co-row');
        row.forEach(function (name) {
          var st = stateOf();
          // rank shown next to the state: the construction order while alive, the destruction order once gone
          var n = st === 'gone' ? c.build.length - c.build.indexOf(name) : c.build.indexOf(name) + 1;
          var box = el('div', 'co-layer ' + st);
          var head = el('span', 'co-lname', name);
          box.appendChild(head);
          box.appendChild(document.createTextNode(' '));
          if (c.name === 'DiamondTrap' && name === 'ClapTrap') { box.appendChild(el('span', 'co-shared', t('shared'))); box.appendChild(document.createTextNode(' ')); }
          var glyph = st === 'alive' ? '✓ ' : (st === 'gone' ? '✗ ' : '· ');
          var key = st === 'alive' ? 'stAlive' : (st === 'gone' ? 'stGone' : 'stNone');
          var order = st === 'none' ? '' : ' #' + n;
          box.appendChild(el('span', 'co-lstate', glyph + t(key) + order));
          r.appendChild(box);
        });
        layers.appendChild(r);
      });

      // the program output
      log.textContent = '';
      var lines = [];
      if (phase !== 'idle') c.build.forEach(function (name) { lines.push({ kind: 'ctor', text: f('ctorLine', { cls: name }) }); });
      if (phase === 'gone') c.build.slice().reverse().forEach(function (name) { lines.push({ kind: 'dtor', text: f('dtorLine', { cls: name }) }); });
      if (!lines.length) {
        log.appendChild(el('li', 'co-empty', t('logEmpty')));
      } else {
        lines.forEach(function (ln, i) {
          var li = el('li', 'co-ln ' + ln.kind);
          li.appendChild(el('span', 'co-num', String(i + 1)));
          li.appendChild(document.createTextNode(' '));
          li.appendChild(el('code', null, ln.text));
          li.appendChild(document.createTextNode(' '));
          li.appendChild(el('span', 'co-tag', t(ln.kind === 'ctor' ? 'tagCtor' : 'tagDtor')));
          log.appendChild(li);
        });
      }

      // the sentence under the demo
      var sep = t('sep');
      if (phase === 'idle') {
        msg.textContent = t('idle');
      } else if (phase === 'built') {
        var key2 = c.name === 'ClapTrap' ? 'builtBase' : (c.name === 'DiamondTrap' ? 'builtDiamond' : 'built');
        msg.textContent = f(key2, { order: c.build.join(sep) });
      } else {
        msg.textContent = f('gone', { order: c.build.slice().reverse().join(sep) });
      }

      buildBtn.setAttribute('aria-disabled', String(phase !== 'idle'));
      leaveBtn.setAttribute('aria-disabled', String(phase !== 'built'));
      resetBtn.setAttribute('aria-disabled', String(phase === 'idle'));
    }

    render();
  };
})();
