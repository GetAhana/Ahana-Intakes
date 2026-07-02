(function () {
  var saveTimer = null;

  var AUTOCOMPLETE = {
    'biz-name': 'organization',
    'biz-short': 'organization',
    'owner-name': 'name',
    'biz-phone': 'tel',
    'biz-email': 'email',
    'biz-address': 'street-address',
    'biz-city': 'address-level2',
    'biz-state': 'address-level1',
    'biz-zip': 'postal-code',
  };

  function isMobile() {
    return window.matchMedia('(max-width:639px)').matches;
  }

  function captureSnapshot() {
    var snap = { fields: {}, radios: {}, checkboxes: {} };
    var fw = document.getElementById('fw');
    if (!fw) return snap;

    var all = fw.querySelectorAll('input, textarea, select');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var t = el.type;
      if (t === 'radio' || t === 'checkbox' || t === 'file') continue;
      if (el.id) snap.fields[el.id] = el.value;
    }

    var rads = fw.querySelectorAll('input[type=radio]:checked');
    for (var j = 0; j < rads.length; j++) snap.radios[rads[j].name] = rads[j].value;

    var cbs = fw.querySelectorAll('input[type=checkbox]');
    for (var k = 0; k < cbs.length; k++) {
      var c = cbs[k];
      if (!c.name) continue;
      if (!snap.checkboxes[c.name]) snap.checkboxes[c.name] = [];
    }
    for (var k = 0; k < cbs.length; k++) {
      var cb = cbs[k];
      if (!cb.name) continue;
      if (cb.checked) snap.checkboxes[cb.name].push(cb.value || 'on');
    }

    return snap;
  }

  function snapshotHasData(snap) {
    if (!snap || !snap.fields) return false;
    for (var id in snap.fields) {
      if (Object.prototype.hasOwnProperty.call(snap.fields, id) && String(snap.fields[id] || '').trim()) {
        return true;
      }
    }
    return false;
  }

  function storageKey() {
    return document.body.getAttribute('data-intake-storage-key') || '';
  }

  function debouncedAutosave() {
    var key = storageKey();
    if (!key) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        var existing = null;
        try {
          existing = JSON.parse(localStorage.getItem(key) || 'null');
        } catch (e) {}
        var pack = existing && typeof existing === 'object' ? existing : { v: 1 };
        pack.snapshot = captureSnapshot();
        pack.autosavedAt = Date.now();
        localStorage.setItem(key, JSON.stringify(pack));
      } catch (e) {}
    }, 900);
  }

  function applyFieldAttrs() {
    for (var id in AUTOCOMPLETE) {
      if (!Object.prototype.hasOwnProperty.call(AUTOCOMPLETE, id)) continue;
      var el = document.getElementById(id);
      if (el) el.setAttribute('autocomplete', AUTOCOMPLETE[id]);
    }

    var phone = document.getElementById('biz-phone');
    if (phone) phone.setAttribute('inputmode', 'tel');

    var emails = document.querySelectorAll('#biz-email');
    for (var i = 0; i < emails.length; i++) emails[i].setAttribute('inputmode', 'email');

    var zip = document.getElementById('biz-zip');
    if (zip) {
      zip.setAttribute('inputmode', 'numeric');
      zip.setAttribute('pattern', '[0-9\\-]*');
    }

    var state = document.getElementById('biz-state');
    if (state) {
      state.setAttribute('autocapitalize', 'characters');
      state.setAttribute('autocomplete', 'address-level1');
    }

    document.querySelectorAll('#fw input[type=file][accept*="image"]').forEach(function (inp) {
      if (!inp.getAttribute('accept')) inp.setAttribute('accept', 'image/*');
    });
  }

  function collapseSectionIntros() {
    if (!isMobile()) return;
    document.querySelectorAll('.sec-sub:not(.sec-sub--ready)').forEach(function (sub) {
      sub.classList.add('sec-sub--ready');
      var html = sub.innerHTML;
      sub.innerHTML = '';
      sub.classList.add('sec-sub--collapsible');

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sec-sub-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML =
        '<span class="sec-sub-toggle-label">Why this step matters</span>' +
        '<svg class="sec-sub-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

      var body = document.createElement('div');
      body.className = 'sec-sub-body';
      body.hidden = true;
      body.innerHTML = html;

      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      });

      sub.appendChild(toggle);
      sub.appendChild(body);
    });
  }

  function shortenNavLabels() {
    document.querySelectorAll('.form-nav .btn-next').forEach(function (btn) {
      if (!btn.dataset.fullLabel) btn.dataset.fullLabel = btn.textContent.trim();
      btn.textContent = isMobile() && !btn.classList.contains('btn-submit') ? 'Continue →' : btn.dataset.fullLabel;
    });

    document.querySelectorAll('.form-nav .btn-back').forEach(function (btn) {
      if (!btn.dataset.fullLabel) btn.dataset.fullLabel = btn.textContent.trim();
      if (isMobile()) {
        btn.textContent = btn.dataset.fullLabel.toLowerCase().indexOf('edit') >= 0 ? '← Back to edit' : '← Back';
      } else {
        btn.textContent = btn.dataset.fullLabel;
      }
    });
  }

  function bindEnterToContinue() {
    var fw = document.getElementById('fw');
    if (!fw || fw.dataset.enterBound) return;
    fw.dataset.enterBound = '1';

    fw.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'button') return;
      if (e.target.type === 'submit') return;
      var active = document.querySelector('.sc.active');
      if (!active) return;
      var next = active.querySelector('.form-nav .btn-next');
      if (next) {
        e.preventDefault();
        next.click();
      }
    });
  }

  function bindAutosave() {
    var fw = document.getElementById('fw');
    if (!fw || fw.dataset.autosaveBound) return;
    fw.dataset.autosaveBound = '1';
    fw.addEventListener('input', debouncedAutosave);
    fw.addEventListener('change', debouncedAutosave);
  }

  function maybeShowResumeBanner() {
    var key = storageKey();
    if (!key || document.getElementById('intake-resume-banner')) return;

    var snap = null;
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var pack = JSON.parse(raw);
        snap = pack && pack.snapshot ? pack.snapshot : null;
      }
    } catch (e) {}

    if (!snapshotHasData(snap)) return;

    var banner = document.createElement('div');
    banner.className = 'intake-resume-banner';
    banner.id = 'intake-resume-banner';
    banner.innerHTML =
      '<p><strong>Saved on this device.</strong> Continue where you left off, or start fresh below.</p>' +
      '<div class="intake-resume-actions">' +
      '<button type="button" class="btn-next resume-continue">Continue saved answers</button>' +
      '<button type="button" class="resume-fresh">Start fresh</button>' +
      '</div>';

    banner.querySelector('.resume-continue').addEventListener('click', function () {
      if (typeof window.ahanaResumeIntake === 'function') window.ahanaResumeIntake();
      else if (typeof beginIntake === 'function') beginIntake();
    });

    banner.querySelector('.resume-fresh').addEventListener('click', function () {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
      banner.remove();
    });

    var actions =
      document.querySelector('.welcome-actions') ||
      document.querySelector('.intro-actions');
    if (actions) actions.parentNode.insertBefore(banner, actions);
  }

  function init() {
    applyFieldAttrs();
    collapseSectionIntros();
    shortenNavLabels();
    bindEnterToContinue();
    bindAutosave();
    maybeShowResumeBanner();
  }

  window.ahanaRefreshMobileNavLabels = shortenNavLabels;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', function () {
    shortenNavLabels();
  });
})();
