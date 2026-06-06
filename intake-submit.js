(function () {
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
