import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyA-Hyj6KydoSNO5OwXkfKT1c5ZoN9wJdCk',
  authDomain: 'nook-79b28.firebaseapp.com',
  projectId: 'nook-79b28',
  storageBucket: 'nook-79b28.firebasestorage.app',
  messagingSenderId: '455733147095',
  appId: '1:455733147095:web:97325467176c4b4ab58792',
}

const app = initializeApp(firebaseConfig)
export const messaging = getMessaging(app)
