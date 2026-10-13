(function () {
  'use strict';
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: ignore */ } }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // 1. remember the language the visitor picked (read back by the root redirect page)
  each(document.querySelectorAll('a.lang'), function (a) {
    a.addEventListener('click', function () { lsSet('lang', a.getAttribute('hreflang')); });
  });

  // 2. home: filter cards by group, hide blocks left empty
  var buttons = document.querySelectorAll('.filter button');
  function applyFilter(group) {
    each(document.querySelectorAll('.pcard'), function (c) {
      c.hidden = !(group === 'all' || c.getAttribute('data-group') === group);
    });
    each(document.querySelectorAll('.block'), function (b) {
      b.hidden = !b.querySelector('.pcard:not([hidden])');
    });
  }
  each(buttons, function (btn) {
    btn.addEventListener('click', function () {
      each(buttons, function (x) {
        x.classList.toggle('on', x === btn);
        x.setAttribute('aria-pressed', String(x === btn));
      });
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // 3. reveal on scroll
  var reveals = document.querySelectorAll('.reveal');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !calm) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' }); // threshold 0: a very tall block (card grid on a phone) must still reveal
    each(reveals, function (el) { io.observe(el); });
  } else {
    each(reveals, function (el) { el.classList.add('show'); });
  }

  // 4. table of contents: highlight the section being read.
  // Computed from the scroll position, not with an IntersectionObserver: an observer only fires when an intersection
  // changes, so a band that ends above the last section's end-of-page position would never reach it.
  var links = document.querySelectorAll('.tocbar a');
  if (links.length) {
    var entries = [];
    each(links, function (a) {
      var s = document.getElementById((a.getAttribute('href') || '').slice(1));
      if (s) entries.push({ a: a, s: s });
    });
    var current = null, pending = false;
    var spy = function () {
      pending = false;
      // reading line: 35% of the viewport, clamped to just under the anchor landing line (scroll-padding-top), so a section
      // reached through its chip always counts as reached even when the next section starts less than a third of a screen below
      var land = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var probe = Math.min(Math.max(window.innerHeight * 0.35, land + 8), land + 40), hit = null;
      entries.forEach(function (e) { if (e.s.getBoundingClientRect().top <= probe) hit = e; });
      // "bottom of the page means the last section" only makes sense when the page can scroll: a page that fits in the
      // window is always "at the bottom", and would highlight its last section while the reader is still at the top
      var docEl = document.documentElement, scrollable = docEl.scrollHeight > window.innerHeight + 2;
      if (entries.length && scrollable && window.innerHeight + window.scrollY >= docEl.scrollHeight - 2) hit = entries[entries.length - 1];
      if (hit === current) return;
      current = hit;
      entries.forEach(function (e) {
        e.a.classList.toggle('on', e === hit);
        if (e === hit) e.a.setAttribute('aria-current', 'true'); else e.a.removeAttribute('aria-current');
      });
      // scroll only the strip itself: scrollIntoView would also move the page and fight a smooth anchor scroll in flight
      // (rects, not offsetLeft: .tocbar-in is not positioned, so offsetLeft is measured from an ancestor)
      var bar = entries.length ? entries[0].a.parentNode : null;
      if (!bar || !bar.scrollTo) return;
      if (!hit) { bar.scrollTo({ left: 0 }); return; } // back above the first section: the strip returns to its start too
      var ar = hit.a.getBoundingClientRect(), br = bar.getBoundingClientRect();
      bar.scrollTo({ left: bar.scrollLeft + (ar.left - br.left) - (bar.clientWidth - ar.width) / 2 });
    };
    var schedule = function () { if (!pending) { pending = true; window.requestAnimationFrame(spy); } };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    spy();
  }

  // 5. interactive demos: demo scripts register window.Demos[name] = function (root, T)
  each(document.querySelectorAll('[data-demo]'), function (root) {
    var name = root.getAttribute('data-demo');
    var init = window.Demos && window.Demos[name];
    if (typeof init !== 'function') return;
    var T = {};
    var tag = root.querySelector('script.demo-i18n');
    if (tag) {
      try { T = JSON.parse(tag.textContent); } catch (e) { console.error('demo-i18n of ' + name + ' is not valid JSON'); }
    }
    try { init(root, T); root.classList.add('demo-ready'); } catch (e) { console.error('demo ' + name + ' failed', e); }
  });
})();
