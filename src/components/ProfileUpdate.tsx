import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { fetchUserProfile, UserProfile } from '../utils/userUtils'

export default function ProfileUpdate() {
  const { currentUser } = useAuth()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const loadUserProfile = async () => {
      if (currentUser?.uid) {
        const profile = await fetchUserProfile(currentUser.uid)
        setUserProfile(profile)
        if (profile?.username) {
          setUsername(profile.username)
        }
      }
    }
    loadUserProfile()
  }, [currentUser])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser?.uid || !username.trim()) return

    setLoading(true)
    setMessage('')

    try {
      const userRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userRef, {
        username: username.trim(),
        usernameLower: username.trim().toLowerCase(),
      })
      
      setMessage('Profile updated successfully!')
      setUserProfile(prev => prev ? { ...prev, username: username.trim() } : null)
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) {
    return <div>Please log in to update your profile.</div>
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Update Profile</h2>
      
      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={currentUser.email || ''}
            disabled
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username *
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {message && (
          <div className={`p-3 rounded-md ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  )
} 