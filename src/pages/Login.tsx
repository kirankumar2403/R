import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db } from '../config/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let loginEmail = emailOrUsername
    try {
      // If input does not contain '@', treat as username
      if (!emailOrUsername.includes('@')) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('usernameLower', '==', emailOrUsername.toLowerCase()))
        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) {
          setError('No user found with that username.')
          setLoading(false)
          return
        }
        // Use the first matching user's email
        loginEmail = querySnapshot.docs[0].data().email
      }

      await login(loginEmail, password)
      navigate('/chat')
    } catch (err: any) {
      setError('Failed to log in')
      console.error('Login error:', err)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <div className="max-w-md w-full space-y-8 bg-white/90 rounded-2xl shadow-2xl p-10 backdrop-blur-md">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-indigo-700 drop-shadow-sm tracking-tight">
            Chat App
          </h2>
          <p className="mt-2 text-center text-gray-500 text-lg">Sign in to your account</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-sm animate-pulse">
              {error}
            </div>
          )}
          <div className="rounded-xl shadow-sm space-y-4">
            <div>
              <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-700 mb-1">
                Email or Username
              </label>
              <input
                id="emailOrUsername"
                name="emailOrUsername"
                type="text"
                autoComplete="username"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Email or Username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 shadow-lg transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="text-center mt-4">
            <a href="/signup" className="font-medium text-indigo-600 hover:text-purple-600 transition-colors duration-200 underline underline-offset-2">
              Don't have an account? Sign up
            </a>
          </div>
        </form>
      </div>
    </div>
  )
} 