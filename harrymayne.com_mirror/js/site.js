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

    if (reduceMotionQuery.matches) {
      targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }

    var startY = window.pageYOffset;
    var targetY = startY + targetEl.getBoundingClientRect().top;
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
    modalSelector: '[data-ix="button-click"]',
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
    modalSelector: '[data-ix="button-click"]',
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
