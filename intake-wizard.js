(function () {
  var MILESTONE_COPY = {
    halfway: {
      title: "You're halfway there!",
      subtitle: 'Great progress — the next few questions shape how your site looks and reads.',
    },
    almost: {
      title: "You're almost there!",
      subtitle: 'Just a few more details and we can start building your site.',
    },
  };

  function getRadio(name) {
    var grp = document.getElementsByName(name);
    for (var i = 0; i < grp.length; i++) {
      if (grp[i].type === 'radio' && grp[i].checked) return grp[i].value;
    }
    return '';
  }

  function condVisible(key) {
    if (key === 'logo-yes') {
      var lg = getRadio('has-logo');
      return lg === 'yes-file' || lg === 'yes-link';
    }
    if (key === 'logo-file') return getRadio('has-logo') === 'yes-file';
    if (key === 'logo-link') return getRadio('has-logo') === 'yes-link';
    if (key === 'estimates-notes') return getRadio('estimates-policy') === 'case-by-case';
    if (key === 'dom-exist') return getRadio('has-dom') === 'yes';
    if (key === 'dom-new') {
      var d = getRadio('has-dom');
      return d === 'no-new' || d === 'no-idea';
    }
    if (key === 'has-existing-site') return getRadio('has-site') === 'yes';
    return true;
  }

  function resolveNodes(ids) {
    var out = [];
    var seen = new Set();

    ids.forEach(function (id) {
      var el = null;
      if (id.indexOf('name:') === 0) {
        el = document.querySelector('input[name="' + id.slice(5) + '"]');
      } else {
        el = document.getElementById(id);
      }
      if (!el) return;

      var node =
        el.closest('.point-block') ||
        el.closest('.field') ||
        el.closest('.cond') ||
        el;
      var frow = el.closest('.frow');
      if (frow) node = frow;

      if (seen.has(node)) return;
      seen.add(node);
      out.push(node);
    });

    return out;
  }

  function sectionStartMap() {
    var map = {};
    state.steps.forEach(function (step, i) {
      if (step.section != null && map[step.section] == null) map[step.section] = i;
    });
    return map;
  }

  var BASE_STEPS = [
    {
      kind: 'start',
      section: 1,
      title: "What's your business called?",
      subtitle: 'Use the name on your truck, Google listing, or license.',
      nodes: ['biz-name'],
      required: ['biz-name'],
      silentPrefill: true,
      hideBack: true,
    },
    { kind: 'q', section: 1, title: 'What name should customers see?', subtitle: 'Short version for your website header.', nodes: ['biz-short'], required: ['biz-short'], actions: ['same-as-legal'] },
    { kind: 'q', section: 1, title: "Who's the owner?", subtitle: 'First name is fine — we use this on your About page.', nodes: ['owner-name', 'biz-phone'], required: ['owner-name', 'biz-phone'] },
    { kind: 'q', section: 1, title: 'Best email for your business', subtitle: 'Where customers and we can reach you.', nodes: ['biz-email'], required: ['biz-email'] },
    { kind: 'q', section: 1, title: 'Where are you based?', subtitle: 'Main city and state — helps local search.', nodes: ['biz-city', 'biz-state'], required: ['biz-city', 'biz-state'] },
    { kind: 'q', section: 1, title: 'Street address', subtitle: 'Optional if you are mobile-only.', nodes: ['biz-address'] },
    { kind: 'q', section: 1, title: 'ZIP code', subtitle: 'Helps us show the right service area.', nodes: ['biz-zip'] },
    { kind: 'q', section: 1, title: 'Year you started', subtitle: 'Optional — adds trust on your site.', nodes: ['biz-year'] },
    { kind: 'q', section: 1, title: 'License or insured line', subtitle: 'Optional — e.g. Licensed & insured · #12345', nodes: ['license-line'] },
    { kind: 'q', section: 1, title: 'Your two main brand colors', subtitle: 'Match your truck, shirts, or logo.', nodes: ['brand-colors-block'], required: ['brand-primary-hex', 'brand-accent-hex'] },
    { kind: 'q', section: 1, title: 'Do you have a logo?', subtitle: 'Upload a file, share a link, or skip — we can style your name as text.', nodes: ['name:has-logo'], requiredRadio: ['has-logo'] },
    { kind: 'q', section: 1, title: 'Logo file tips', subtitle: 'Transparent PNG works best in your header.', nodes: ['logo-format-guide'], cond: 'logo-yes' },
    { kind: 'q', section: 1, title: 'Upload your logo', subtitle: 'PNG or SVG preferred.', nodes: ['logo-file'], cond: 'logo-file' },
    { kind: 'q', section: 1, title: 'Link to your logo file', subtitle: 'Google Drive or Dropbox link is fine.', nodes: ['logo-link-f'], cond: 'logo-link' },
    { kind: 'q', section: 1, title: 'Show your name beside the logo?', subtitle: 'Skip the name if your logo already spells it out.', nodes: ['logo-show-name-wrap'], cond: 'logo-yes' },
    { kind: 'q', section: 2, title: 'Main type of work', subtitle: 'We tailor your site copy and service pages to your trade.', nodes: ['primary-trade'], required: ['primary-trade'] },
    { kind: 'q', section: 2, title: 'Service #1', subtitle: 'Your most important line of work — name it and say what\'s included.', nodes: ['s1n', 's1d'], required: ['s1n'] },
    { kind: 'q', section: 2, title: 'Service #2', subtitle: 'Name it and say what\'s included.', nodes: ['s2n', 's2d'], required: ['s2n'] },
    { kind: 'q', section: 2, title: 'Service #3', subtitle: 'Name it and say what\'s included.', nodes: ['s3n', 's3d'], required: ['s3n'] },
    { kind: 'q', section: 2, title: 'Anything else you offer?', subtitle: 'Other services not covered above.', nodes: ['svc-other'] },
    { kind: 'q', section: 2, title: 'Emergency / after-hours service?', subtitle: 'We\'ll note this on your site if you offer it.', nodes: ['name:emergency'] },
    { kind: 'q', section: 3, title: 'Towns and neighborhoods you serve', subtitle: 'List where you work, separated with commas. Include your main city if you serve outside it too.', nodes: ['scities', 'szips'], required: ['scities'] },
    { kind: 'q', section: 3, title: 'Google Maps listing?', subtitle: 'So your site matches how customers find you on Google.', nodes: ['name:gbp'], requiredRadio: ['gbp'] },
    { kind: 'q', section: 3, title: 'Google rating & review count', subtitle: 'Optional — rough numbers are fine.', nodes: ['rvrat', 'rvcount'] },
    { kind: 'q', section: 4, title: 'Why did you start this business?', subtitle: 'Rough notes are fine — we polish the copy.', nodes: ['bstory'], required: ['bstory'] },
    { kind: 'q', section: 4, title: 'Reason #1 people pick you', subtitle: 'Headline in a few words, then what you do for the customer.', nodes: ['u1t', 'u1d'], required: ['u1t', 'u1d'] },
    { kind: 'q', section: 4, title: 'Reason #2 people pick you', subtitle: 'Another real strength — keep it specific.', nodes: ['u2t', 'u2d'], required: ['u2t', 'u2d'] },
    { kind: 'q', section: 4, title: 'Reason #3 people pick you', subtitle: 'One more reason — rough notes are fine.', nodes: ['u3t', 'u3d'], required: ['u3t', 'u3d'] },
    { kind: 'q', section: 4, title: 'Usual steps when someone hires you', subtitle: 'Three steps — from first contact to finished job.', nodes: ['process-steps-field'], required: ['p1', 'p2', 'p3'] },
    { kind: 'q', section: 4, title: 'Regular business hours', subtitle: 'Shown on your Contact page — separate from 24/7 if you offer that.', nodes: ['biz-hours'], required: ['biz-hours'] },
    { kind: 'q', section: 4, title: 'Quotes, estimates & on-site visits', subtitle: 'What customers should expect before they book.', nodes: ['name:estimates-policy'], requiredRadio: ['estimates-policy'] },
    { kind: 'q', section: 4, title: 'Explain your estimate policy', subtitle: 'Trip fees, free estimates, or when visits are credited.', nodes: ['estimates-notes-wrap'], cond: 'estimates-notes' },
    { kind: 'q', section: 4, title: 'Warranty & guarantee details', subtitle: 'Optional — first line becomes your short warranty line.', nodes: ['warranty-details'] },
    { kind: 'q', section: 4, title: 'How customers request warranty service', subtitle: 'e.g. Call with your invoice number.', nodes: ['warranty-claim'] },
    { kind: 'q', section: 4, title: 'What matters to your team?', subtitle: 'Check any that fit your business.', nodes: ['name:vals'] },
    { kind: 'q', section: 4, title: 'Other values to mention', subtitle: 'Anything else you want on the site.', nodes: ['vals-other'] },
    { kind: 'q', section: 5, title: 'Slogan for the top of your site', subtitle: 'Short line above the fold — or leave blank.', nodes: ['hero-slogan'] },
    { kind: 'q', section: 5, title: 'Describe your business in one sentence', subtitle: 'Optional — who you serve and what you\'re known for.', nodes: ['hero-subheadline'] },
    { kind: 'photo', section: 5, title: 'Big photo for your home page', subtitle: 'Crew on a job, finished project, or wrapped truck at a real home.', nodes: ['hero-file'], skipFile: 'hero-file' },
    { kind: 'photo', section: 5, title: 'Owner / team photos', subtitle: 'Optional — builds trust.', nodes: ['team-files'], skipFile: 'team-files' },
    { kind: 'photo', section: 5, title: 'Truck / vehicle photos', subtitle: 'Optional.', nodes: ['truck-files'], skipFile: 'truck-files' },
    { kind: 'photo', section: 5, title: 'Gallery photos', subtitle: 'Optional — up to 5.', nodes: ['gallery-files'], skipFile: 'gallery-files' },
    { kind: 'q', section: 6, title: 'Review #1', subtitle: 'Paste a real Google or customer review — we only fix grammar.', nodes: ['t1n', 't1c', 't1t'], required: ['t1n', 't1t'] },
    { kind: 'q', section: 6, title: 'Review #2', subtitle: 'A second review from a different customer.', nodes: ['t2n', 't2c', 't2t'], required: ['t2n', 't2t'] },
    { kind: 'q', section: 7, title: 'Do you already have a domain name?', subtitle: 'Your web address — like yourbusiness.com.', nodes: ['name:has-dom'], requiredRadio: ['has-dom'] },
    { kind: 'q', section: 7, title: 'Your existing domain', subtitle: 'Your web address and who hosts it.', nodes: ['dom-exist'], cond: 'dom-exist' },
    { kind: 'q', section: 7, title: 'Domain names you\'d like', subtitle: 'List a few ideas — we\'ll check what\'s available.', nodes: ['dom-new'], cond: 'dom-new' },
    { kind: 'q', section: 7, title: 'Do you have an existing website?', subtitle: 'Any live site today, even a basic one.', nodes: ['name:has-site'], requiredRadio: ['has-site'] },
    { kind: 'q', section: 7, title: 'Current website link', subtitle: 'The URL of your site today.', nodes: ['old-url'], cond: 'has-existing-site' },
    { kind: 'q', section: 7, title: 'What web address would you like?', subtitle: 'The URL you want customers to use when your new site goes live — e.g. www.yourbusiness.com. Leave blank if you\'re not sure yet.', nodes: ['site-url'] },
    { kind: 'q', section: 7, title: 'How fast do you usually get back to people?', subtitle: 'Shows on your Contact page — set realistic expectations.', nodes: ['contact-response-time'], required: ['contact-response-time'] },
    { kind: 'q', section: 7, title: 'Email for your site preview', subtitle: 'Best inbox for your draft site link.', nodes: ['proof-email'], required: ['proof-email'] },
    { kind: 'q', section: 7, title: 'Anything else we should know?', subtitle: 'Deadlines, preferences, or special requests.', nodes: ['notes'] },
    { kind: 'review', section: 8, title: 'Review your answers', subtitle: 'Skim each section — tap Edit on any card to jump back.' },
  ];

  function buildSteps() {
    var steps = BASE_STEPS.slice();
    var halfwayAt = Math.floor(steps.length / 2);
    var almostAt = Math.floor(steps.length * 0.75);
    steps.splice(almostAt, 0, { kind: 'milestone', variant: 'almost' });
    steps.splice(halfwayAt, 0, { kind: 'milestone', variant: 'halfway' });
    return steps;
  }

  var state = {
    steps: [],
    index: 0,
    panels: [],
    active: false,
    prefillDone: false,
    leadId: null,
  };

  function visibleStepIndices() {
    var out = [];
    for (var i = 0; i < state.steps.length; i++) {
      var s = state.steps[i];
      if (s.kind === 'milestone' || s.kind === 'review') {
        out.push(i);
        continue;
      }
      if (!s.cond || condVisible(s.cond)) out.push(i);
    }
    return out;
  }

  function pctComplete() {
    var vis = visibleStepIndices();
    var pos = vis.indexOf(state.index);
    if (pos < 0) pos = 0;
    if (vis.length <= 1) return 0;
    return Math.round((pos / (vis.length - 1)) * 100);
  }

  function updateProgress() {
    var pct = pctComplete();
    var fill = document.getElementById('pgf');
    var pctEl = document.getElementById('pg-pct-n');
    var pctDesk = document.getElementById('pg-pct-desk-n');
    var mobile = document.getElementById('pg-mobile');
    var encourage = document.getElementById('pg-encourage');

    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = String(pct);
    if (pctDesk) pctDesk.textContent = String(pct);
    if (mobile) {
      mobile.innerHTML =
        '<span class="pg-mobile-n">' + pct + '% complete</span>' +
        '<span class="pg-mobile-t">Building your site</span>';
    }
    if (encourage) {
      if (pct >= 75) encourage.textContent = 'Almost there!';
      else if (pct > 50) encourage.textContent = 'More than halfway there!';
      else encourage.textContent = '';
    }
  }

  function firstFocus(panel) {
    var target =
      panel.querySelector('input:not([type=hidden]):not([type=file]), textarea, select, .oi input') ||
      panel.querySelector('button.wq-next');
    if (target) setTimeout(function () { target.focus(); }, 60);
  }

  function validateStep(step) {
    var msg = '';

    (step.required || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || String(el.value || '').trim()) return;
      msg = 'Please fill in the required field before continuing.';
    });

    (step.requiredRadio || []).forEach(function (name) {
      if (getRadio(name)) return;
      msg = 'Please choose an option before continuing.';
    });

    return msg;
  }

  async function silentPrefill() {
    if (state.prefillDone) return;
    state.prefillDone = true;

    var nameEl = document.getElementById('biz-name');
    var businessName = nameEl ? String(nameEl.value || '').trim() : '';
    var params = new URLSearchParams(window.location.search);
    var leadId = params.get('lead') || state.leadId || '';

    if (!businessName && !leadId) return;

    try {
      var res = await fetch('/api/lead-prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName, leadId: leadId }),
      });
      var data = await res.json();
      if (data.found && data.prefill && typeof window.ahanaApplyGbpPrefill === 'function') {
        window.ahanaApplyGbpPrefill(data.prefill);
        if (data.leadId) state.leadId = data.leadId;
        if (typeof window.updateBrandColors === 'function') window.updateBrandColors();
      }
    } catch (e) {
      /* silent — client never sees prefill UI */
    }
  }

  function showIndex(idx) {
    if (idx == null || idx < 0) idx = 0;

    if (state.steps[idx] && state.steps[idx].kind !== 'review' && window.AhanaReviewInline) {
      window.AhanaReviewInline.close(false);
    }
    var vis = visibleStepIndices();
    if (vis.indexOf(idx) < 0) {
      if (idx > state.index) {
        var next = vis.find(function (i) { return i > state.index; });
        if (next != null) idx = next;
      } else {
        var prev = null;
        for (var p = vis.length - 1; p >= 0; p--) {
          if (vis[p] < state.index) { prev = vis[p]; break; }
        }
        if (prev != null) idx = prev;
      }
    }

    state.index = idx;
    state.panels.forEach(function (panel, i) {
      panel.classList.toggle('active', i === idx);
    });

    if (typeof window.ahanaNotifyClear === 'function') {
      var activePanel = state.panels[idx];
      if (activePanel) window.ahanaNotifyClear(activePanel);
    }

    document.querySelectorAll('.sc').forEach(function (sc) { sc.classList.remove('active'); });

    var step = state.steps[idx];
    if (step && step.kind === 'review' && typeof window.renderReview === 'function') {
      window.renderReview();
    }

    updateProgress();
    firstFocus(state.panels[idx]);

    if (typeof window.ahanaRefreshMobileNavLabels === 'function') {
      window.ahanaRefreshMobileNavLabels();
    }
  }

  function goNext() {
    var step = state.steps[state.index];
    if (!step) return;

    if (step.kind === 'start') {
      var err = validateStep(step);
      if (err) {
        if (typeof window.ahanaNotify === 'function') window.ahanaNotify(err);
        return;
      }
      silentPrefill().then(function () {
        var vis = visibleStepIndices();
        var pos = vis.indexOf(state.index);
        showIndex(vis[pos + 1] != null ? vis[pos + 1] : state.index + 1);
      });
      return;
    }

    if (step.kind === 'milestone' || step.kind === 'review' || step.kind === 'photo') {
      /* no field validation */
    } else if (step.kind === 'q') {
      var msg = validateStep(step);
      if (msg) {
        if (typeof window.ahanaNotify === 'function') window.ahanaNotify(msg);
        return;
      }
    }

    var vis = visibleStepIndices();
    var pos = vis.indexOf(state.index);
    if (pos < 0 || pos >= vis.length - 1) return;
    showIndex(vis[pos + 1]);
  }

  function goBack() {
    var vis = visibleStepIndices();
    var pos = vis.indexOf(state.index);
    if (pos <= 0) return;
    showIndex(vis[pos - 1]);
  }

  function skipPhoto(fileId) {
    var inp = document.getElementById(fileId);
    if (inp) {
      inp.value = '';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    goNext();
  }

  function goToSection(sectionNum) {
    var target = sectionStartMap()[sectionNum];
    if (target == null) return;
    while (target > 0 && state.steps[target] && state.steps[target].cond && !condVisible(state.steps[target].cond)) {
      target++;
    }
    showIndex(target);
  }

  function stashHidden() {
    var pool = document.getElementById('wiz-pool');
    if (!pool) return;
    ['pkg', 'gbp-link'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        var wrap = el.closest('.field') || el.closest('.gbp-import-panel') || el.parentElement;
        if (wrap && wrap !== pool) pool.appendChild(wrap);
      }
    });
    document.querySelectorAll('.gbp-import-panel').forEach(function (el) {
      pool.appendChild(el);
    });
  }

  function reviewStepIndex() {
    for (var i = 0; i < state.steps.length; i++) {
      if (state.steps[i].kind === 'review') return i;
    }
    return state.steps.length - 1;
  }

  function restoreFieldNodes(nodes) {
    (nodes || []).forEach(function (node) {
      var panelIdx = Number(node.dataset.wqPanel);
      if (isNaN(panelIdx) || !state.panels[panelIdx]) return;
      var body = state.panels[panelIdx].querySelector('.wq-body');
      if (body) body.appendChild(node);
    });
  }

  function buildPanels() {
    var stage = document.getElementById('wiz-stage');
    if (!stage) return;

    state.steps.forEach(function (step, i) {
      var panel = document.createElement('div');
      panel.className = 'wq';
      panel.dataset.wq = String(i);

      var head = document.createElement('div');
      head.className = 'wq-head';

      if (step.kind === 'milestone') {
        var mc = MILESTONE_COPY[step.variant] || MILESTONE_COPY.halfway;
        head.innerHTML =
          '<p class="wq-milestone-badge">' + (step.variant === 'almost' ? 'Almost done' : 'Halfway') + '</p>' +
          '<h2 class="wq-title">' + mc.title + '</h2>' +
          '<p class="wq-sub">' + mc.subtitle + '</p>';
      } else {
        head.innerHTML =
          '<h2 class="wq-title">' + (step.title || '') + '</h2>' +
          (step.subtitle ? '<p class="wq-sub">' + step.subtitle + '</p>' : '');
      }
      panel.appendChild(head);

      var body = document.createElement('div');
      body.className = 'wq-body';

      if (step.kind === 'review') {
        var s8 = document.getElementById('s8');
        if (s8) {
          var mount = s8.querySelector('#review-mount');
          var nav = s8.querySelector('.form-nav');
          if (mount) body.appendChild(mount);
          if (nav) {
            nav.remove();
          }
        }
      } else if (step.nodes) {
        var nodes = resolveNodes(step.nodes);
        var hideLabels = nodes.length === 1;
        nodes.forEach(function (node) {
          if (hideLabels) {
            var labels = node.querySelector(':scope > .field')
              ? node.querySelectorAll(':scope > .flabel')
              : node.querySelectorAll('.flabel');
            labels.forEach(function (lbl) { lbl.classList.add('wq-hide-label'); });
          }
          if (step.section != null) node.dataset.wqSection = String(step.section);
          node.dataset.wqPanel = String(i);
          node.dataset.wqStep = String(i);
          body.appendChild(node);
        });
      }

      if (step.actions) {
        step.actions.forEach(function (action) {
          if (action === 'same-as-legal') {
            var useLegal = document.createElement('button');
            useLegal.type = 'button';
            useLegal.className = 'wq-action wq-same-legal';
            useLegal.textContent = 'Same as legal name';
            useLegal.addEventListener('click', function () {
              var legal = document.getElementById('biz-name');
              var short = document.getElementById('biz-short');
              if (!legal || !short) return;
              short.value = String(legal.value || '').trim();
              short.dispatchEvent(new Event('input', { bubbles: true }));
              short.dispatchEvent(new Event('change', { bubbles: true }));
              short.focus();
            });
            body.appendChild(useLegal);
          }
        });
      }

      panel.appendChild(body);

      var foot = document.createElement('div');
      foot.className = 'wq-foot';

      if (step.kind !== 'review' && !step.hideBack) {
        var back = document.createElement('button');
        back.type = 'button';
        back.className = 'btn-back wq-back';
        back.textContent = '← Back';
        back.addEventListener('click', goBack);
        foot.appendChild(back);
      }

      if (step.kind === 'photo' && step.skipFile) {
        var skip = document.createElement('button');
        skip.type = 'button';
        skip.className = 'wq-skip';
        skip.textContent = 'Skip for now';
        skip.addEventListener('click', function () { skipPhoto(step.skipFile); });
        foot.appendChild(skip);
      }

      if (step.kind === 'review') {
        var backEdit = document.createElement('button');
        backEdit.type = 'button';
        backEdit.className = 'btn-back wq-back';
        backEdit.textContent = '← Back to edit';
        backEdit.addEventListener('click', goBack);
        foot.appendChild(backEdit);

        var submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'btn-submit wq-next';
        submit.textContent = 'Complete onboarding';
        submit.addEventListener('click', function () {
          if (typeof window.submitFormFinal === 'function') window.submitFormFinal();
        });
        foot.appendChild(submit);
      } else {
        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn-next wq-next';
        next.textContent = step.kind === 'milestone' ? 'Keep going →' : 'Continue →';
        next.addEventListener('click', goNext);
        foot.appendChild(next);
      }

      panel.appendChild(foot);
      stage.appendChild(panel);
      state.panels.push(panel);
    });
  }

  function patchGoTo() {
    var legacy = window.goTo;
    window.goTo = function (n) {
      if (state.active) {
        goToSection(n);
        return;
      }
      if (typeof legacy === 'function') legacy(n);
    };
  }

  function bindEnter() {
    var fw = document.getElementById('fw');
    if (!fw || fw.dataset.wizardEnter) return;
    fw.dataset.wizardEnter = '1';
    fw.addEventListener('keydown', function (e) {
      if (!state.active || e.key !== 'Enter') return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'button') return;
      var active = document.querySelector('.wq.active');
      if (!active) return;
      var next = active.querySelector('.wq-next');
      if (next) {
        e.preventDefault();
        next.click();
      }
    });
  }

  function bindConditionalClears() {
    document.querySelectorAll('input[name="has-site"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (getRadio('has-site') !== 'yes') {
          var old = document.getElementById('old-url');
          if (old) {
            old.value = '';
            old.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    });
  }

  function init() {
    var fw = document.getElementById('fw');
    if (!fw || fw.dataset.wizardReady) return;
    fw.dataset.wizardReady = '1';

    state.steps = buildSteps();
    document.body.classList.add('wizard-mode');

    var pool = document.createElement('div');
    pool.id = 'wiz-pool';
    pool.className = 'wiz-pool';
    pool.setAttribute('aria-hidden', 'true');
    fw.appendChild(pool);

    var stage = document.createElement('div');
    stage.id = 'wiz-stage';
    stage.className = 'wiz-stage';
    fw.insertBefore(stage, fw.firstChild);

    stashHidden();
    buildPanels();

    document.querySelectorAll('.sc').forEach(function (sc) {
      sc.classList.remove('active');
      sc.style.display = 'none';
    });
    document.querySelectorAll('.sc .form-nav').forEach(function (nav) {
      nav.style.display = 'none';
    });

    state.active = true;
    patchGoTo();
    bindEnter();
    bindConditionalClears();

    var params = new URLSearchParams(window.location.search);
    if (params.get('lead')) state.leadId = params.get('lead');

    var startAt = 0;
    if (params.get('resume') === '1' || location.search.indexOf('resume=1') >= 0) {
      var name = document.getElementById('biz-name');
      if (name && String(name.value || '').trim()) {
        state.prefillDone = true;
        startAt = 1;
      }
    }

    showIndex(startAt);
  }

  window.AhanaWizard = {
    init: init,
    goToSection: goToSection,
    goToReview: function () { showIndex(reviewStepIndex()); },
    restoreFieldNodes: restoreFieldNodes,
    getLeadId: function () { return state.leadId || ''; },
    get active() { return state.active; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
