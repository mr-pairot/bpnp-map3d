/* js/core/toast.js
 * ─────────────────────────────────────────────────────────────────────────
 * แถบแจ้งสถานะด้านบน (เช่น "กำลังโหลด ...") — ใช้ DOM #bp-toast-notification ใน index.html
 *   BPNP.core.toast.show(message, showSpinner = false, autoHideMs = 0)
 *   BPNP.core.toast.hide()
 * แสดงอย่างน้อย 1 วินาที กันกะพริบเมื่องานเสร็จเร็ว
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const MIN_DISPLAY_MS = 1000;
  let hideTimer = null, showTimer = null, visibleAt = 0;

  const el = id => document.getElementById(id);

  function show(message, showSpinner = false, autoHideMs = 0) {
    const toast = el('bp-toast-notification');
    if (!toast) return;
    el('bp-toast-message').textContent = message;
    el('bp-toast-spinner').style.display = showSpinner ? 'block' : 'none';
    clearTimeout(hideTimer); clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      toast.classList.add('bp-toast-visible');
      visibleAt = Date.now();
      if (autoHideMs > 0) hideTimer = setTimeout(hide, autoHideMs);
    }, 300);
  }

  function hide() {
    const toast = el('bp-toast-notification');
    if (!toast) return;
    clearTimeout(showTimer); showTimer = null;
    if (!toast.classList.contains('bp-toast-visible')) return;
    const remain = MIN_DISPLAY_MS - (Date.now() - visibleAt);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove('bp-toast-visible'), Math.max(0, remain));
  }

  BPNP.core.toast = { show, hide };
  window.ToastNotification = BPNP.core.toast;   // ชื่อเดิม
})();
