(window.Demos = window.Demos || {})['cpp07-iter-const'] = function (root, T) {
  // Every verdict below comes from a real program: 54 small programs (2 arrays x 3 function parameters x 3 ways of
  // passing the function x 3 signatures of iter) compiled with the command below, then run when they compiled.
  var COMPILER = 'Apple clang 17.0.0 (clang-1700.6.4.2)';
  var FLAGS = 'c++ -std=c++98 -Wall -Wextra -Werror';
  // First "error:" line and first "note:" line of the compiler, without the file position.
  var MSGS = [["error: no matching function for call to 'iter'", "note: candidate template ignored: couldn't infer template argument 'F'"], ["error: no matching function for call to 'iter'", "note: candidate template ignored: deduced conflicting types for parameter 'T' ('int' vs. 'const int')"], ["error: no matching function for call to 'iter'", "note: candidate function [with T = int] not viable: no overload of 'f' matching 'void (*)(int &)' for 3rd argument"], ["error: no matching function for call to 'iter'", "note: candidate template ignored: could not match 'T &' against 'int'"], ["error: binding reference of type 'int' to value of type 'const int' drops 'const' qualifier", "note: in instantiation of function template specialization 'iter<const int, void (*)(int &)>' requested here"], ["error: no matching function for call to 'iter'", "note: candidate template ignored: deduced conflicting types for parameter 'T' ('const int' vs. 'int')"], ["error: no matching function for call to 'iter'", "note: candidate function [with T = int] not viable: no overload of 'f' matching 'void (*)(const int &)' for 3rd argument"], ["error: cannot assign to variable 'x' with const-qualified type 'const int &'", "note: in instantiation of function template specialization 'f<const int>' requested here"], ["error: no matching function for call to 'iter'", "note: candidate function [with T = const int] not viable: no overload of 'f' matching 'void (*)(const int &)' for 3rd argument"]];
  // Key = array, function parameter, form, signature (digits). 0 = compiles and runs; [category, message index] = error.
  var DATA = {"0000":0,"0001":0,"0002":0,"0010":0,"0011":0,"0012":0,"0020":[0,0],"0021":0,"0022":0,"0100":0,"0101":[1,1],"0102":0,"0110":0,"0111":[1,1],"0112":0,"0120":[0,0],"0121":[2,2],"0122":0,"0200":0,"0201":[3,3],"0202":[3,3],"0210":0,"0211":[2,2],"0212":[2,2],"0220":[0,0],"0221":0,"0222":0,"1000":[4,4],"1001":[1,5],"1002":[1,5],"1010":[4,4],"1011":[1,5],"1012":[2,6],"1020":[0,0],"1021":[5,7],"1022":[5,7],"1100":0,"1101":0,"1102":0,"1110":0,"1111":0,"1112":0,"1120":[0,0],"1121":0,"1122":0,"1200":0,"1201":[3,3],"1202":[3,3],"1210":0,"1211":[2,8],"1212":[2,8],"1220":[0,0],"1221":0,"1222":0};
  var CATS = ["infer", "conflict", "nomatchfn", "shape", "constbody", "constfn"];

  // Code shown on screen (identical in every language). The loop of iter is left out on purpose.
  var SIG = [
    'template <typename T, typename F>\nvoid iter(T *array, const std::size_t length, F func) { ... }',
    'template <typename T>\nvoid iter(T *array, const std::size_t length, void (*func)(T &)) { ... }',
    'template <typename T>\nvoid iter(T *array, const std::size_t length, void (*func)(T &)) { ... }\n\ntemplate <typename T>\nvoid iter(const T *array, const std::size_t length, void (*func)(const T &)) { ... }'
  ];
  var ARR = ['int tab[3] = {1, 2, 3};', 'const int tab[3] = {1, 2, 3};'];
  var PLAIN = ['void f(int &x) { x += 1; }', 'void f(const int &x) { std::cout << x << " "; }', 'void f(int x) { std::cout << x << " "; }'];
  var TEMPL = [
    'template <typename T>\nvoid f(T &x) { x += 1; }',
    'template <typename T>\nvoid f(const T &x) { std::cout << x << " "; }',
    'template <typename T>\nvoid f(T x) { std::cout << x << " "; }'
  ];
  var CALL = ['iter(tab, 3, f);', 'iter(tab, 3, f<int>);', 'iter(tab, 3, f);'];
  // Preset cases: [array, function parameter, form, signature]
  var PRESETS = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0]];

  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

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
  function button(label, cls) {
    var b = el('button', cls || 'btn', label);
    b.type = 'button';
    return b;
  }

  var uid = Math.floor(Math.random() * 1e9);
  var count = 0;
  function select(labelKey, optionKeys, onChange) {
    count += 1;
    var id = 'ic-sel-' + uid + '-' + count;
    var wrap = el('div', 'ic-field');
    var label = el('label', null, tr(labelKey));
    label.setAttribute('for', id);
    var sel = el('select');
    sel.id = id;
    optionKeys.forEach(function (k, i) {
      var o = el('option', null, tr(k));
      o.value = String(i);
      sel.appendChild(o);
    });
    sel.addEventListener('change', onChange);
    wrap.appendChild(label);
    wrap.appendChild(sel);
    return { wrap: wrap, sel: sel };
  }

  var title = el('p', 'ic-title', tr('title'));

  var presets = el('div', 'demo-actions ic-presets');
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', tr('presets'));
  ['p1', 'p2', 'p3'].forEach(function (k, i) {
    var b = button(tr(k), 'btn ic-preset');
    b.addEventListener('click', function () { setAll(PRESETS[i]); });
    presets.appendChild(b);
  });

  var controls = el('div', 'ic-controls');
  var sArr = select('arrLabel', ['arr0', 'arr1'], render);
  var sFn = select('fnLabel', ['fn0', 'fn1', 'fn2'], render);
  var sForm = select('formLabel', ['form0', 'form1', 'form2'], render);
  var sSig = select('sigLabel', ['sig0', 'sig1', 'sig2'], render);
  [sArr, sFn, sForm, sSig].forEach(function (s) { controls.appendChild(s.wrap); });

  function panel(titleKey) {
    var box = el('div', 'ic-panel');
    box.appendChild(el('p', 'ic-panel-title', tr(titleKey)));
    var pre = el('pre', 'mem-code ic-code');
    pre.setAttribute('role', 'group');
    pre.setAttribute('aria-label', tr(titleKey));
    box.appendChild(pre);
    return { box: box, pre: pre };
  }
  var pSig = panel('shownSig');
  var pFn = panel('shownFn');
  var pMain = panel('shownMain');
  var panels = el('div', 'ic-panels');
  panels.appendChild(pSig.box);
  panels.appendChild(pFn.box);
  panels.appendChild(pMain.box);

  var verdict = el('div', 'ic-verdict');
  verdict.setAttribute('role', 'status');
  var vLine = el('p', 'ic-vline');
  var vWhy = el('p', 'ic-vwhy');
  var vMsgTitle = el('p', 'ic-panel-title');
  var vMsg = el('pre', 'mem-code ic-msg');
  vMsg.setAttribute('role', 'group');
  verdict.appendChild(vLine);
  verdict.appendChild(vWhy);
  verdict.appendChild(vMsgTitle);
  verdict.appendChild(vMsg);

  var meta = el('p', 'ic-meta', fill(tr('meta'), { compiler: COMPILER, flags: FLAGS, n: Object.keys(DATA).length }));

  mount.appendChild(title);
  mount.appendChild(presets);
  mount.appendChild(controls);
  mount.appendChild(panels);
  mount.appendChild(verdict);
  mount.appendChild(meta);

  function setAll(p) {
    sArr.sel.value = String(p[0]);
    sFn.sel.value = String(p[1]);
    sForm.sel.value = String(p[2]);
    sSig.sel.value = String(p[3]);
    render();
  }

  function render() {
    var a = parseInt(sArr.sel.value, 10);
    var f = parseInt(sFn.sel.value, 10);
    var o = parseInt(sForm.sel.value, 10);
    var s = parseInt(sSig.sel.value, 10);
    pSig.pre.textContent = SIG[s];
    pFn.pre.textContent = o === 0 ? PLAIN[f] : TEMPL[f];
    pMain.pre.textContent = ARR[a] + '\n' + CALL[o];

    var d = DATA['' + a + f + o + s];
    var ok = d === 0;
    verdict.classList.toggle('good', ok);
    verdict.classList.toggle('bad', !ok);
    if (ok) {
      vLine.textContent = '✓ ' + tr('ok');
      vWhy.textContent = tr('whyOk');
      vMsgTitle.textContent = '';
      vMsg.textContent = '';
      vMsg.hidden = true;
      vMsg.removeAttribute('aria-label');
    } else if (d) {
      vLine.textContent = '✗ ' + tr('ko');
      vWhy.textContent = tr('why' + CATS[d[0]].charAt(0).toUpperCase() + CATS[d[0]].slice(1));
      vMsgTitle.textContent = fill(tr('msgTitle'), { compiler: COMPILER });
      vMsg.textContent = MSGS[d[1]].join('\n');
      vMsg.hidden = false;
      vMsg.setAttribute('aria-label', fill(tr('msgTitle'), { compiler: COMPILER }));
    }
  }

  setAll(PRESETS[0]);
};
