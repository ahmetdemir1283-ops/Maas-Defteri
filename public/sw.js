// Web PWA yüklenebilirliği için minimal servis çalışanı.
// Mobil Capacitor sürümünde hatırlatmalar native Local Notifications ile çalışır.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Ağ varsayılan davranışı kullanılır.
});
