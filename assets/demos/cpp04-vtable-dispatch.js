(window.Demos = window.Demos || {})['cpp04-vtable-dispatch'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // The two class families of the subject's ex00 (the second one is the "wrong" family: makeSound is not virtual there).
  // Class names and C++ tokens are code, not prose: they are the same in every language. All sentences come from T.
  var FAMILIES = {
    Animal: ['Dog', 'Cat', 'Animal'],
    WrongAnimal: ['WrongCat', 'WrongAnimal']
  };
  var BASES = ['Animal', 'WrongAnimal'];
  var SOUND_KEY = {
    Animal: 'soundAnimal', Dog: 'soundDog', Cat: 'soundCat',
    WrongAnimal: 'soundWrongAnimal', WrongCat: 'soundWrongCat'
  };

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

  // unique ids, so that a <label for> keeps working if the page ever holds two copies of the demo
  var fn0 = window.Demos['cpp04-vtable-dispatch'];
  fn0.count = (fn0.count || 0) + 1;
  var uid = 'cpp04vd' + fn0.count;

  // ---- interface ----
  var title = el('p', 'vd-title', t('title'));

  var ptrSel = el('select');
  ptrSel.id = uid + '-ptr';
  BASES.forEach(function (b) {
    var o = el('option', null, b + '*');
    o.value = b;
    ptrSel.appendChild(o);
  });
  var objSel = el('select');
  objSel.id = uid + '-obj';

  var virt = el('input');
  virt.type = 'checkbox';
  virt.id = uid + '-virtual';
  virt.checked = true;
  var virtLabel = el('label', 'vd-check');
  virtLabel.setAttribute('for', virt.id);

  function field(labelText, input) {
    var wrap = el('div', 'vd-field');
    var l = el('label', null, labelText);
    l.setAttribute('for', input.id);
    wrap.appendChild(l);
    wrap.appendChild(input);
    return wrap;
  }
  var controls = el('div', 'vd-controls');
  controls.appendChild(field(t('ptrLabel'), ptrSel));
  controls.appendChild(field(t('objLabel'), objSel));
  var switchRow = el('div', 'vd-switch');
  switchRow.appendChild(virt);
  switchRow.appendChild(virtLabel);
  controls.appendChild(switchRow);

  var presets = el('div', 'demo-actions');
  presets.appendChild(button(t('presetVirtual'), function () { apply('Animal', 'Dog', true); }));
  presets.appendChild(button(t('presetStatic'), function () { apply('WrongAnimal', 'WrongCat', false); }));

  var hint = el('p', 'vd-hint', t('hint'));

  var codeLabel = el('p', 'vd-lbl', t('codeLabel'));
  var code = el('pre', 'mem-code vd-code');
  code.setAttribute('role', 'group');
  code.setAttribute('aria-label', t('codeLabel'));

  var stepsLabel = el('p', 'vd-lbl', t('stepsLabel'));
  var steps = el('ol', 'vd-steps');
  steps.setAttribute('aria-label', t('stepsLabel'));

  var vtLabel = el('p', 'vd-lbl');
  var vtable = el('div', 'vd-vtable');
  var vtRow = el('div', 'vd-vtrow');
  vtable.appendChild(vtRow);

  var outBox = el('div', 'vd-out');
  outBox.appendChild(el('span', 'vd-lbl', t('outputLabel')));
  var outEl = el('code', 'vd-sound');
  outBox.appendChild(outEl);

  var msg = el('div', 'verdict-box show');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  [title, controls, presets, hint, codeLabel, code, stepsLabel, steps, vtLabel, vtable, outBox, msg]
    .forEach(function (n) { mount.appendChild(n); });

  // ---- logic ----
  function baseOf() {
    return FAMILIES[ptrSel.value] ? ptrSel.value : 'Animal'; // an unknown value falls back to the first family
  }
  function fillObjects(keep) {
    var list = FAMILIES[baseOf()];
    objSel.textContent = '';
    list.forEach(function (name) {
      var o = el('option', null, 'new ' + name + '()');
      o.value = name;
      objSel.appendChild(o);
    });
    objSel.value = list.indexOf(keep) >= 0 ? keep : list[0];
  }
  function apply(base, obj, isVirtual) {
    ptrSel.value = base;
    fillObjects(obj);
    virt.checked = !!isVirtual;
    render();
  }

  function codeText(base, obj, isVirtual) {
    code.textContent = '';
    function line(parts) {
      parts.forEach(function (p) {
        if (typeof p === 'string') code.appendChild(document.createTextNode(p));
        else code.appendChild(el('span', p.cls, p.text));
      });
      code.appendChild(document.createTextNode('\n'));
    }
    var v = { cls: isVirtual ? 'vd-kw on' : 'vd-kw', text: isVirtual ? 'virtual ' : '' };
    line(['class ' + base]);
    line(['{']);
    line(['    public:']);
    line(['        ', v, 'void makeSound() const;']);
    line(['};']);
    if (obj !== base) {
      line(['']);
      line(['class ' + obj + ' : public ' + base]);
      line(['{']);
      line(['    public:']);
      line(['        void makeSound() const;']);
      line(['};']);
    }
    line(['']);
    line([base + '* p = new ' + obj + '();']);
    code.appendChild(el('span', 'vd-call', 'p->makeSound();'));
  }

  function addStep(when, text) {
    var li = el('li');
    li.appendChild(el('span', 'vd-when', when));
    li.appendChild(el('span', 'vd-text', text));
    steps.appendChild(li);
  }

  function render() {
    var base = baseOf();
    var obj = FAMILIES[base].indexOf(objSel.value) >= 0 ? objSel.value : FAMILIES[base][0];
    var isVirtual = virt.checked;
    var called = isVirtual ? obj : base;          // the class whose makeSound runs
    var fn = called + '::makeSound';
    var sound = t(SOUND_KEY[called]);
    var vars = { base: base, obj: obj, fn: fn, own: obj + '::makeSound', out: sound };

    virtLabel.textContent = f('virtualLabel', vars);
    codeText(base, obj, isVirtual);

    steps.textContent = '';
    if (!isVirtual) {
      addStep(t('whenCompile'), f('stStatic1', vars));
      addStep(t('whenRun'), f('stStatic2', vars));
    } else {
      addStep(t('whenCompile'), f('stDyn1', vars));
      addStep(t('whenRun'), f('stDyn2', vars));
      addStep(t('whenRun'), f(obj === base ? 'stDyn3Base' : 'stDyn3Own', vars));
    }

    vtLabel.textContent = f('vtTitle', vars);
    vtRow.textContent = '';
    vtRow.classList.toggle('off', !isVirtual);
    if (isVirtual) {
      vtRow.appendChild(el('code', null, 'makeSound → ' + fn));
      vtRow.appendChild(el('span', 'vd-used', t('vtUsed')));
    } else {
      vtRow.appendChild(el('code', null, 'makeSound'));
      vtRow.appendChild(el('span', 'vd-used', t('vtOff')));
    }

    outEl.textContent = sound;

    var key, ok;
    if (isVirtual) { key = 'vDyn'; ok = true; }
    else if (obj === base) { key = 'vStaticSame'; ok = true; }
    else { key = 'vStaticLost'; ok = false; }
    msg.className = 'verdict-box show ' + (ok ? 'good' : 'bad');
    msg.textContent = (ok ? '✓ ' : '✗ ') + f(key, vars);
  }

  ptrSel.addEventListener('change', function () { ptrSel.value = baseOf(); fillObjects(objSel.value); render(); });
  objSel.addEventListener('change', render);
  virt.addEventListener('change', render);

  fillObjects('Dog');
  render();
};
