import { getToken, onMessage, type MessagePayload } from 'firebase/messaging'
import { messaging } from './firebase'

// VAPID public key — Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Key pair
// Замените на ваш реальный VAPID ключ (публичный, начинается с "BN...")
const VAPID_KEY = 'BBGNY9cdZ2zy4kLL-tfFsHzBmBjhdBiyOxJ8TBaohemr_eoBZR_ucVn1o5S9cHscGXIxUW3oR1jQE1bBpsWyYyo'

let swRegistration: ServiceWorkerRegistration | null = null

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  if (swRegistration) return swRegistration
  try {
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    return swRegistration
  } catch {
    return null
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export async function getFcmToken(): Promise<string | null> {
  if (!VAPID_KEY || (VAPID_KEY as string).startsWith('YOUR_VAPID')) return null
  try {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') return null
    const sw = await getSwRegistration()
    const opts = sw ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw } : { vapidKey: VAPID_KEY }
    return await getToken(messaging, opts)
  } catch {
    return null
  }
}

export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  const { icon, ...rest } = options ?? {}
  new Notification(title, {
    icon: icon || '/web-app-manifest-192x192.png',
    badge: '/favicon-96x96.png',
    ...rest,
  })
}

export function onForegroundFcmMessage(callback: (payload: MessagePayload) => void): () => void {
  return onMessage(messaging, callback)
}
