// main.js — titik masuk aplikasi
(function () {
  window.addEventListener('error', e => console.error('UI error:', e.message));
  window.addEventListener('unhandledrejection', e => console.error('Promise ditolak:', e.reason));
  if (!location.hash) location.hash = restoreSession() ? '#/' : '#/login'; else restoreSession();
  // peringatan koneksi
  window.addEventListener('offline', () => toast('Anda sedang offline. Perubahan tidak akan tersimpan.', 'err'));
  window.addEventListener('online', () => toast('Koneksi pulih.', 'ok'));
  route();
  // pemanasan server saat halaman terbuka (mengurangi cold start pada klik pertama)
  if (gasReady() && App.token) fetch(CFG.GAS_URL + '?w=1', { method: 'GET', mode: 'no-cors' }).catch(() => {});
})();
