(window.Demos = window.Demos || {})['cpp00-account-log'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // Modèle de la classe Account du sujet CPP00 (version 11.0), exercice 02, pages imprimées 11 et 12 : quatre compteurs
  // static partagés par tous les comptes (nbAccounts, totalAmount, totalNbDeposits, totalNbWithdrawals) et, par compte,
  // un montant et deux compteurs. La forme des lignes du journal est celle du fichier de log fourni avec le sujet
  // (elle vit dans les textes de la page, clés log*), qui est téléchargé sur l'intranet et ne figure pas dans le PDF.
  var MAX_ACCOUNTS = 8;      // tests.cpp crée 8 comptes ; la démo s'arrête là
  var MAX_AMOUNT = 1000000;  // reste très loin des limites d'un int
  var MAX_LINES = 200;       // le journal garde les 200 dernières lignes

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

  // --- état : les membres static de la classe, puis les comptes -----------------------------------------------------
  var accounts = [];            // { amount, nbDeposits, nbWithdrawals }
  var totalAmount = 0;          // Account::_totalAmount
  var totalNbDeposits = 0;      // Account::_totalNbDeposits
  var totalNbWithdrawals = 0;   // Account::_totalNbWithdrawals
  var lines = [];
  var selected = 0;

  // --- interface --------------------------------------------------------------------------------------------------
  var title = el('p', 'al-title', tr('title'));

  var counterBox = el('div', 'al-counterbox');
  counterBox.setAttribute('role', 'group');
  counterBox.setAttribute('aria-label', tr('countersLabel'));
  var counters = el('dl', 'al-counters');
  counterBox.appendChild(counters);
  var counterValues = {};
  ['nbAccounts', 'totalAmount', 'totalNbDeposits', 'totalNbWithdrawals'].forEach(function (key) {
    var box = el('div', 'al-counter');
    var dt = el('dt');
    dt.appendChild(el('code', '', tr(key)));
    var dd = el('dd', 'al-value', '0');
    box.appendChild(dt);
    box.appendChild(dd);
    counters.appendChild(box);
    counterValues[key] = dd;
  });

  var controls = el('div', 'al-controls');
  var amountWrap = el('div', 'al-field');
  var amountIn = el('input');
  amountIn.id = 'cpp00-al-amount';      // un vrai <label for>, pas un label qui enveloppe le champ
  var amountLabel = el('label', 'al-flabel', tr('amountLabel'));
  amountLabel.htmlFor = amountIn.id;
  amountWrap.appendChild(amountLabel);
  amountIn.type = 'number';
  amountIn.min = '0';
  amountIn.max = String(MAX_AMOUNT);
  amountIn.step = '1';
  amountIn.placeholder = tr('amountPh');
  amountWrap.appendChild(amountIn);
  var accountWrap = el('div', 'al-field');
  var accountSel = el('select');
  accountSel.id = 'cpp00-al-account';
  var accountLabel = el('label', 'al-flabel', tr('accountLabel'));
  accountLabel.htmlFor = accountSel.id;
  accountWrap.appendChild(accountLabel);
  accountWrap.appendChild(accountSel);
  controls.appendChild(amountWrap);
  controls.appendChild(accountWrap);

  var actions = el('div', 'demo-actions al-actions');
  function button(key, handler) {
    var b = el('button', 'btn', tr(key));
    b.type = 'button';
    b.addEventListener('click', handler);
    actions.appendChild(b);
    return b;
  }

  var verdict = el('div', 'verdict-box al-verdict');
  verdict.setAttribute('role', 'status');

  var logCap = el('p', 'al-cap', tr('logCaption'));
  var log = el('pre', 'al-log');
  log.setAttribute('role', 'group');
  log.setAttribute('aria-label', tr('logLabel'));
  log.tabIndex = 0;

  mount.appendChild(title);
  mount.appendChild(counterBox);
  mount.appendChild(controls);
  mount.appendChild(actions);
  mount.appendChild(verdict);
  mount.appendChild(logCap);
  mount.appendChild(log);

  // --- journal ----------------------------------------------------------------------------------------------------
  function two(n) { return (n < 10 ? '0' : '') + n; }
  // _displayTimestamp() : l'heure locale, chaque nombre complété à deux chiffres (comme setw(2) avec setfill('0'))
  function stamp() {
    var d = new Date();
    return fill(tr('ts'), { y: d.getFullYear(), mo: two(d.getMonth() + 1), d: two(d.getDate()), h: two(d.getHours()), mi: two(d.getMinutes()), s: two(d.getSeconds()) });
  }
  function write(key, values) {
    lines.push(stamp() + fill(tr(key), values));
    if (lines.length > MAX_LINES) lines.shift();
  }

  // --- affichage --------------------------------------------------------------------------------------------------
  function say(kind, text) {
    verdict.className = 'verdict-box show al-verdict' + (kind ? ' ' + kind : '');
    verdict.textContent = text;
  }

  function refresh() {
    counterValues.nbAccounts.textContent = String(accounts.length);
    counterValues.totalAmount.textContent = String(totalAmount);
    counterValues.totalNbDeposits.textContent = String(totalNbDeposits);
    counterValues.totalNbWithdrawals.textContent = String(totalNbWithdrawals);

    accountSel.textContent = '';
    if (!accounts.length) {
      var none = el('option', '', tr('noAccount'));
      none.value = '';
      accountSel.appendChild(none);
      accountSel.disabled = true;
    } else {
      accountSel.disabled = false;
      accounts.forEach(function (a, i) {
        var o = el('option', '', fill(tr('accountOption'), { index: i, amount: a.amount }));
        o.value = String(i);
        accountSel.appendChild(o);
      });
      if (selected >= accounts.length) selected = accounts.length - 1;
      accountSel.value = String(selected);
    }
    log.textContent = lines.join('\n');
    log.scrollTop = log.scrollHeight;
  }

  // --- lecture des champs -----------------------------------------------------------------------------------------
  // Renvoie un entier de 0 à MAX_AMOUNT, ou -1 (champ vide, signe, virgule, notation scientifique, trop grand).
  function readAmount() {
    var text = amountIn.value.trim();
    if (!/^[0-9]+$/.test(text)) return -1;
    var n = parseInt(text, 10);
    return n <= MAX_AMOUNT ? n : -1;
  }
  function badAmount() {
    amountIn.setAttribute('aria-invalid', 'true');
    amountIn.focus();
    say('bad', fill(tr('errAmount'), { max: MAX_AMOUNT }));
  }
  function currentAccount() {
    if (!accounts.length) {
      say('bad', tr('errNoAccount'));
      return -1;
    }
    selected = parseInt(accountSel.value, 10);
    return selected;
  }

  // --- actions : les méthodes de la classe ------------------------------------------------------------------------
  function create() {
    var n = readAmount();
    if (n < 0) { badAmount(); return; }
    amountIn.removeAttribute('aria-invalid');
    if (accounts.length >= MAX_ACCOUNTS) { say('bad', fill(tr('errMax'), { max: MAX_ACCOUNTS })); return; }
    var index = accounts.length;                      // _accountIndex = _nbAccounts
    accounts.push({ amount: n, nbDeposits: 0, nbWithdrawals: 0 });
    totalAmount += n;                                 // _totalAmount += initial_deposit
    selected = index;
    write('logCreated', { index: index, amount: n });
    say('good', fill(tr('okCreate'), { index: index, amount: n }));
    refresh();
  }

  function deposit() {
    var n = readAmount();
    if (n < 0) { badAmount(); return; }
    amountIn.removeAttribute('aria-invalid');
    var index = currentAccount();
    if (index < 0) return;
    var a = accounts[index];
    var previous = a.amount;
    a.amount += n;
    a.nbDeposits += 1;
    totalAmount += n;
    totalNbDeposits += 1;
    write('logDeposit', { index: index, prev: previous, value: n, amount: a.amount, nb: a.nbDeposits });
    say('good', fill(tr('okDeposit'), { index: index, amount: n }));
    refresh();
  }

  function withdraw() {
    var n = readAmount();
    if (n < 0) { badAmount(); return; }
    amountIn.removeAttribute('aria-invalid');
    var index = currentAccount();
    if (index < 0) return;
    var a = accounts[index];
    var previous = a.amount;
    if (n > a.amount) {                               // makeWithdrawal renvoie false, aucun compteur ne bouge
      write('logRefused', { index: index, prev: previous });
      say('bad', fill(tr('refused'), { index: index, amount: n, balance: a.amount }));
      refresh();
      return;
    }
    a.amount -= n;
    a.nbWithdrawals += 1;
    totalAmount -= n;
    totalNbWithdrawals += 1;
    write('logWithdraw', { index: index, prev: previous, value: n, amount: a.amount, nb: a.nbWithdrawals });
    say('good', fill(tr('okWithdraw'), { index: index, amount: n }));
    refresh();
  }

  // Account::displayAccountsInfos() puis displayStatus() de chaque compte
  function show() {
    write('logInfos', { accounts: accounts.length, total: totalAmount, deposits: totalNbDeposits, withdrawals: totalNbWithdrawals });
    accounts.forEach(function (a, i) {
      write('logStatus', { index: i, amount: a.amount, deposits: a.nbDeposits, withdrawals: a.nbWithdrawals });
    });
    say('good', tr('okShow'));
    refresh();
  }

  function reset() {
    accounts = [];
    totalAmount = 0;
    totalNbDeposits = 0;
    totalNbWithdrawals = 0;
    lines = [];
    selected = 0;
    amountIn.value = '';
    amountIn.removeAttribute('aria-invalid');
    say('', tr('okReset'));
    refresh();
  }

  button('create', create);
  button('deposit', deposit);
  button('withdraw', withdraw);
  button('show', show);
  button('reset', reset);
  accountSel.addEventListener('change', function () {
    var v = parseInt(accountSel.value, 10);
    if (!isNaN(v)) selected = v;
  });

  say('', tr('idle'));
  refresh();
};
