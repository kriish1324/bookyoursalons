import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDMclqnmKSFqhXmPMmbHGJHoGXyQKaKEME",
  authDomain: "bookyoursalons.firebaseapp.com",
  projectId: "bookyoursalons",
  storageBucket: "bookyoursalons.firebasestorage.app",
  messagingSenderId: "975712273772",
  appId: "1:975712273772:web:a3a189b3bdfdcfa04a9f49",
  measurementId: "G-XS5XBVNDJ0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// FCM Messaging (only in browser with service worker support)
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.log('FCM not supported in this browser');
  }
}

// Request FCM token for push notifications
export const requestFCMToken = async () => {
  if (!messaging) return null;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  if (!messaging) return;
  
  return onMessage(messaging, (payload) => {
    console.log('Foreground message:', payload);
    callback(payload);
  });
};

export { messaging };
export default app;