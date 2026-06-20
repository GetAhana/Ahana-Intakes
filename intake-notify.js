(function () {
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconFor(type) {
    if (type === 'success') {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }
    if (type === 'info') {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>';
    }
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>';
  }

  function clearIn(root) {
    if (!root) return;
    root.querySelectorAll('.intake-notify').forEach(function (el) {
      el.remove();
    });
  }

  function makeNotify(message, type) {
    var el = document.createElement('div');
    el.className = 'intake-notify intake-notify--' + (type || 'error');
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<span class="intake-notify-icon" aria-hidden="true">' + iconFor(type) + '</span>' +
      '<p class="intake-notify-msg">' + escapeHtml(message) + '</p>' +
      '<button type="button" class="intake-notify-close" aria-label="Dismiss">&times;</button>';

    el.querySelector('.intake-notify-close').addEventListener('click', function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 220);
    });

    return el;
  }

  function ensureToastHost() {
    var host = document.getElementById('intake-notify-host');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'intake-notify-host';
    host.className = 'intake-notify-host';

    var anchor = document.querySelector('.pg-wrap') || document.getElementById('intake-form') || document.body;
    if (anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
    } else {
      document.body.appendChild(host);
    }
    return host;
  }

  window.ahanaNotify = function (message, opts) {
    opts = opts || {};
    var type = opts.type || 'error';
    var placement = opts.placement || 'inline';

    if (placement === 'inline') {
      var panel = opts.target || document.querySelector('.wq.active');
      if (panel) {
        clearIn(panel);
        var note = makeNotify(message, type);
        note.classList.add('intake-notify--inline');
        var foot = panel.querySelector('.wq-foot');
        if (foot) panel.insertBefore(note, foot);
        else panel.appendChild(note);

        var focusTarget = panel.querySelector(
          'input:not([type=hidden]):not([type=file]), textarea, select, .oi input'
        );
        if (focusTarget) focusTarget.focus({ preventScroll: true });

        return note;
      }
    }

    var host = ensureToastHost();
    clearIn(host);
    var toast = makeNotify(message, type);
    toast.classList.add('intake-notify--toast');
    host.appendChild(toast);

    if (opts.autoHide !== false) {
      setTimeout(function () {
        if (!toast.parentNode) return;
        toast.classList.add('is-out');
        setTimeout(function () { toast.remove(); }, 280);
      }, opts.duration || 6000);
    }

    return toast;
  };

  window.ahanaNotifyClear = function (root) {
    if (root) {
      clearIn(root);
      return;
    }
    document.querySelectorAll('.intake-notify').forEach(function (el) {
      el.remove();
    });
  };
})();
