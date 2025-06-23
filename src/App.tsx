import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Chat from './pages/Chat'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/chat/:chatId" element={<PrivateRoute><ChatRoom /></PrivateRoute>} />
            <Route
              path="/chat"
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              }
            />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App 