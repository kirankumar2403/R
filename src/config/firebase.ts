import React from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAY7gIiITfTfFyiRJXbj1ePnqCKsb75wss",
  authDomain: "realtime-chatapp-610f5.firebaseapp.com",
  projectId: "realtime-chatapp-610f5",
  storageBucket: "realtime-chatapp-610f5.firebasestorage.app",
  messagingSenderId: "200899920549",
  appId: "1:200899920549:web:c27b2743d538429501c34c",
  measurementId: "G-VS7QB07RDM"
};

console.log('API KEY:', import.meta.env.VITE_FIREBASE_API_KEY);

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

export default app 