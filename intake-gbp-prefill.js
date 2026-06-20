(function () {
  function setField(id, value) {
    if (value == null || value === '') return false;
    var el = document.getElementById(id);
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      var opts = [].slice.call(el.options);
      var match = opts.find(function (o) {
        return o.value === value || o.textContent.trim() === value;
      });
      if (!match) return false;
      el.value = match.value;
    } else {
      el.value = String(value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function pickRadio(name, value) {
    if (!name || !value) return false;
    var grp = document.getElementsByName(name);
    for (var i = 0; i < grp.length; i++) {
      if (grp[i].type === 'radio' && grp[i].value === value) {
        grp[i].checked = true;
        grp[i].dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function applyPrefill(prefill) {
    if (!prefill) return [];
    var applied = [];
    var fields = prefill.fields || {};
    var key;

    for (key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key) && setField(key, fields[key])) {
        applied.push(key);
      }
    }

    var radios = prefill.radios || {};
    for (key in radios) {
      if (Object.prototype.hasOwnProperty.call(radios, key) && pickRadio(key, radios[key])) {
        applied.push(key);
      }
    }

    var select = prefill.select || {};
    for (key in select) {
      if (Object.prototype.hasOwnProperty.call(select, key) && setField(key, select[key])) {
        applied.push(key);
        if (key === 'primary-trade' && typeof window.toggleOther === 'function') {
          window.toggleOther(select[key]);
        }
      }
    }

    if (typeof window.updateServicePlaceholders === 'function') window.updateServicePlaceholders();
    if (typeof window.refreshEstimatesNotesVisibility === 'function') window.refreshEstimatesNotesVisibility();

    return applied;
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('gbp-import-error', !!isError);
    el.classList.toggle('gbp-import-ok', !!text && !isError);
  }

  function bindImport() {
    var input = document.getElementById('gbp-link');
    var btn = document.getElementById('gbp-import-btn');
    var status = document.getElementById('gbp-import-status');
    if (!input || !btn) return;

    async function runImport() {
      var url = (input.value || '').trim();
      if (!url) {
        setStatus(status, 'Paste your Google Maps listing link first.', true);
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.classList.add('is-loading');
      setStatus(status, 'Looking up your Google listing…', false);

      try {
        var res = await fetch('/api/gbp-prefill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');

        if (!data.found) {
          setStatus(status, data.message || 'Could not find that listing.', true);
          return;
        }

        applyPrefill(data.prefill);
        setStatus(status, data.message || 'Imported from Google. Review the filled fields below.', false);
      } catch (err) {
        setStatus(status, err.message || 'Import failed. You can still fill the form manually.', true);
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }

    btn.addEventListener('click', runImport);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runImport();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindImport);
  } else {
    bindImport();
  }

  window.ahanaApplyGbpPrefill = applyPrefill;
})();
