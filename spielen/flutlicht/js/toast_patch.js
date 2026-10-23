/* ===== toast_patch.js =====
   Kleines Toast-System für nicht-blockierendes Feedback.
   - window.showToast(msg, type, opts) — type: success|error|warn|info|money
   - überschreibt window.alert → Toasts statt hässlicher, blockierender Browser-Alerts
     (alle Aufrufe im Spiel sind „alert(); return", kein Blockier-Verhalten nötig).
   Nutzt die bereits geladenen Tabler-Icons (ti ti-*). Lädt spät.
   ============================================================================= */
(function () {
  'use strict';
  function host() {
    let h = document.getElementById('toast-host');
    if (!h) { h = document.createElement('div'); h.id = 'toast-host'; h.className = 'toast-host'; (document.body || document.documentElement).appendChild(h); }
    return h;
  }
  const ICON = { success: 'ti-circle-check', error: 'ti-alert-triangle', warn: 'ti-alert-triangle', info: 'ti-info-circle', money: 'ti-coin' };

  window.showToast = function (msg, type, opts) {
    if (msg == null) return;
    opts = opts || {}; type = type || 'info';
    const h = host();
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    const ic = ICON[type] || ICON.info;
    const text = String(msg).replace(/\n+/g, '<br>');
    t.innerHTML = '<i class="ti ' + ic + '" aria-hidden="true"></i><span class="toast-txt">' + text + '</span>';
    let timer;
    const hide = () => { clearTimeout(timer); t.classList.remove('show'); setTimeout(() => { if (t.parentNode) t.remove(); }, 280); };
    t.addEventListener('click', hide);
    h.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    timer = setTimeout(hide, opts.duration || (type === 'error' ? 4500 : 3000));
    while (h.children.length > 4) h.removeChild(h.firstChild);
  };

  // Blockierende native Alerts durch Toasts ersetzen.
  try { window.alert = function (m) { window.showToast(m, 'error', { duration: 4500 }); }; } catch (e) {}

  console.log('[Toast v1] aktiv — Toasts statt Alerts');
})();
