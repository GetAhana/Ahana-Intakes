(function () {
  window.ahanaGetLeadId = function () {
    if (window.AhanaWizard && typeof window.AhanaWizard.getLeadId === 'function') {
      var fromWizard = window.AhanaWizard.getLeadId();
      if (fromWizard) return fromWizard;
    }
    try {
      return new URLSearchParams(window.location.search).get('lead') || '';
    } catch (e) {
      return '';
    }
  };

  window.ahanaUpdateProgressUI = function (n, total) {
    var mobile = document.getElementById('pg-mobile');
    if (mobile) {
      var active = document.getElementById('pl-' + n);
      var label = active ? active.textContent.replace(/\s+/g, ' ').trim() : '';
      mobile.innerHTML =
        '<span class="pg-mobile-n">Step ' + n + ' of ' + total + '</span>' +
        '<span class="pg-mobile-t">' + label + '</span>';
    }

    var activeBtn = document.getElementById('pl-' + n);
    if (activeBtn && activeBtn.scrollIntoView && window.matchMedia('(min-width:640px)').matches) {
      try {
        activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      } catch (e) {}
    }
  };

  function showIntakeSuccess(totalSteps) {
    var fw = document.getElementById('fw');
    var pgWrap = document.querySelector('.pg-wrap');
    var done = document.getElementById('done');
    var pgf = document.getElementById('pgf');

    if (fw) fw.style.display = 'none';
    if (pgWrap) pgWrap.style.display = 'none';
    if (done) done.style.display = 'block';
    if (pgf) pgf.style.width = '100%';

    for (var i = 1; i <= totalSteps; i++) {
      var step = document.getElementById('pl-' + i);
      if (step) {
        step.classList.remove('active');
        step.classList.add('done');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.ahanaSubmitIntake = function (formType, data, totalSteps) {
    var payload = {};
    var key;

    for (key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        payload[key] = data[key];
      }
    }

    payload.formType = formType;

    return fetch('/api/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('submit failed');
      }
      showIntakeSuccess(totalSteps);
    });
  };
})();
