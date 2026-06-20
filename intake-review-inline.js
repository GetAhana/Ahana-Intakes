(function () {
  var active = null;

  function fieldShown(node) {
    var p = node;
    while (p) {
      if (p.classList && p.classList.contains('cond') && !p.classList.contains('on')) return false;
      p = p.parentElement;
    }
    return true;
  }

  function getSectionFields(section) {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('[data-wq-section="' + section + '"]')
    );
    nodes.sort(function (a, b) {
      return Number(a.dataset.wqStep || 0) - Number(b.dataset.wqStep || 0);
    });
    return nodes.filter(fieldShown);
  }

  function restoreNodes(nodes) {
    if (!window.AhanaWizard || !window.AhanaWizard.restoreFieldNodes) return;
    window.AhanaWizard.restoreFieldNodes(nodes);
  }

  function closeInlineEdit(rerender) {
    if (!active) return;
    restoreNodes(active.nodes);
    active.card.classList.remove('rv-card--editing');
    var body = active.card.querySelector('.rv-body');
    if (body) body.hidden = false;
    var panel = active.card.querySelector('.rv-edit-panel');
    if (panel) panel.remove();
    if (active.btn) {
      active.btn.textContent = 'Edit';
      active.btn.setAttribute('aria-expanded', 'false');
    }
    active = null;
    if (rerender && typeof window.renderReview === 'function') window.renderReview();
  }

  function openInlineEdit(section, card, btn) {
    if (active && active.card === card) {
      closeInlineEdit(true);
      return;
    }
    closeInlineEdit(false);

    var nodes = getSectionFields(section);
    if (!nodes.length) {
      if (window.AhanaWizard && window.AhanaWizard.goToSection) window.AhanaWizard.goToSection(section);
      return;
    }

    var body = card.querySelector('.rv-body');
    if (!body) return;

    var panel = document.createElement('div');
    panel.className = 'rv-edit-panel';

    nodes.forEach(function (node) {
      node.querySelectorAll('.flabel.wq-hide-label').forEach(function (lbl) {
        lbl.classList.remove('wq-hide-label');
      });
      panel.appendChild(node);
    });

    body.hidden = true;
    card.appendChild(panel);
    card.classList.add('rv-card--editing');
    if (btn) {
      btn.textContent = 'Done';
      btn.setAttribute('aria-expanded', 'true');
    }

    active = { section: section, card: card, btn: btn, nodes: nodes };

    var first = panel.querySelector('input, textarea, select, .oi input');
    if (first) setTimeout(function () { first.focus(); }, 40);
  }

  window.AhanaReviewInline = {
    open: openInlineEdit,
    close: closeInlineEdit,
  };
})();
