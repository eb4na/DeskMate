/* Memobun marketing site — tiny vanilla JS, no dependencies. */
(function () {
  'use strict';

  // ── Mobile nav toggle ──────────────────────────────────────────────
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close the menu after tapping a link.
    nav.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Scroll-reveal ──────────────────────────────────────────────────
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // ── Graceful screenshot drop-in ────────────────────────────────────
  // Each gallery <img data-shot="home"> tries assets/screenshots/home.{png,jpg,jpeg,webp}.
  // If a file exists it fades in over the cozy placeholder; if not, the placeholder
  // simply stays — so the page looks finished before real screenshots are added.
  var exts = ['png', 'jpg', 'jpeg', 'webp'];
  document.querySelectorAll('img[data-shot]').forEach(function (img) {
    var name = img.getAttribute('data-shot');
    var i = 0;
    function tryNext() {
      if (i >= exts.length) return; // no file found — leave the placeholder showing
      var url = 'assets/screenshots/' + name + '.' + exts[i++];
      var probe = new Image();
      probe.onload = function () { img.src = url; };
      probe.onerror = tryNext;
      probe.src = url;
    }
    tryNext();
  });

  // ── Footer year ────────────────────────────────────────────────────
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
