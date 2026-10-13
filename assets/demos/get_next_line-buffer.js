(function () {
  'use strict';
  var MAX_TEXT = 120;   // longest "file" the demo accepts (characters)
  var MIN_BS = 1, MAX_BS = 16, DEF_BS = 4;
  var KEEP_CALLS = 30;  // call cards kept on screen (the simulation itself never forgets)
  var SHOWN_READS = 8;  // read() chips shown per call before the middle is folded
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
  // a string the way C writes it: "ab\nc"
  function lit(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += c === '\n' ? '\\n' : c === '\\' ? '\\\\' : c === '"' ? '\\"' : c;
    }
    return '"' + out + '"';
  }
  // The demo counts one character as one byte: keep printable ASCII and newlines, cap the length.
  function sanitize(raw) {
    var text = '', ignored = 0;
    for (var i = 0; i < raw.length; i++) {
      var code = raw.charCodeAt(i), c = raw.charAt(i);
      if (code >= 0xdc00 && code <= 0xdfff) continue; // second half of a surrogate pair: counted once, with the first
      if (c === '\n' || (c >= ' ' && c <= '~')) {
        if (text.length < MAX_TEXT) text += c; // the textarea's maxlength already caps typing and pasting: this is only a safety net
      } else ignored++;
    }
    return { text: text, ignored: ignored };
  }
  function clampBs(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return DEF_BS;
    return Math.min(MAX_BS, Math.max(MIN_BS, n));
  }

  // ---- the model: what get_next_line does, with a "file" that is a string and a read() that slices it ----------------
  function newState(text, bs) {
    return { text: text, bs: bs, pos: 0, stash: '', reads: 0, calls: 0, eof: false };
  }
  function callGnl(s) {
    var before = s.stash, reads = [], hadNl = s.stash.indexOf('\n') !== -1;
    while (s.stash.indexOf('\n') === -1) {
      var chunk = s.text.slice(s.pos, s.pos + s.bs); // read(fd, buf, BUFFER_SIZE)
      s.pos += chunk.length;
      s.reads++;
      reads.push({ i: s.reads, chunk: chunk });
      if (chunk.length === 0) { s.eof = true; break; } // read() returned 0: end of file
      s.stash += chunk;
    }
    var line = null, kind, nl = s.stash.indexOf('\n');
    if (nl !== -1) {
      line = s.stash.slice(0, nl + 1);
      s.stash = s.stash.slice(nl + 1);
      kind = hadNl ? 'noread' : 'found';
    } else if (s.stash.length > 0) {
      line = s.stash; s.stash = ''; kind = 'eofline';
    } else kind = 'null';
    s.calls++;
    return { n: s.calls, before: before, reads: reads, after: s.stash, line: line, total: s.reads, kind: kind };
  }

  (window.Demos = window.Demos || {})['get_next_line-buffer'] = function (root, T) {
    var mount = root.querySelector('.demo-mount');
    mount.classList.add('demo-body');
    mount.textContent = '';
    var uid = 'gnlbuf' + (++instances);

    var s = newState('', DEF_BS);

    // ---- controls
    var fileLabel = el('label', '', T.file_label);
    fileLabel.setAttribute('for', uid + '-file');
    var file = el('textarea', 'gb-file');
    file.id = uid + '-file';
    file.rows = 3;
    file.maxLength = MAX_TEXT;
    file.spellcheck = false;
    file.setAttribute('autocomplete', 'off');
    file.setAttribute('autocapitalize', 'off');
    file.value = typeof T.sample === 'string' ? T.sample : '';

    var bsLabel = el('label', '', T.bs_label);
    bsLabel.setAttribute('for', uid + '-bs');
    var bs = el('input');
    bs.type = 'range';
    bs.id = uid + '-bs';
    bs.min = String(MIN_BS);
    bs.max = String(MAX_BS);
    bs.step = '1';
    bs.value = String(DEF_BS);
    var bsOut = el('output', 'gb-bsout', String(DEF_BS));
    bsOut.setAttribute('for', uid + '-bs');
    var bsRow = el('div', 'gb-bsrow');
    bsRow.appendChild(bsLabel);
    bsRow.appendChild(bs);
    bsRow.appendChild(bsOut);

    var warn = el('p', 'gb-warn');
    warn.setAttribute('role', 'status');
    warn.hidden = true;

    var callBtn = el('button', 'btn', T.call);
    callBtn.type = 'button';
    var restartBtn = el('button', 'btn', T.restart);
    restartBtn.type = 'button';
    var actions = el('div', 'demo-actions');
    actions.appendChild(callBtn);
    actions.appendChild(restartBtn);

    // ---- the tape: the whole file, split in "already returned" / "in the static variable" / "not read yet"
    var tape = el('div', 'gb-tape');
    tape.setAttribute('aria-hidden', 'true');
    var legend = el('div', 'gb-legend');
    legend.setAttribute('aria-hidden', 'true');
    [['gb-done', T.legend_done, 'a'], ['gb-stash', T.legend_stash, 'a'], ['gb-unread', T.legend_unread, 'a'], ['gb-eof gb-eof-hit', T.legend_eof, 'EOF']].forEach(function (p) {
      var item = el('span', 'gb-legend-item');
      item.appendChild(el('span', 'gb-c ' + p[0], p[2]));
      item.appendChild(el('span', '', p[1]));
      legend.appendChild(item);
    });

    var empty = el('p', 'gb-empty', T.empty);
    var log = el('div', 'gb-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', T.log_label);

    var head = el('p', 'gb-title', T.title);
    [head, fileLabel, file, bsRow, warn, actions, tape, legend, empty, log].forEach(function (n) { mount.appendChild(n); });

    // ---- drawing
    function glyph(c) { return c === '\n' ? '↵' : c === ' ' ? '·' : c; }
    function drawTape() {
      tape.textContent = '';
      var doneEnd = s.pos - s.stash.length;
      for (var i = 0; i < s.text.length; i++) {
        var state = i < doneEnd ? 'gb-done' : i < s.pos ? 'gb-stash' : 'gb-unread';
        tape.appendChild(el('span', 'gb-c ' + state + (i === s.pos ? ' gb-at' : ''), glyph(s.text.charAt(i))));
      }
      tape.appendChild(el('span', 'gb-c gb-eof ' + (s.eof ? 'gb-eof-hit' : 'gb-unread') + (s.pos === s.text.length ? ' gb-at' : ''), 'EOF'));
    }
    function row(key, node) {
      var r = el('div', 'gb-row');
      r.appendChild(el('span', 'gb-k', key));
      var v = el('div', 'gb-v');
      v.appendChild(node);
      r.appendChild(v);
      return r;
    }
    function litNode(str) { return el('code', 'gb-lit', lit(str)); }
    // the static pointer is NULL while nothing is waiting: an empty string never exists in this model
    function stashNode(str) { return str === '' ? el('code', 'gb-lit gb-ptrnull', 'NULL') : litNode(str); }
    function readChip(r) {
      var c = el('span', 'gb-read');
      c.appendChild(el('b', '', fmt(T.read_n, { i: r.i })));
      c.appendChild(el('span', 'gb-bytes', fmt(T.bytes, { n: r.chunk.length })));
      c.appendChild(litNode(r.chunk));
      if (r.chunk.length === 0) c.appendChild(el('span', 'gb-eof-tag', T.eof));
      return c;
    }
    function readsNode(reads) {
      var box = el('div', 'gb-reads');
      if (reads.length === 0) { box.appendChild(el('span', 'gb-none', T.no_read)); return box; }
      var list = reads;
      if (reads.length > SHOWN_READS) {
        list = reads.slice(0, SHOWN_READS - 2);
        list.push({ fold: reads.length - (SHOWN_READS - 1) });
        list.push(reads[reads.length - 1]);
      }
      list.forEach(function (r) {
        if (r.fold) box.appendChild(el('span', 'gb-read gb-fold', fmt(T.more_reads, { n: r.fold })));
        else box.appendChild(readChip(r));
      });
      return box;
    }
    function card(res) {
      var c = el('div', 'gb-call');
      c.appendChild(el('p', 'gb-head', fmt(T.call_n, { n: res.n })));
      c.appendChild(row(T.k_before, stashNode(res.before)));
      c.appendChild(row(T.k_reads, readsNode(res.reads)));
      c.appendChild(row(T.k_after, stashNode(res.after)));
      c.appendChild(row(T.k_ret, res.line === null ? el('code', 'gb-lit gb-null', 'NULL') : litNode(res.line)));
      c.appendChild(row(T.k_total, el('span', 'gb-total', String(res.total))));
      c.appendChild(el('p', 'gb-note', T['note_' + res.kind]));
      return c;
    }

    // ---- state changes
    function restart() {
      var clean = sanitize(file.value);
      var n = clampBs(bs.value);
      bs.value = String(n);
      bsOut.textContent = String(n);
      s = newState(clean.text, n);
      var msgs = [];
      if (clean.ignored > 0) msgs.push(fmt(T.warn_ascii, { n: clean.ignored }));
      warn.textContent = msgs.join(' ');
      warn.hidden = msgs.length === 0;
      log.textContent = '';
      empty.hidden = false;
      drawTape();
    }
    function call() {
      var res = callGnl(s);
      empty.hidden = true;
      log.insertBefore(card(res), log.firstChild);
      while (log.children.length > KEEP_CALLS) log.removeChild(log.lastChild);
      drawTape();
    }

    file.addEventListener('input', restart);
    bs.addEventListener('input', restart);
    restartBtn.addEventListener('click', restart);
    callBtn.addEventListener('click', call);
    restart();
  };
})();
