(function () {
  var root = document.documentElement;
  if (!root.classList.contains('has-custom-js')) {
    root.classList.add('has-custom-js');
  }

  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function smoothScrollTo(targetEl, duration) {
    if (!targetEl) {
      return;
    }

    var nav = document.querySelector('.main-nav');
    var navOffset = nav ? nav.offsetHeight : 0;
    var startY = window.pageYOffset;
    var targetY = startY + targetEl.getBoundingClientRect().top - navOffset;

    if (reduceMotionQuery.matches) {
      window.scrollTo(0, targetY);
      return;
    }

    var distance = targetY - startY;
    var startTime = null;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function step(timestamp) {
      if (!startTime) {
        startTime = timestamp;
      }
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeOutCubic(progress);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    var targetId = link.getAttribute('href').slice(1);
    if (!targetId) {
      return;
    }

    link.addEventListener('click', function (event) {
      var targetEl = document.getElementById(targetId);
      if (targetEl) {
        event.preventDefault();
        smoothScrollTo(targetEl, 850);
      }
    });
  });
})();

(function () {
  var body = document.body;
  if (!body) {
    return;
  }

  var activeModal = null;

  function hideModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    if (activeModal === modal) {
      activeModal = null;
      body.classList.remove('modal-open');
    }
  }

  function showModal(modal, config) {
    if (activeModal && activeModal !== modal) {
      hideModal(activeModal);
    }

    modal.style.display = config.display || 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    body.classList.add('modal-open');
    activeModal = modal;

    var focusTarget = null;
    if (config.focusSelector) {
      focusTarget = modal.querySelector(config.focusSelector);
    }
    if (!focusTarget && config.closeSelector) {
      focusTarget = modal.querySelector(config.closeSelector);
    }
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function enhanceActivator(element, handler) {
    element.classList.add('modal-card');
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'button');
    }
    element.addEventListener('click', handler);
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    });
  }

  function enhanceCloser(element, modal) {
    element.classList.add('modal-card-close');
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'button');
    }
    element.addEventListener('click', function () {
      hideModal(modal);
    });
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hideModal(modal);
      }
    });
  }

  function bindModalGroup(config) {
    if (!config || !config.cardSelector || !config.modalSelector) {
      return false;
    }

    var cardNodes = Array.prototype.slice.call(document.querySelectorAll(config.cardSelector));
    if (!cardNodes.length) {
      return false;
    }

    var modalCandidates = Array.prototype.slice.call(document.querySelectorAll(config.modalSelector));
    if (typeof config.modalFilter === 'function') {
      modalCandidates = modalCandidates.filter(config.modalFilter);
    }
    if (!modalCandidates.length) {
      return false;
    }

    var pairCount = Math.min(cardNodes.length, modalCandidates.length);
    if (!pairCount) {
      return false;
    }

    var overlaysSelector = config.overlaySelector || '';
    var closeSelector = config.closeSelector || '';

    for (var i = 0; i < pairCount; i += 1) {
      var modal = modalCandidates[i];
      hideModal(modal);

      if (overlaysSelector) {
        Array.prototype.slice.call(modal.querySelectorAll(overlaysSelector)).forEach(function (overlay) {
          overlay.addEventListener('click', function () {
            hideModal(modal);
          });
        });
      }

      if (closeSelector) {
        Array.prototype.slice.call(modal.querySelectorAll(closeSelector)).forEach(function (closer) {
          enhanceCloser(closer, modal);
        });
      }

      (function (modalRef, configRef) {
        enhanceActivator(cardNodes[i], function () {
          showModal(modalRef, configRef);
        });
      })(modal, config);
    }

    return true;
  }

  var hasAnyModal = false;

  if (bindModalGroup({
    cardSelector: '.grid-5-oxford > div',
    modalSelector: '.container-2-oxford > [class^="day"]',
    modalFilter: function (modal) {
      return modal.querySelector('.popup-oxford');
    },
    overlaySelector: '.modal-wrapper-oxford, .modal-wrapper',
    closeSelector: '.close-oxford',
    focusSelector: '.close-oxford',
    display: 'flex'
  })) {
    hasAnyModal = true;
  }

  if (bindModalGroup({
    cardSelector: '.grid-5 > div',
    modalSelector: '.container-2 > [class^="day"]',
    modalFilter: function (modal) {
      return modal.querySelector('.popup') && !modal.querySelector('.popup-oxford');
    },
    overlaySelector: '.modal-wrapper',
    closeSelector: '.close',
    focusSelector: '.close',
    display: 'flex'
  })) {
    hasAnyModal = true;
  }

  if (hasAnyModal) {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && activeModal) {
        hideModal(activeModal);
      }
    });
  }
})();

