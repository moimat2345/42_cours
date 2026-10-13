(window.Demos = window.Demos || {})['born2beroot-lvm-builder'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // Sources : sujet Born2beRoot (version 4). Les numéros de page sont ceux imprimés en bas des pages du sujet.
  //   p. 7  (mandatory) : lsblk d'exemple, disque 8G, sda1 487M /boot, sda2 1K, sda5 7.5G, sda5_crypt, root 2.8G, swap 976M, home 3.8G
  //   p. 12 (bonus)     : lsblk d'exemple, disque 30.8G, sda1 500M /boot, sda2 1K, sda5 30.3G, sda5_crypt, volume group « LVMGroup » :
  //                       root 10G, swap 2.3G, home 5G, var 3G, srv 3G, tmp 3G, var-log 4G (affiché « LVMGroup-var--log »)
  //   p. 8 et p. 12     : « The example shows arbitrary disk sizes. You need to determine the appropriate size for each partition »
  var VG = 'LVMGroup';
  var BOOT = 0.5; // /boot : 487M (p. 7) ou 500M (p. 12) ; arrondi à 500M ici
  var DISK_DEFAULT = 10;
  var DISK_SUBJECT = { base: 8, bonus: 30.8 }; // tailles de disque des deux captures du sujet
  var VOLUMES = [
    { id: 'root', mnt: '/', bonus: false },
    { id: 'swap', mnt: '[SWAP]', bonus: false },
    { id: 'home', mnt: '/home', bonus: false },
    { id: 'var', mnt: '/var', bonus: true },
    { id: 'srv', mnt: '/srv', bonus: true },
    { id: 'tmp', mnt: '/tmp', bonus: true },
    { id: 'var-log', mnt: '/var/log', bonus: true }
  ];
  // Tailles de départ, en Go. Mandatory : celles de la capture p. 7, sauf le swap (976M, soit environ 0.95G) ramené à 0.9
  // pour que l'exemple de 8G tienne pile. Bonus : celles de la capture p. 12.
  var SUBJECT_SIZES = {
    base: { root: 2.8, swap: 0.9, home: 3.8 },
    bonus: { root: 10, swap: 2.3, home: 5, 'var': 3, srv: 3, tmp: 3, 'var-log': 4 }
  };
  var MIN_SIZE = 0.05, MAX_SIZE = 1000;

  function tr(key) { return typeof T[key] === 'string' ? T[key] : ''; }
  function fill(text, values) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function copy(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }

  // Sizes are compared in hundredths of a Go (integers): 7.5 - 2.8 - 0.9 - 3.8 is exactly 0, never 8.8e-16.
  function cents(x) { return Math.round(x * 100); }
  function num(c) { return String(c / 100); }                      // 950 -> "9.5"
  function lsblkSize(c) { return num(c) + 'G'; }                   // "9.5G", like lsblk
  var DEC = typeof T.dec === 'string' && T.dec ? T.dec : '.';
  var UNIT = typeof T.unit === 'string' && T.unit ? T.unit : 'G';
  function prose(c) { return num(c).replace('.', DEC) + ' ' + UNIT; } // "9,5 Go"

  var state = {
    disk: DISK_DEFAULT,
    bonus: false,
    sizes: { base: copy(SUBJECT_SIZES.base), bonus: copy(SUBJECT_SIZES.bonus) }
  };
  var invalid = {}; // volume id -> true while its field holds a value that cannot be used

  function mode() { return state.bonus ? 'bonus' : 'base'; }
  function active() { return VOLUMES.filter(function (v) { return state.bonus || !v.bonus; }); }
  function dm(id) { return id.replace(/-/g, '--'); } // device-mapper doubles the dashes of a name: var-log -> var--log

  // ---- controls -----------------------------------------------------------------------------------------------------
  var title = el('p', 'lb-title', tr('title'));

  var controls = el('div', 'lb-controls');
  // The <label> wraps only its text: a <label> labels its first labelable descendant, and <output> is labelable, so a label
  // that also contained the <output> before the slider would name the output instead of the slider.
  var diskBox = el('div', 'lb-disk');
  var diskHead = el('div', 'lb-disk-head');
  var sliderId = 'lb-disk-' + Math.random().toString(36).slice(2, 8);
  var diskLabel = el('label', 'lb-flabel', tr('disk'));
  diskLabel.htmlFor = sliderId;
  diskHead.appendChild(diskLabel);
  var diskOut = el('output', 'lb-disk-out');
  diskOut.setAttribute('for', sliderId);
  diskOut.setAttribute('aria-live', 'off'); // the slider already announces its own value (aria-valuetext)
  diskHead.appendChild(diskOut);
  var slider = el('input');
  slider.type = 'range';
  slider.id = sliderId;
  slider.min = '8';
  slider.max = '64';
  slider.step = '0.1';
  slider.value = String(state.disk);
  diskBox.appendChild(diskHead);
  diskBox.appendChild(slider);

  var swBox = el('label', 'lb-sw');
  var sw = el('input');
  sw.type = 'checkbox';
  sw.setAttribute('role', 'switch');
  var swText = el('span', 'lb-sw-text', tr('bonus'));
  var swState = el('span', 'lb-sw-state');
  swState.setAttribute('aria-hidden', 'true'); // the switch role already exposes on/off
  swBox.appendChild(sw);
  swBox.appendChild(swText);
  swBox.appendChild(swState);

  controls.appendChild(diskBox);
  controls.appendChild(swBox);

  // ---- per-volume sizes ---------------------------------------------------------------------------------------------
  var volsHead = el('p', 'lb-vols-head', tr('sizes'));
  var vols = el('div', 'lb-vols');
  var inputs = {};
  var rows = {};
  VOLUMES.forEach(function (v) {
    var row = el('label', 'lb-vol');
    row.appendChild(el('span', 'lb-vn', v.id));
    row.appendChild(el('span', 'lb-vm', v.mnt));
    var input = el('input');
    input.type = 'number';
    input.min = String(MIN_SIZE);
    input.max = String(MAX_SIZE);
    input.step = '0.05';
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', fill(tr('volLabel'), { name: v.id, mnt: v.mnt })); // "root / Go" read aloud says little
    input.addEventListener('input', function () {
      var x = parseFloat(input.value);
      if (!isFinite(x) || x < MIN_SIZE || x > MAX_SIZE) {
        invalid[v.id] = true;
        input.setAttribute('aria-invalid', 'true');
      } else {
        delete invalid[v.id];
        input.removeAttribute('aria-invalid');
        state.sizes[mode()][v.id] = x;
      }
      render();
    });
    row.appendChild(input);
    row.appendChild(el('span', 'lb-vu', UNIT));
    inputs[v.id] = input;
    rows[v.id] = row;
    vols.appendChild(row);
  });

  var actions = el('div', 'demo-actions lb-actions');
  var resetSizes = el('button', 'btn', tr('resetSizes'));
  resetSizes.type = 'button';
  resetSizes.addEventListener('click', function () {
    state.sizes[mode()] = copy(SUBJECT_SIZES[mode()]);
    invalid = {};
    syncInputs();
    render();
  });
  var subjectDisk = el('button', 'btn', tr('subjectDisk'));
  subjectDisk.type = 'button';
  subjectDisk.addEventListener('click', function () {
    state.disk = DISK_SUBJECT[mode()];
    slider.value = String(state.disk);
    render();
  });
  actions.appendChild(subjectDisk);
  actions.appendChild(resetSizes);

  // ---- result : lsblk tree, capacity bar, verdict --------------------------------------------------------------------
  var tree = el('pre', 'mem-code lb-tree');
  tree.tabIndex = 0;
  tree.setAttribute('role', 'group'); // aria-label on a bare <pre> is ignored by most assistive technology
  tree.setAttribute('aria-label', tr('treeLabel'));
  var legend = el('p', 'lb-legend');
  var bar = el('div', 'lb-bar');
  bar.setAttribute('role', 'img');
  var barNote = el('p', 'lb-bar-note', tr('barNote'));
  var verdict = el('div', 'verdict-box show lb-verdict');
  verdict.setAttribute('aria-live', 'polite');
  var hint = el('p', 'lb-hint', tr('hint'));

  mount.appendChild(title);
  mount.appendChild(controls);
  mount.appendChild(volsHead);
  mount.appendChild(vols);
  mount.appendChild(actions);
  mount.appendChild(tree);
  mount.appendChild(legend);
  mount.appendChild(bar);
  mount.appendChild(barNote);
  mount.appendChild(verdict);
  mount.appendChild(hint);

  function syncInputs() {
    var sizes = state.sizes[mode()];
    VOLUMES.forEach(function (v) {
      rows[v.id].hidden = v.bonus && !state.bonus;
      if (sizes[v.id] !== undefined) {
        inputs[v.id].value = String(sizes[v.id]);
        inputs[v.id].removeAttribute('aria-invalid');
      }
    });
  }

  // ---- the lsblk-like tree --------------------------------------------------------------------------------------------
  var NAME_W = 23, SIZE_W = 6, TYPE_W = 6;
  function pad(s, n) { while (s.length < n) s += ' '; return s; }
  function padLeft(s, n) { while (s.length < n) s = ' ' + s; return s; }
  function line(cls, name, size, type, mnt) {
    // inline rows ended by a real newline: copy and paste keeps one tree row per line
    var row = el('span', 'lb-row ' + cls);
    row.appendChild(document.createTextNode(pad(name, NAME_W) + ' ' + padLeft(size, SIZE_W) + ' ' + pad(type, TYPE_W) + ' '));
    if (mnt) row.appendChild(el('span', 'lb-mnt', mnt));
    row.appendChild(document.createTextNode('\n'));
    return row;
  }

  function render() {
    var disk = cents(state.disk);
    var bootC = cents(BOOT);
    var availC = disk - bootC; // size of sda5 = size of sda5_crypt (the 1K extended partition is ignored)
    var list = active();
    var sizes = state.sizes[mode()];
    var usedC = 0;
    list.forEach(function (v) { usedC += cents(sizes[v.id]); });
    var freeC = availC - usedC;

    // control state
    sw.checked = state.bonus;
    sw.setAttribute('aria-checked', String(state.bonus));
    swState.textContent = state.bonus ? tr('on') : tr('off');
    diskOut.textContent = prose(disk);
    slider.setAttribute('aria-valuetext', prose(disk));

    // tree
    tree.textContent = '';
    tree.appendChild(line('head', 'NAME', 'SIZE', 'TYPE', 'MOUNTPOINT'));
    tree.appendChild(line('disk', 'sda', lsblkSize(disk), 'disk', ''));
    tree.appendChild(line('part', '├─sda1', lsblkSize(bootC), 'part', '/boot'));
    tree.appendChild(line('part', '├─sda2', '1K', 'part', ''));
    tree.appendChild(line('part', '└─sda5', lsblkSize(availC), 'part', ''));
    tree.appendChild(line('crypt' + (freeC < 0 ? ' over' : ''), '  └─sda5_crypt', lsblkSize(availC), 'crypt', ''));
    list.forEach(function (v, i) {
      var branch = i === list.length - 1 ? '└─' : '├─';
      tree.appendChild(line('lvm', '    ' + branch + VG + '-' + dm(v.id), lsblkSize(cents(sizes[v.id])), 'lvm', v.mnt));
    });

    legend.textContent = fill(tr('legend'), { n: list.length, names: list.map(function (v) { return v.id; }).join(' · ') });

    // capacity bar: the disk is the full width, unless the volumes overflow it
    var total = Math.max(disk, bootC + usedC);
    bar.textContent = '';
    function seg(cls, c, label) {
      var s = el('span', 'lb-seg ' + cls);
      s.style.width = (c / total * 100) + '%';
      s.title = label;
      bar.appendChild(s);
    }
    seg('boot', bootC, '/boot ' + lsblkSize(bootC));
    list.forEach(function (v, i) { seg('v' + (i % 7), cents(sizes[v.id]), v.id + ' ' + lsblkSize(cents(sizes[v.id]))); });
    if (freeC > 0) seg('free', freeC, tr('freeLabel') + ' ' + lsblkSize(freeC));
    if (freeC < 0) {
      var cap = el('span', 'lb-cap');
      cap.style.left = (disk / total * 100) + '%';
      bar.appendChild(cap);
      var over = el('span', 'lb-overflow');
      over.style.left = (disk / total * 100) + '%';
      bar.appendChild(over);
    }
    bar.setAttribute('aria-label', fill(tr('barLabel'), { used: prose(usedC), avail: prose(availC) }));

    // verdict
    verdict.className = 'verdict-box show lb-verdict';
    var bad = Object.keys(invalid);
    if (bad.length) {
      verdict.classList.add('bad');
      verdict.textContent = fill(tr('invalid'), { min: String(MIN_SIZE).replace('.', DEC), max: MAX_SIZE, name: bad[0] });
    } else if (freeC < 0) {
      verdict.classList.add('bad');
      verdict.textContent = fill(tr('over'), { used: prose(usedC), avail: prose(availC), excess: prose(-freeC) });
    } else {
      verdict.classList.add('good');
      verdict.textContent = fill(tr('fit'), { used: prose(usedC), avail: prose(availC), free: prose(freeC) });
    }
  }

  slider.addEventListener('input', function () {
    var x = parseFloat(slider.value);
    if (isFinite(x)) state.disk = x;
    render();
  });
  sw.addEventListener('change', function () {
    state.bonus = sw.checked;
    invalid = {};
    syncInputs();
    render();
  });

  syncInputs();
  render();
};
