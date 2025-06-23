import React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth'
import { auth, db } from '../config/firebase'
import { doc, setDoc } from 'firebase/firestore'

interface AuthContextType {
  currentUser: User | null
  signup: (email: string, password: string, displayName: string) => Promise<void>
  login: (email: string, password: string) => Promise<UserCredential>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function signup(email: string, password: string, displayName: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: userCredential.user.email,
      uid: userCredential.user.uid,
      displayName: displayName,
      createdAt: new Date(),
    })
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    currentUser,
    signup,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 