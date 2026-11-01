import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const app = initializeApp({
  apiKey: 'AIzaSyCVv91-tOlYFjeSnnxPwy0DvHCTrx6RLRA',
  authDomain: 'task-d72fd.firebaseapp.com',
  projectId: 'task-d72fd',
  storageBucket: 'task-d72fd.firebasestorage.app',
  messagingSenderId: '519968108936',
  appId: '1:519968108936:web:41b31ec769b12434b6ca3d',
  measurementId: 'G-6M6X2H6QWG',
})
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export function explainError(error) {
  const messages = {
    'auth/invalid-credential': 'The email ID or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email ID.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Unable to connect. Check your internet connection.',
    'auth/operation-not-allowed': 'Enable Email/Password sign-in in Firebase Authentication.',
    'auth/configuration-not-found': 'Set up Firebase Authentication and enable Email/Password sign-in.',
    'permission-denied': 'Access denied. Publish the project’s Firestore security rules in Firebase.',
    'storage/unauthorized': 'Upload access denied. Publish the project’s Storage security rules in Firebase.',
    'storage/unknown': 'Storage is unavailable. Check the Firebase Storage setup and network connection.',
    'storage/retry-limit-exceeded': 'The upload timed out. Check your connection and try again.',
    'storage/bucket-not-found': 'Create the Firebase Storage bucket for this project first.',
  }
  return messages[error.code] || error.message || 'Something went wrong. Please try again.'
}

// Username accounts use a stable Firebase email alias; passwords stay in Authentication.
export const loginEmail = id => id.trim().includes('@') ? id.trim() : id.trim().toLowerCase() + '@task-d72fd.firebaseapp.com'


export const ownerUid = 'TBuHUAFGhjXCjRVPU1nA3DKIBtk2'