/* Value Leakage thumbnail: hover plays a slow, deliberate timeline. The prompt
   opens up and the investment line fades into the space, a beat to read it,
   then the answer glides down 55% -> 45% with a falling-price arrow. All the
   motion itself lives in CSS transitions; this only steps through the phases. */
(function () {
  var row = document.querySelector('.publication-row--vl');
  if (!row) {
    return;
  }

  var inject = row.querySelector('.vl-inject');
  var roll = row.querySelector('.vl-roll');
  var arrow = row.querySelector('.vl-arrow');
  if (!inject || !roll) {
    return;
  }

  var timers = [];

  function later(fn, delay) {
    timers.push(window.setTimeout(fn, delay));
  }

  function play() {
    timers.forEach(window.clearTimeout);
    timers = [];
    later(function () {
      inject.classList.add('vl-on'); // space opens, line fades in (~1.3s)
    }, 300);
    later(function () {
      roll.classList.add('vl-fall'); // answer glides down (~2.8s)
      if (arrow) {
        arrow.classList.add('vl-on');
      }
    }, 2300);
  }

  function reset() {
    timers.forEach(window.clearTimeout);
    timers = [];
    inject.classList.remove('vl-on');
    roll.classList.remove('vl-fall');
    if (arrow) {
      arrow.classList.remove('vl-on');
    }
  }

  row.addEventListener('mouseenter', play);
  row.addEventListener('mouseleave', reset);
})();

/* Animated publication thumbnails: each row declares data-anim and data-beats
   (comma-separated ms offsets). Hovering the row steps through the phases by
   toggling .on on elements tagged .anim with a matching data-step; all motion
   lives in CSS transitions (see the thumbnail section of site.css). */
(function () {
  /* Even tracking for the LingOly-TOO letters: each cell is its own glyph's
     width plus a constant gap, measured in the rendered font, so the space
     between letters is identical across the words. Re-run once webfonts load. */
  function sizeLtCells() {
    var cells = document.querySelectorAll('.lt-cell');
    if (!cells.length) {
      return;
    }
    var style = window.getComputedStyle(cells[0]);
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    Array.prototype.forEach.call(cells, function (cell) {
      var orig = cell.querySelector('.g-orig');
      cell.style.width = (ctx.measureText(orig.textContent).width + 2.2) + 'px';
    });
  }
  sizeLtCells();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(sizeLtCells);
  }

  var rows = document.querySelectorAll('.publication-row[data-anim]');
  Array.prototype.forEach.call(rows, function (row) {
    var beats = (row.getAttribute('data-beats') || '300').split(',').map(Number);
    var timers = [];

    function later(fn, delay) {
      timers.push(window.setTimeout(fn, delay));
    }

    function setStep(step, on) {
      var els = row.querySelectorAll('.anim[data-step="' + step + '"]');
      Array.prototype.forEach.call(els, function (el) {
        el.classList.toggle('on', on);
      });
    }

    row.addEventListener('mouseenter', function () {
      timers.forEach(window.clearTimeout);
      timers = [];
      beats.forEach(function (t, i) {
        later(function () { setStep(i + 1, true); }, t);
      });
    });

    row.addEventListener('mouseleave', function () {
      timers.forEach(window.clearTimeout);
      timers = [];
      var els = row.querySelectorAll('.anim');
      Array.prototype.forEach.call(els, function (el) {
        el.classList.remove('on');
      });
    });
  });
})();
