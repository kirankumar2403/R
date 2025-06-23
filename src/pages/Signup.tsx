import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      return setError('Passwords do not match')
    }

    if (!username.trim()) {
      return setError('Username is required')
    }

    try {
      setError('')
      setLoading(true)
      await signup(email, password, username)
      navigate('/chat')
    } catch (error: any) {
      setError('Failed to create an account')
      console.error('Signup error:', error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <div className="max-w-md w-full space-y-8 bg-white/90 rounded-2xl shadow-2xl p-10 backdrop-blur-md">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-indigo-700 drop-shadow-sm tracking-tight">
            Create your account
          </h2>
          <p className="mt-2 text-center text-gray-500 text-lg">Sign up to get started</p>
        </div>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-sm animate-pulse" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-xl shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                autoComplete="new-password"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all duration-200 bg-white/80 shadow-sm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 shadow-lg transition-all duration-200 disabled:opacity-60"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </div>
        </form>
        <div className="text-center mt-4">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-purple-600 transition-colors duration-200 underline underline-offset-2">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
} 