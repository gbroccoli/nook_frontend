importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '%VITE_FIREBASE_API_KEY%',
  authDomain: '%VITE_FIREBASE_AUTH_DOMAIN%',
  projectId: '%VITE_FIREBASE_PROJECT_ID%',
  storageBucket: '%VITE_FIREBASE_STORAGE_BUCKET%',
  messagingSenderId: '%VITE_FIREBASE_MESSAGING_SENDER_ID%',
  appId: '%VITE_FIREBASE_APP_ID%',
})

const messaging = firebase.messaging()

// Background push messages (site closed / tab not focused)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Nook'
  const body = payload.notification?.body ?? ''
  const data = payload.data ?? {}
  // Бэкенд может прислать avatar_url в data-поле
  const icon = data.avatar_url || '/web-app-manifest-192x192.png'

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/favicon-96x96.png',
    data,
    tag: data.type ?? 'nook',
    renotify: true,
  })
})

// Click on background notification → focus or open the tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data ?? {}
  let url = '/'
  if (data.room_id) {
    url = `/app/dm/${data.room_id}`
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return clients.openWindow(url)
      }),
  )
})
