(function () {
  // TOC active highlighting via IntersectionObserver
  var sections = document.querySelectorAll('.blog-content section[id]');
  var tocLinks = document.querySelectorAll('.blog-toc a');

  if (sections.length && tocLinks.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tocLinks.forEach(function (link) {
            link.classList.remove('active');
          });
          var activeLink = document.querySelector('.blog-toc a[href="#' + entry.target.id + '"]');
          if (activeLink) {
            activeLink.classList.add('active');
          }
        }
      });
    }, {
      rootMargin: '-110px 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(function (section) {
      observer.observe(section);
    });

    // Also observe the citation section (outside .blog-content)
    var citationSection = document.querySelector('.blog-citation[id]');
    if (citationSection) {
      observer.observe(citationSection);
    }

    // When near the bottom of the page, activate citation TOC link
    var citationLink = document.querySelector('.blog-toc a[href="#citation"]');
    if (citationLink) {
      window.addEventListener('scroll', function () {
        var nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 150;
        if (nearBottom) {
          tocLinks.forEach(function (link) { link.classList.remove('active'); });
          citationLink.classList.add('active');
        }
      }, { passive: true });
    }
  }

  // BibTeX copy button
  var copyBtn = document.querySelector('.blog-bibtex-copy');
  var bibtexBlock = document.querySelector('.blog-bibtex');

  if (copyBtn && bibtexBlock) {
    var copyIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    var checkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    copyBtn.addEventListener('click', function () {
      var text = bibtexBlock.textContent;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.innerHTML = checkIcon;
        copyBtn.style.color = '#7a3535';
        setTimeout(function () {
          copyBtn.innerHTML = copyIcon;
          copyBtn.style.color = '';
        }, 2000);
      });
    });
  }

  // Mobile TOC toggle
  var tocToggle = document.querySelector('.blog-toc-toggle');
  var toc = document.querySelector('.blog-toc');

  if (tocToggle && toc) {
    tocToggle.addEventListener('click', function () {
      toc.classList.toggle('is-open');
      tocToggle.textContent = toc.classList.contains('is-open') ? 'Hide contents' : 'Contents';
    });
  }

  // Figure lightbox: click to expand, click off to close
  var figureImages = document.querySelectorAll('.blog-figure img');
  figureImages.forEach(function (img) {
    img.addEventListener('click', function () {
      var overlay = document.createElement('div');
      overlay.className = 'blog-lightbox';
      var card = document.createElement('div');
      card.className = 'blog-lightbox-card';
      var expanded = document.createElement('img');
      expanded.src = img.src;
      expanded.alt = img.alt;
      card.appendChild(expanded);
      // Add caption if the figure has one
      var figcaption = img.closest('.blog-figure').querySelector('figcaption');
      if (figcaption) {
        var caption = document.createElement('div');
        caption.className = 'blog-lightbox-caption';
        caption.innerHTML = figcaption.innerHTML;
        card.appendChild(caption);
      }
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      // Trigger reflow then fade in
      overlay.offsetHeight;
      overlay.classList.add('is-visible');
      // Close on click anywhere
      overlay.addEventListener('click', function () {
        overlay.classList.remove('is-visible');
        setTimeout(function () { overlay.remove(); }, 200);
      });
    });
  });

  // Close lightbox on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var overlay = document.querySelector('.blog-lightbox');
      if (overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(function () { overlay.remove(); }, 200);
      }
    }
  });
})();
