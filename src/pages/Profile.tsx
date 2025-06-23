import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProfileUpdate from '../components/ProfileUpdate'

export default function Profile() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Profile Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{currentUser?.email}</span>
              <button
                onClick={() => navigate('/chat')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to Chat
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <ProfileUpdate />
        </div>
      </main>
    </div>
  )
} 