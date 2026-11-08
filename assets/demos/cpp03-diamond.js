(function () {
  var seq = 0;
  var NS = 'http://www.w3.org/2000/svg';

  (window.Demos = window.Demos || {})['cpp03-diamond'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.classList.add('demo-body');
    mount.textContent = '';
    seq += 1;
    var uid = 'cpp03dm' + seq;

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
    function sv(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
      if (text != null) e.textContent = text;
      return e;
    }

    var virt = false;

    // ---- interface ----
    var title = el('p', 'dm-title', t('title'));

    var sw = el('div', 'dm-switch');
    var box = el('input');
    box.type = 'checkbox';
    box.id = uid + '-virtual';
    box.checked = virt;
    var boxLabel = el('label', null, t('switchLabel'));
    boxLabel.htmlFor = box.id;
    sw.appendChild(box);
    sw.appendChild(boxLabel);
    box.addEventListener('change', function () { virt = box.checked; render(); });

    var declLabel = el('p', 'dm-lbl', t('declLabel'));
    var declBox = el('div', 'mem-code dm-code');

    var diagLabel = el('p', 'dm-lbl', t('diagLabel'));
    var svg = sv('svg', { viewBox: '0 0 360 300', 'class': 'dm-svg', role: 'img', focusable: 'false' });

    var orderLabel = el('p', 'dm-lbl', t('orderLabel'));
    var order = el('ol', 'dm-order');
    order.setAttribute('aria-label', t('orderLabel'));

    var result = el('div', 'dm-result');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    var left = el('div', 'dm-col');
    [sw, declLabel, declBox, orderLabel, order].forEach(function (n) { left.appendChild(n); });
    var right = el('div', 'dm-col');
    [diagLabel, svg].forEach(function (n) { right.appendChild(n); });
    var grid = el('div', 'dm-grid');
    grid.appendChild(left);
    grid.appendChild(right);

    [title, grid, result].forEach(function (n) { mount.appendChild(n); });

    // ---- drawing ----
    function declLine(who) {
      var d = el('span', 'dm-cl');
      var c = el('code');
      c.appendChild(document.createTextNode('class ' + who + ' : '));
      if (virt) {
        c.appendChild(el('span', 'dm-virt', 'virtual'));
        c.appendChild(document.createTextNode(' '));
      }
      c.appendChild(document.createTextNode('public ClapTrap'));
      d.appendChild(c);
      return d;
    }

    function drawDiagram() {
      svg.textContent = '';
      svg.setAttribute('aria-label', t(virt ? 'diagYes' : 'diagNo'));
      var defs = sv('defs');
      var mk = sv('marker', { id: uid + '-tri', viewBox: '0 0 12 12', refX: 11, refY: 6, markerWidth: 11, markerHeight: 11, orient: 'auto' });
      mk.appendChild(sv('path', { d: 'M1,1 L11,6 L1,11 Z', 'class': 'dm-tip' }));
      defs.appendChild(mk);
      svg.appendChild(defs);

      function edge(x1, y1, x2, y2, dashed) {
        svg.appendChild(sv('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'class': 'dm-edge' + (dashed ? ' virt' : ''), 'marker-end': 'url(#' + uid + '-tri)' }));
      }
      function node(x, y, name, sub, cls, subCls) {
        var g = sv('g', { 'class': 'dm-node ' + cls });
        g.appendChild(sv('rect', { x: x, y: y, width: 140, height: 50, rx: 10 }));
        g.appendChild(sv('text', { x: x + 70, y: y + 21, 'text-anchor': 'middle', 'class': 'dm-name' }, name));
        g.appendChild(sv('text', { x: x + 70, y: y + 38, 'text-anchor': 'middle', 'class': 'dm-sub' + (subCls ? ' ' + subCls : '') }, sub));
        svg.appendChild(g);
      }

      if (virt) {
        edge(120, 124, 150, 62, true);
        edge(240, 124, 210, 62, true);
        svg.appendChild(sv('text', { x: 118, y: 96, 'text-anchor': 'end', 'class': 'dm-vtext' }, 'virtual'));
        svg.appendChild(sv('text', { x: 242, y: 96, 'text-anchor': 'start', 'class': 'dm-vtext' }, 'virtual'));
      } else {
        edge(90, 124, 90, 62, false);
        edge(270, 124, 270, 62, false);
      }
      edge(145, 238, 112, 174, false);
      edge(215, 238, 248, 174, false);

      if (virt) {
        node(110, 12, 'ClapTrap', '✓ ' + t('subShared'), 'clap one');
      } else {
        node(20, 12, 'ClapTrap', '✗ ' + t('sub1'), 'clap dup');
        node(200, 12, 'ClapTrap', '✗ ' + t('sub2'), 'clap dup');
      }
      node(20, 124, 'ScavTrap', 'guardGate()', 'scav');
      node(200, 124, 'FragTrap', 'highFivesGuys()', 'frag');
      node(110, 238, 'DiamondTrap', 'whoAmI()', 'dia');
    }

    function drawOrder() {
      order.textContent = '';
      var list = virt ? ['ClapTrap', 'ScavTrap', 'FragTrap', 'DiamondTrap'] : ['ClapTrap', 'ScavTrap', 'ClapTrap', 'FragTrap', 'DiamondTrap'];
      list.forEach(function (name, i) {
        var li = el('li', 'dm-ln');
        li.appendChild(el('span', 'dm-num', String(i + 1)));
        li.appendChild(document.createTextNode(' '));
        li.appendChild(el('code', null, f('ctorLine', { cls: name })));
        if (!virt && i === 2) { li.appendChild(document.createTextNode(' ')); li.appendChild(el('span', 'dm-tag dup', t('dupTag'))); }
        if (virt && i === 0) { li.appendChild(document.createTextNode(' ')); li.appendChild(el('span', 'dm-tag one', t('sharedTag'))); }
        order.appendChild(li);
      });
    }

    function drawResult() {
      result.textContent = '';
      result.appendChild(el('p', 'dm-sum', t(virt ? 'sumYes' : 'sumNo')));
      var rows = [
        { expr: 'ClapTrap::_name', no: 'r1No', yes: 'r1Yes', okNo: false },
        { expr: 'ClapTrap *p = &d;', no: 'r2No', yes: 'r2Yes', okNo: false },
        { expr: 'd.takeDamage(1);', no: 'r3No', yes: 'r3Yes', okNo: false },
        { expr: 'ScavTrap::_name', no: 'r4No', yes: 'r4Yes', okNo: true }
      ];
      var ul = el('ul', 'dm-acc');
      ul.setAttribute('aria-label', t('accessLabel'));
      rows.forEach(function (r) {
        var ok = virt || r.okNo;
        var li = el('li', 'dm-row ' + (ok ? 'ok' : 'ko'));
        var head = el('span', 'dm-verdict', (ok ? '✓ ' : '✗ ') + t(ok ? 'okWord' : 'koWord'));
        li.appendChild(head);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(el('code', null, r.expr));
        li.appendChild(document.createTextNode(' '));
        li.appendChild(el('span', 'dm-why', t(virt ? r.yes : r.no)));
        ul.appendChild(li);
      });
      result.appendChild(el('p', 'dm-lbl', t('accessLabel')));
      result.appendChild(ul);
      result.appendChild(el('p', 'dm-note', t(virt ? 'noteYes' : 'noteNo')));
    }

    function render() {
      box.checked = virt;
      declBox.textContent = '';
      declBox.appendChild(declLine('ScavTrap'));
      declBox.appendChild(declLine('FragTrap'));
      var d = el('span', 'dm-cl');
      d.appendChild(el('code', null, 'class DiamondTrap : public ScavTrap, public FragTrap'));
      declBox.appendChild(d);
      drawDiagram();
      drawOrder();
      drawResult();
    }

    render();
  };
})();
