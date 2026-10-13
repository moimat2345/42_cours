(function () {
  'use strict';
  var FDS = [3, 4];     // the two descriptors of the demo
  var MAX_TEXT = 60;    // longest "file" the demo accepts (characters)
  var MIN_BS = 1, MAX_BS = 16, DEF_BS = 4;
  var KEEP_CALLS = 30;
  var SHOWN_READS = 6;
  var instances = 0;

  function fmt(str, vars) {
    return String(str || '').replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function lit(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += c === '\n' ? '\\n' : c === '\\' ? '\\\\' : c === '"' ? '\\"' : c;
    }
    return '"' + out + '"';
  }
  // one character = one byte: keep printable ASCII and newlines, cap the length
  function sanitize(raw) {
    var text = '', ignored = 0;
    for (var i = 0; i < raw.length; i++) {
      var code = raw.charCodeAt(i), c = raw.charAt(i);
      if (code >= 0xdc00 && code <= 0xdfff) continue;
      if (c === '\n' || (c >= ' ' && c <= '~')) {
        if (text.length < MAX_TEXT) text += c; // the textarea's maxlength already caps typing and pasting: this is only a safety net
      } else ignored++;
    }
    return { text: text, ignored: ignored };
  }
  function clampBs(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? DEF_BS : Math.min(MAX_BS, Math.max(MIN_BS, n));
  }
  // the lines a correct reader must return for a text, "\n" included
  function linesOf(text) {
    var out = [], i = 0;
    while (i < text.length) {
      var nl = text.indexOf('\n', i);
      if (nl === -1) { out.push(text.slice(i)); break; }
      out.push(text.slice(i, nl + 1));
      i = nl + 1;
    }
    return out;
  }

  // ---- the model: kernel side (one read offset per descriptor) + the program's static storage -----------------------
  // mode 'shared': one static string for every descriptor. mode 'perfd': one string per descriptor (array indexed by fd).
  function newState(mode, texts, bs) {
    var s = { mode: mode, bs: bs, reads: 0, calls: 0, files: {}, stash: {}, done: {}, expect: {} };
    FDS.forEach(function (fd) {
      s.files[fd] = { text: texts[fd], pos: 0 };
      s.stash[fd] = '';
      s.done[fd] = 0;
      s.expect[fd] = linesOf(texts[fd]);
    });
    s.stash.shared = '';
    return s;
  }
  function keyOf(s, fd) { return s.mode === 'shared' ? 'shared' : fd; }
  function callGnl(s, fd) {
    var key = keyOf(s, fd), f = s.files[fd], before = s.stash[key], st = before, reads = [];
    while (st.indexOf('\n') === -1) {
      var chunk = f.text.slice(f.pos, f.pos + s.bs); // read(fd, buf, BUFFER_SIZE)
      f.pos += chunk.length;
      s.reads++;
      reads.push({ i: s.reads, chunk: chunk });
      if (chunk.length === 0) break;                 // read() returned 0: end of this file
      st += chunk;
    }
    var line = null, nl = st.indexOf('\n');
    if (nl !== -1) { line = st.slice(0, nl + 1); st = st.slice(nl + 1); }
    else if (st.length > 0) { line = st; st = ''; }
    s.stash[key] = st;
    s.calls++;
    var want = s.expect[fd][s.done[fd]];
    s.done[fd]++;
    if (want === undefined) want = null;
    return { n: s.calls, fd: fd, key: key, before: before, reads: reads, after: st, line: line, want: want, ok: line === want };
  }

  (window.Demos = window.Demos || {})['get_next_line-multi-fd'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.textContent = '';
    var uid = 'gnlmfd' + (++instances);
    var mode = 'shared';
    var s = newState(mode, { 3: '', 4: '' }, DEF_BS);

    // ---- mode switch (the site's shared .seg tabs)
    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', T.mode_label);
    var modeBtns = {};
    [['shared', T.mode_shared], ['perfd', T.mode_perfd]].forEach(function (m) {
      var b = el('button', '', m[1]);
      b.type = 'button';
      b.addEventListener('click', function () { setMode(m[0]); });
      modeBtns[m[0]] = b;
      seg.appendChild(b);
    });

    var body = el('div', 'demo-body');
    var hint = el('p', 'mf-hint');
    hint.setAttribute('aria-live', 'polite');

    // ---- the two files, each with its own button
    var areas = {}, progress = {}, callBtns = {};
    var files = el('div', 'mf-files');
    FDS.forEach(function (fd) {
      var box = el('div', 'mf-file');
      var lab = el('label', '', fmt(T.file_label, { fd: fd }));
      lab.setAttribute('for', uid + '-f' + fd);
      var ta = el('textarea', 'mf-ta');
      ta.id = uid + '-f' + fd;
      ta.rows = 3;
      ta.maxLength = MAX_TEXT;
      ta.spellcheck = false;
      ta.setAttribute('autocomplete', 'off');
      ta.setAttribute('autocapitalize', 'off');
      ta.value = typeof T['file' + fd] === 'string' ? T['file' + fd] : '';
      ta.addEventListener('input', restart);
      var prog = el('p', 'mf-prog');
      var btn = el('button', 'btn', fmt(T.call_fd, { fd: fd }));
      btn.type = 'button';
      btn.addEventListener('click', function () { call(fd); });
      areas[fd] = ta; progress[fd] = prog; callBtns[fd] = btn;
      [lab, ta, prog, btn].forEach(function (n) { box.appendChild(n); });
      files.appendChild(box);
    });

    // ---- BUFFER_SIZE, restart, warnings
    var bsLabel = el('label', '', T.bs_label);
    bsLabel.setAttribute('for', uid + '-bs');
    var bs = el('input');
    bs.type = 'range';
    bs.id = uid + '-bs';
    bs.min = String(MIN_BS);
    bs.max = String(MAX_BS);
    bs.step = '1';
    bs.value = String(DEF_BS);
    bs.addEventListener('input', restart);
    var bsOut = el('output', 'mf-bsout', String(DEF_BS));
    bsOut.setAttribute('for', uid + '-bs');
    var bsRow = el('div', 'mf-bsrow');
    [bsLabel, bs, bsOut].forEach(function (n) { bsRow.appendChild(n); });

    var restartBtn = el('button', 'btn', T.restart);
    restartBtn.type = 'button';
    restartBtn.addEventListener('click', restart);
    var actions = el('div', 'demo-actions');
    actions.appendChild(restartBtn);

    var warn = el('p', 'mf-warn');
    warn.setAttribute('role', 'status');
    warn.hidden = true;

    var stashes = el('div', 'mf-stashes');
    var empty = el('p', 'mf-empty', T.empty);
    var log = el('div', 'mf-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', T.log_label);

    [hint, files, bsRow, actions, warn, stashes, empty, log].forEach(function (n) { body.appendChild(n); });
    mount.appendChild(seg);
    mount.appendChild(body);

    // ---- drawing
    function stashName(key) { return key === 'shared' ? T.stash_shared : fmt(T.stash_fd, { fd: key }); }
    function litNode(str) { return el('code', 'mf-lit', lit(str)); }
    // a static pointer is NULL while nothing is waiting: an empty string never exists in this model
    function stashNode(str) { return str === '' ? el('code', 'mf-lit mf-ptrnull', 'NULL') : litNode(str); }
    function drawState() {
      FDS.forEach(function (fd) {
        progress[fd].textContent = fmt(T.progress, { a: s.files[fd].pos, b: s.files[fd].text.length });
      });
      stashes.textContent = '';
      (s.mode === 'shared' ? ['shared'] : FDS).forEach(function (key) {
        var b = el('div', 'mf-stash');
        b.appendChild(el('span', 'mf-stash-k', stashName(key)));
        b.appendChild(stashNode(s.stash[key]));
        stashes.appendChild(b);
      });
      hint.textContent = s.mode === 'shared' ? T.hint_shared : T.hint_perfd;
      modeBtns.shared.classList.toggle('active', s.mode === 'shared');
      modeBtns.perfd.classList.toggle('active', s.mode === 'perfd');
      modeBtns.shared.setAttribute('aria-pressed', String(s.mode === 'shared'));
      modeBtns.perfd.setAttribute('aria-pressed', String(s.mode === 'perfd'));
    }
    function row(key, node) {
      var r = el('div', 'mf-row');
      r.appendChild(el('span', 'mf-k', key));
      var v = el('div', 'mf-v');
      v.appendChild(node);
      r.appendChild(v);
      return r;
    }
    function readsNode(reads, fd) {
      var box = el('div', 'mf-reads');
      if (reads.length === 0) { box.appendChild(el('span', 'mf-none', T.no_read)); return box; }
      var list = reads;
      if (reads.length > SHOWN_READS) {
        list = reads.slice(0, SHOWN_READS - 2);
        list.push({ fold: reads.length - (SHOWN_READS - 1) });
        list.push(reads[reads.length - 1]);
      }
      list.forEach(function (r) {
        var c = el('span', 'mf-read');
        if (r.fold) { c.classList.add('mf-fold'); c.textContent = fmt(T.more_reads, { n: r.fold }); box.appendChild(c); return; }
        c.appendChild(el('b', '', fmt(T.read_n, { i: r.i, fd: fd })));
        c.appendChild(litNode(r.chunk));
        if (r.chunk.length === 0) c.appendChild(el('span', 'mf-eof-tag', T.eof));
        box.appendChild(c);
      });
      return box;
    }
    function card(res) {
      var c = el('div', 'mf-call');
      c.appendChild(el('p', 'mf-head', fmt(T.call_head, { n: res.n, fd: res.fd })));
      c.appendChild(row(fmt(T.k_before, { name: stashName(res.key) }), stashNode(res.before)));
      c.appendChild(row(T.k_reads, readsNode(res.reads, res.fd)));
      c.appendChild(row(fmt(T.k_after, { name: stashName(res.key) }), stashNode(res.after)));
      c.appendChild(row(T.k_ret, res.line === null ? el('code', 'mf-lit mf-null', 'NULL') : litNode(res.line)));
      c.appendChild(row(fmt(T.k_want, { fd: res.fd }), res.want === null ? el('code', 'mf-lit mf-null', 'NULL') : litNode(res.want)));
      c.appendChild(el('p', 'mf-verdict ' + (res.ok ? 'ok' : 'bad'), res.ok ? T.verdict_ok : T.verdict_bad));
      return c;
    }

    // ---- state changes
    function readTexts() {
      var texts = {}, ignored = 0;
      FDS.forEach(function (fd) {
        var clean = sanitize(areas[fd].value);
        texts[fd] = clean.text; ignored += clean.ignored;
      });
      return { texts: texts, ignored: ignored };
    }
    function restart() {
      var t = readTexts();
      var n = clampBs(bs.value);
      bs.value = String(n);
      bsOut.textContent = String(n);
      s = newState(mode, t.texts, n);
      var msgs = [];
      if (t.ignored > 0) msgs.push(fmt(T.warn_ascii, { n: t.ignored }));
      warn.textContent = msgs.join(' ');
      warn.hidden = msgs.length === 0;
      log.textContent = '';
      empty.hidden = false;
      drawState();
    }
    function setMode(m) {
      if (m !== 'shared' && m !== 'perfd') return;
      mode = m;
      restart();
    }
    function call(fd) {
      var res = callGnl(s, fd);
      empty.hidden = true;
      log.insertBefore(card(res), log.firstChild);
      while (log.children.length > KEEP_CALLS) log.removeChild(log.lastChild);
      drawState();
    }

    restart();
  };
})();
