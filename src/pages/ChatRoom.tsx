import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../config/firebase'
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Unsubscribe,
  where,
  getDocs,
  or,
  startAt,
  endAt,
  updateDoc,
  setDoc,
  limit
} from 'firebase/firestore'
import io from 'socket.io-client'
import { getIdToken } from 'firebase/auth'
import { fetchUserProfile, getDisplayName, getOtherUserUid, UserProfile, updateOnlineStatus, updateLastActive, isUserOnline, getLastSeenString } from '../utils/userUtils'

interface Message {
  id: string
  senderId: string
  senderEmail: string
  senderDisplayName?: string
  text: string
  timestamp: any // Firestore Timestamp
  readBy?: string[]
}

interface ChatThread {
  chatId: string
  user: {
    uid: string
    email: string
    username: string
    online?: boolean
    lastSeen?: any
    lastActive?: any
  }
  lastMessage?: {
    text: string
    timestamp?: any
  }
}

// Backend server URL
const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'https://rr-1-9mim.onrender.com'

// Enhanced theme options
const THEMES = [
  { name: 'Minimal Light', type: 'color', value: 'bg-slate-100', preview: 'bg-slate-100' },
  { name: 'Cyberpunk Night', type: 'color', value: 'bg-gradient-to-br from-gray-800 via-purple-900 to-indigo-900', preview: 'bg-gradient-to-br from-gray-800 via-purple-900 to-indigo-900' },
  { name: 'Lush Meadow', type: 'color', value: 'bg-gradient-to-br from-lime-300 to-green-500', preview: 'bg-gradient-to-br from-lime-300 to-green-500' },
  { name: 'Tropic Sunset', type: 'color', value: 'bg-gradient-to-br from-red-500 to-orange-400', preview: 'bg-gradient-to-br from-red-500 to-orange-400' },
  { name: 'Cosmic Dust', type: 'color', value: 'bg-gradient-to-br from-purple-800 via-pink-700 to-red-600', preview: 'bg-gradient-to-br from-purple-800 via-pink-700 to-red-600' },
  { name: 'Ocean Deep', type: 'color', value: 'bg-gradient-to-br from-blue-800 to-cyan-600', preview: 'bg-gradient-to-br from-blue-800 to-cyan-600' },
  { name: 'Autumn Forest', type: 'color', value: 'bg-gradient-to-br from-yellow-600 to-red-800', preview: 'bg-gradient-to-br from-yellow-600 to-red-800' },
  { name: 'Pastel Rainbow', type: 'color', value: 'bg-gradient-to-br from-pink-200 via-yellow-200 via-green-200 to-blue-200', preview: 'bg-gradient-to-br from-pink-200 via-yellow-200 via-green-200 to-blue-200' },
  // Scenic/abstract photos (Unsplash, Pexels, etc.)
  { name: 'Alpine Peaks', type: 'image', value: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80', preview: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=200&q=40' },
  { name: 'Marble Ink', type: 'image', value: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=800&q=80', preview: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=200&q=40' },
]

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [chatParticipants, setChatParticipants] = useState<string[]>([])
  const [chatError, setChatError] = useState('')
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null)
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({})
  const socketRef = useRef<any>(null) // Ref to hold the socket instance
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [searchEmail, setSearchEmail] = useState('')
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: { username: string, email: string } }>({})
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('chatRoomTheme') || 'bg-gray-100')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [tempTheme, setTempTheme] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const otherUserUid = getOtherUserUid(chatParticipants, currentUser?.uid || '')

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission()
    }
  }, [])

  // Function to get display name for a user (with caching)
  const getCachedDisplayName = async (uid: string): Promise<string> => {
    if (uid === currentUser?.uid && currentUser?.uid) {
      // Get current user's profile to show username
      const userProfile = await fetchUserProfile(currentUser.uid);
      return userProfile?.username || currentUser.email || '';
    }
    return userDisplayNames[uid] || 'Unknown User';
  }

  useEffect(() => {
    if (!chatId || !currentUser) return

    // Initialize Socket.IO connection
    socketRef.current = io(SOCKET_SERVER_URL)

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server', socketRef.current.id)
      socketRef.current.emit('join-chat', chatId) // Join the specific chat room
    })

    // Removed the socketRef.current.on('receive-message') listener
    // Firestore's onSnapshot will handle all message updates to prevent duplicates.

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from socket server')
    })

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [chatId, currentUser]) // Re-run effect if chatId or currentUser changes

  useEffect(() => {
    if (!chatId) return

    let unsubscribeFirestore: Unsubscribe | undefined // Declare unsubscribe variable

    const setupChatListener = async () => {
      try {
        const chatDocRef = doc(db, 'chats', chatId)
        const chatDoc = await getDoc(chatDocRef)

        if (chatDoc.exists()) {
          const data = chatDoc.data()
          setChatParticipants(data.participants)

          // Fetch the other user's profile (username/email)
          const otherUserUid = getOtherUserUid(data.participants, currentUser?.uid || '')
          if (otherUserUid) {
            const userProfile = await fetchUserProfile(otherUserUid)
            setOtherUserProfile(userProfile)
          }

          // Setup real-time listener for messages
          const messagesRef = collection(db, `chats/${chatId}/messages`)
          const q = query(messagesRef, orderBy('timestamp'))

          unsubscribeFirestore = onSnapshot(q, async (snapshot) => {
            console.log('onSnapshot fired, docs:', snapshot.docs.length);
            const msgs: Message[] = []
            const newUserDisplayNames: Record<string, string> = { ...userDisplayNames }
            for (const docSnap of snapshot.docs) {
              const messageData = docSnap.data()
              const senderId = messageData.senderId
              let displayName = messageData.senderDisplayName
              if (!displayName) {
                if (!newUserDisplayNames[senderId]) {
                  const userProfile = await fetchUserProfile(senderId)
                  if (userProfile) {
                    newUserDisplayNames[senderId] = userProfile.username || userProfile.email
                  }
                }
                displayName = newUserDisplayNames[senderId] || messageData.senderEmail || "Unknown User"
              }
              msgs.push({ 
                id: docSnap.id, 
                ...messageData,
                senderDisplayName: displayName
              } as Message)
            }
            setUserDisplayNames(newUserDisplayNames)
            setMessages(msgs)
          })
        } else {
          setChatError('Chat not found.')
          console.error('Chat document not found for ID:', chatId)
        }
      } catch (error) {
        console.error('Error fetching chat details or setting up listener:', error)
        setChatError('Failed to load chat.')
      }
    }

    setupChatListener()

    return () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore()
      }
    }
  }, [chatId, currentUser])

  useEffect(() => {
    const fetchChats = async () => {
      if (!currentUser || !chatId) return;
      setLoadingChats(true);
      
      try {
        // Fetch only the current chat
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        
        if (!chatDoc.exists()) {
          setLoadingChats(false);
          return;
        }

        const data = chatDoc.data();
        const otherUid = data.participants.find((uid: string) => uid !== currentUser.uid);
        
        if (otherUid) {
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          // Fetch last message
          const messagesRef = collection(db, 'chats', chatId, 'messages');
          const lastMsgQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
          const lastMsgSnap = await getDocs(lastMsgQuery);
          let lastMessage: ChatThread['lastMessage'] = undefined;
          
          if (!lastMsgSnap.empty) {
            const msgData = lastMsgSnap.docs[0].data();
            lastMessage = { text: msgData.text, timestamp: msgData.timestamp };
          }

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const thread: ChatThread = {
              chatId: chatDoc.id,
              user: {
                uid: userDoc.id,
                email: userData.email,
                username: userData.username || userData.email,
                online: userData.online || false,
                lastSeen: userData.lastSeen,
                lastActive: userData.lastActive
              },
              lastMessage,
            };
            setChatThreads([thread]);

            // Set up real-time listener for this user's online status
            const userRef = doc(db, 'users', userDoc.id);
            const unsubscribe = onSnapshot(userRef, (docSnap) => {
              if (docSnap.exists()) {
                const updatedUserData = docSnap.data();
                setChatThreads(prevThreads =>
                  prevThreads.map(t =>
                    t.user.uid === userDoc.id
                      ? {
                          ...t,
                          user: {
                            ...t.user,
                            online: updatedUserData.online || false,
                            lastSeen: updatedUserData.lastSeen,
                            lastActive: updatedUserData.lastActive
                          }
                        }
                      : t
                  )
                );
              }
            });

            return () => unsubscribe();
          }
        }
      } catch (error) {
        console.error('Error fetching chat:', error);
      } finally {
        setLoadingChats(false);
      }
    };

    fetchChats();
  }, [currentUser, chatId]);

  useEffect(() => {
    if (!otherUserUid) return;
    const userRef = doc(db, 'users', otherUserUid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setOtherUserProfile({
          uid: docSnap.id,
          email: userData.email,
          username: userData.username,
          displayName: userData.displayName,
          createdAt: userData.createdAt?.toDate(),
          online: userData.online || false,
          lastSeen: userData.lastSeen,
          lastActive: userData.lastActive
        });
      }
    });
    return () => unsubscribe();
  }, [otherUserUid]);

  useEffect(() => {
    // For all unique senderIds in messages, set up a real-time listener
    const uniqueSenderIds = Array.from(new Set(messages.map(msg => msg.senderId)));
    const unsubscribes: (() => void)[] = [];

    uniqueSenderIds.forEach(uid => {
      const userRef = doc(db, 'users', uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfiles(prev => ({
            ...prev,
            [uid]: {
              username: docSnap.data().username || docSnap.data().email,
              email: docSnap.data().email,
            }
          }));
        }
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [messages]);

  useEffect(() => {
    if (!socketRef.current) return;
    
    socketRef.current.on('typing', ({ user }) => {
      console.log('Received typing event from', user);
      if (user.uid !== currentUser?.uid) setIsOtherTyping(true);
    });
    socketRef.current.on('stop-typing', ({ user }) => {
      console.log('Received stop-typing event from', user);
      if (user.uid !== currentUser?.uid) setIsOtherTyping(false);
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.off('typing');
        socketRef.current.off('stop-typing');
      }
    };
  }, [chatId, currentUser?.uid]);

  // Save theme to localStorage when changed
  useEffect(() => {
    localStorage.setItem('chatRoomTheme', theme);
  }, [theme]);

  // Heartbeat: update lastActive every 30 seconds
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      updateLastActive(currentUser.uid);
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    try {
      const userProfile = await fetchUserProfile(currentUser.uid);
      const username = userProfile?.username || currentUser.email;
      const messageData = {
        text: newMessage,
        senderId: currentUser.uid,
        senderEmail: currentUser.email,
        senderDisplayName: username,
        readBy: [currentUser.uid],
        timestamp: serverTimestamp(),
      };
      // Write message to Firestore
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      // Update parent chat document for real-time list updates
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text: newMessage,
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      console.log('Message sent to Firestore and chat updated');
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out', error)
    }
  }

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    console.log('Emitting typing', { chatId, user: currentUser });
    socketRef.current.emit('typing', { chatId, user: currentUser });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      console.log('Emitting stop-typing', { chatId, user: currentUser });
      socketRef.current.emit('stop-typing', { chatId, user: currentUser });
    }, 1500); // 1.5s after last keystroke
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // For image backgrounds, use inline style; for color/gradient, use className
  const chatBgStyle = THEMES.find(t => t.type === 'image' && t.value === theme)
    ? { backgroundImage: `url(${theme})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  // When opening the theme picker, set tempTheme to current theme
  const openThemePicker = () => {
    setTempTheme(theme);
    setShowThemePicker(true);
  };

  // Helper for preview overlay
  const getPreviewOverlay = (t) => t.type === 'image' ? 'absolute inset-0 bg-black bg-opacity-30' : '';

  // For the green dot in the chat header:
  const isOtherUserOnline = (user: UserProfile | null): boolean => {
    if (!user) return false;
    return isUserOnline(user);
  };

  // Function to mark all messages as read when chat is opened
  const markMessagesAsRead = async () => {
    if (!currentUser || !chatId) return;
    const toUpdate = messages.filter(
      (msg) => !msg.readBy || !msg.readBy.includes(currentUser.uid)
    );
    if (toUpdate.length > 0) {
      console.log('markMessagesAsRead called, marking', toUpdate.length, 'messages as read');
    }
    await Promise.all(toUpdate.map(msg => {
      const msgRef = doc(db, `chats/${chatId}/messages`, msg.id);
      return updateDoc(msgRef, { readBy: [...(msg.readBy || []), currentUser.uid] });
    }));
  };

  // Mark as read only when chat is opened and messages are loaded
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  useEffect(() => {
    if (!hasMarkedRead && messages.length > 0) {
      markMessagesAsRead();
      setHasMarkedRead(true);
    }
  }, [chatId, messages, hasMarkedRead]);

  // Handler for scroll event
  const handleScroll = () => {};
  // Handler for input focus
  const handleInputFocus = () => {};

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (chatError) {
    return <div className="min-h-screen flex items-center justify-center text-red-500 text-xl">{chatError}</div>
  }

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading user...</div>
  }

  // Use tempTheme for preview if theme picker is open, else use saved theme
  return (
    (() => {
      const previewTheme = showThemePicker ? tempTheme : theme;
      const selectedTheme = THEMES.find(t => t.value === previewTheme);
      const isImageTheme = selectedTheme?.type === 'image';
      const chatBgClass = !isImageTheme && selectedTheme ? selectedTheme.value : '';
      const chatBgStyle = isImageTheme
        ? { backgroundImage: `url(${selectedTheme.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : {};
      return (
        <div className={`min-h-screen flex flex-col${chatBgClass ? ' ' + chatBgClass : ''}`} style={chatBgStyle}>
          <nav className="shadow-sm p-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold flex items-center space-x-2">
                {otherUserProfile ? (
                  <>
                    {isOtherUserOnline(otherUserProfile) && (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                    <span>{otherUserProfile.username || otherUserProfile.email}</span>
                    {!isOtherUserOnline(otherUserProfile) && (
                      <span className="text-sm text-gray-500 ml-2">
                        {getLastSeenString(otherUserProfile)}
                      </span>
                    )}
                  </>
                ) : 'Loading...'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{currentUser.email}</span>
              <button
                onClick={() => navigate('/profile')}
                className="bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all duration-200"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all duration-200"
              >
                Log Out
              </button>
              <button
                onClick={openThemePicker}
                className="bg-gradient-to-r from-blue-400 to-purple-400 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all duration-200"
              >
                Change Theme
              </button>
            </div>
          </nav>

          <div className="flex-1 flex flex-col">
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-xl ${
                      message.senderId === currentUser?.uid
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    <div className="text-sm opacity-75 mb-1">
                      {message.senderId === currentUser?.uid ? 'you' : (userDisplayNames[message.senderId] || message.senderEmail)}
                    </div>
                    <div className="flex items-center">
                      <span>{message.text}</span>
                      {message.senderId === currentUser?.uid && (
                        <span className="ml-2 text-xs flex items-center">
                          {/* Blue double tick if all recipients have read */}
                          {chatParticipants &&
                            message.readBy &&
                            chatParticipants.every(uid => uid === currentUser.uid || message.readBy.includes(uid)) ? (
                              <span className="text-blue-400 font-bold ml-1">✓✓</span>
                          ) : // Grey double tick if delivered to at least one recipient
                            message.readBy && message.readBy.length > 1 ? (
                              <span className="text-gray-300 font-bold ml-1">✓✓</span>
                          ) : (
                              // Single tick if sent
                              <span className="text-gray-300 font-bold ml-1">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isOtherTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-xl">
                    <div className="text-gray-500">Typing...</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onFocus={handleInputFocus}
                  placeholder="Type a message..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Theme Picker Modal */}
          {showThemePicker && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-8 w-96">
                <h2 className="text-lg font-semibold mb-4">Choose a Theme</h2>
                <div className="grid grid-cols-2 gap-4">
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all duration-150 h-20 flex items-end justify-start ${tempTheme === t.value ? 'border-blue-500 ring-2 ring-blue-400' : 'border-gray-300'}`}
                      style={t.type === 'image' ? { backgroundImage: `url(${t.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                      onClick={() => setTempTheme(t.value)}
                    >
                      {t.type === 'color' && (
                        <div className={`absolute inset-0 ${t.preview}`} />
                      )}
                      {t.type === 'image' && (
                        <div className={`absolute inset-0 bg-black bg-opacity-30`} />
                      )}
                      <span className="relative z-10 text-sm font-semibold text-white drop-shadow px-2 py-1 rounded-b-lg">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold"
                    onClick={() => { setTheme(tempTheme); setShowThemePicker(false); }}
                  >
                    Save
                  </button>
                  <button
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
                    onClick={() => setShowThemePicker(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    })()
  )
} 