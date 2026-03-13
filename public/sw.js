// Service Worker for Push Notifications (RTL / Hebrew aware)
// Handles background push events and notification clicks.

self.addEventListener('push', function(event) {
  let data = { title: 'תזכורת', body: '', icon: '/placeholder.svg', type: 'med' };
  
  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      try {
        data.body = event.data.text();
      } catch (e2) {
        data.body = 'יש לך תזכורת חדשה';
      }
    }
  }

  // Badge color based on type
  const isMed = data.type === 'med';
  const options = {
    body: data.body,
    icon: data.icon || '/placeholder.svg',
    badge: '/placeholder.svg',
    vibrate: isMed ? [200, 100, 200] : [300, 150, 300],
    tag: data.tag || 'default',
    requireInteraction: true,
    dir: 'rtl',
    lang: 'he',
    data: { ...(data.data || {}), type: data.type },
    actions: isMed
      ? [{ action: 'taken', title: '✅ נלקחה' }]
      : [{ action: 'navigate', title: '📍 ניווט' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
