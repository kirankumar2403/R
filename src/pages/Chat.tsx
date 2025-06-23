import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db } from '../config/firebase'
import { collection, query, where, getDocs, doc, setDoc, getDoc, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { UserProfile as BaseUserProfile, getDisplayName, updateOnlineStatus, updateLastActive, isUserOnline, getLastSeenString } from '../utils/userUtils'

interface UserProfile extends BaseUserProfile {
  username?: string;
}

type LastMessage = { text: string; timestamp?: any } | undefined;
interface ChatThread {
  chatId: string;
  user: {
    uid: string;
    email: string;
    username: string;
    online?: boolean;
    lastSeen?: any;
    lastActive?: any;
  };
  lastMessage?: {
    text: string;
    timestamp?: any;
  };
}

export default function Chat() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [searchEmail, setSearchEmail] = useState('')
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([])
  const [searchError, setSearchError] = useState('')
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [onlineStatusUnsubscribes, setOnlineStatusUnsubscribes] = useState<{ [uid: string]: () => void }>({})
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('chatRoomTheme') || 'bg-gray-100');
  const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});

  useEffect(() => {
    if (!currentUser) return;

    // Set user as online
    updateOnlineStatus(currentUser.uid, true);

    // Set up cleanup for when user leaves
    const handleTabClose = () => {
      updateOnlineStatus(currentUser.uid, false);
    };

    window.addEventListener('beforeunload', handleTabClose);

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      updateOnlineStatus(currentUser.uid, false);
    };
  }, [currentUser]);

  // Effect to handle real-time online status updates for found users
  useEffect(() => {
    // Clean up previous listeners
    return () => {
      Object.values(onlineStatusUnsubscribes).forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Function to set up online status listener for a user
  const setupOnlineStatusListener = (user: UserProfile) => {
    if (onlineStatusUnsubscribes[user.uid]) {
      // Listener already exists
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setFoundUsers(prevUsers =>
          prevUsers.map(u =>
            u.uid === user.uid
              ? { ...u, online: userData.online || false, lastSeen: userData.lastSeen, lastActive: userData.lastActive }
              : u
          )
        );
      }
    });

    setOnlineStatusUnsubscribes(prev => ({
      ...prev,
      [user.uid]: unsubscribe
    }));
  };

  useEffect(() => {
    if (!currentUser) return;
    setLoadingChats(true);
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const threadPromises = snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
        const otherUid = data.participants.find((uid) => uid !== currentUser.uid);
        if (!otherUid) return null;
        const userDoc = await getDoc(doc(db, 'users', otherUid));
        // Fetch last message
        const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
        const lastMsgQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        const lastMsgSnap = await getDocs(lastMsgQuery);
        let lastMessage: ChatThread['lastMessage'] = undefined;
        if (!lastMsgSnap.empty) {
          const msgData = lastMsgSnap.docs[0].data();
          lastMessage = {
            text: msgData.text,
            timestamp: msgData.timestamp,
          };
        }
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            chatId: chatDoc.id,
            user: {
              uid: userDoc.id,
              email: userData.email,
              username: userData.username || userData.email,
              online: userData.online || false,
              lastSeen: userData.lastSeen,
              lastActive: userData.lastActive,
            },
            lastMessage,
          };
        }
        return null;
      });
      const threads = (await Promise.all(threadPromises)).filter(Boolean) as ChatThread[];
      // Sort threads by last message timestamp, most recent first
      const sortedThreads = threads.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
        const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      setChatThreads(sortedThreads);
      setLoadingChats(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Add real-time listener for new messages to update chat order
  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Update threads when new messages arrive
      const updatedThreads = [...chatThreads];
      let needsUpdate = false;

      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified') {
          const chatId = change.doc.id;
          const messagesRef = collection(db, 'chats', chatId, 'messages');
          const lastMsgQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
          const lastMsgSnap = await getDocs(lastMsgQuery);

          if (!lastMsgSnap.empty) {
            const msgData = lastMsgSnap.docs[0].data();
            const threadIndex = updatedThreads.findIndex(t => t.chatId === chatId);
            
            if (threadIndex !== -1) {
              updatedThreads[threadIndex] = {
                ...updatedThreads[threadIndex],
                lastMessage: {
                  text: msgData.text,
                  timestamp: msgData.timestamp
                }
              };
              needsUpdate = true;
            }
          }
        }
      }

      if (needsUpdate) {
        // Sort threads by last message timestamp
        const sortedThreads = updatedThreads.sort((a, b) => {
          const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
          const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
          return timeB - timeA;
        });
        setChatThreads(sortedThreads);
      }
    });

    return () => unsubscribe();
  }, [currentUser, chatThreads]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('chatRoomTheme');
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // Heartbeat: update lastActive every 30 seconds
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      updateLastActive(currentUser.uid);
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    // Clean up previous listeners
    let unsubscribes: (() => void)[] = [];
    const counts: { [chatId: string]: number } = {};
    chatThreads.forEach(thread => {
      const messagesRef = collection(db, 'chats', thread.chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let unread = 0;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.readBy || !data.readBy.includes(currentUser.uid)) {
            unread++;
          }
        });
        setUnreadCounts(prev => ({ ...prev, [thread.chatId]: unread }));
      });
      unsubscribes.push(unsubscribe);
    });
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [chatThreads, currentUser]);

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out', error)
    }
  }

  async function handleSearch() {
    // Clean up previous listeners
    Object.values(onlineStatusUnsubscribes).forEach(unsubscribe => unsubscribe());
    setOnlineStatusUnsubscribes({});

    setSearchError('')
    setFoundUsers([])
    if (!searchEmail) {
      setSearchError('Please enter an email or username to search.')
      return
    }

    if (searchEmail === currentUser?.email) {
        setSearchError('You cannot search for your own email.')
        return
    }

    try {
      const usersRef = collection(db, 'users')
      // Query by email (exact match)
      const qEmail = query(usersRef, where('email', '==', searchEmail))
      // Query by usernameLower (starts with, case-insensitive)
      const searchLower = searchEmail.toLowerCase()
      const qUsername = query(
        usersRef,
        where('usernameLower', '>=', searchLower),
        where('usernameLower', '<=', searchLower + '\uf8ff')
      )

      const [emailSnap, usernameSnap] = await Promise.all([
        getDocs(qEmail),
        getDocs(qUsername),
      ])

      const users: UserProfile[] = []
      const seen = new Set()

      emailSnap.forEach((doc) => {
        if (doc.id !== currentUser?.uid) {
          const userData = doc.data()
          users.push({
            uid: doc.id,
            email: userData.email,
            username: userData.username || userData.email,
            createdAt: userData.createdAt?.toDate() || new Date(),
            online: userData.online || false,
            lastSeen: userData.lastSeen
          })
          seen.add(doc.id)
        }
      })

      usernameSnap.forEach((doc) => {
        if (!seen.has(doc.id) && doc.id !== currentUser?.uid) {
          const userData = doc.data()
          users.push({
            uid: doc.id,
            email: userData.email,
            username: userData.username || userData.email,
            createdAt: userData.createdAt?.toDate() || new Date(),
            online: userData.online || false,
            lastSeen: userData.lastSeen
          })
        }
      })

      if (users.length === 0) {
        setSearchError('No user found with that email or username.')
      } else {
        setFoundUsers(users)
        // Set up online status listeners for all found users
        users.forEach(setupOnlineStatusListener)
      }
    } catch (error) {
      console.error('Error searching for user:', error)
      setSearchError('Failed to search for user.')
    }
  }

  async function handleStartChat(selectedUser: UserProfile) {
    if (!currentUser) {
      setSearchError('You must be logged in to start a chat.')
      return
    }

    // Generate a consistent chat ID by sorting UIDs
    const participants = [currentUser.uid, selectedUser.uid].sort()
    const chatId = participants.join('_') // e.g., uid1_uid2

    try {
      const chatRef = doc(db, 'chats', chatId)
      const chatDoc = await getDocs(query(collection(db, 'chats'), where('id', '==', chatId)))

      if (chatDoc.empty) {
        // Chat does not exist, create it
        await setDoc(chatRef, {
          id: chatId,
          participants: participants,
          createdAt: new Date(),
        })
        console.log('New chat created with ID:', chatId)
      } else {
        console.log('Chat already exists with ID:', chatId)
      }
      // Navigate to the chat room
      navigate(`/chat/${chatId}`)
    } catch (error) {
      console.error('Error starting chat:', error)
      setSearchError('Failed to start chat.')
    }
  }

  const sendMessage = async () => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: newMessage,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 transition-colors duration-500">
      <nav className="bg-white/90 shadow-lg backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <svg className="h-8 w-8 align-middle" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="chatGradient" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1" />
                    <stop offset="0.5" stopColor="#A78BFA" />
                    <stop offset="1" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
                <rect x="4" y="8" width="48" height="32" rx="10" fill="url(#chatGradient)" />
                <ellipse cx="28" cy="24" rx="16" ry="10" fill="#fff" fillOpacity="0.15" />
                <circle cx="18" cy="24" r="3" fill="#fff" fillOpacity="0.8" />
                <circle cx="28" cy="24" r="3" fill="#fff" fillOpacity="0.8" />
                <circle cx="38" cy="24" r="3" fill="#fff" fillOpacity="0.8" />
                <path d="M16 40L12 48L28 40H48C52 40 52 36 52 36V18C52 14 48 14 48 14H8C4 14 4 18 4 18V36C4 40 8 40 8 40H16Z" fill="url(#chatGradient)" fillOpacity="0.3" />
              </svg>
              <h1 className="text-2xl font-extrabold text-indigo-700 tracking-tight drop-shadow-sm">Chat App</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium bg-white/70 px-3 py-1 rounded-lg shadow-sm">{currentUser?.email}</span>
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
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-10 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white/90 shadow-2xl rounded-2xl p-8 mb-6 backdrop-blur-md">
            <h2 className="text-3xl font-bold mb-6 text-indigo-700 drop-shadow-sm">Find Users</h2>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                placeholder="Search user by email or username"
                className="flex-grow px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 bg-white/80 shadow-sm text-lg"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
              <button
                onClick={handleSearch}
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md transition-all duration-200 text-lg"
              >
                Search
              </button>
            </div>
            {searchError && <p className="text-red-500 mt-2 animate-pulse font-medium">{searchError}</p>}

            {/* Recent Chats List */}
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-3 text-gray-700">Recent Chats</h3>
              {loadingChats ? (
                <p className="text-gray-500">Loading chats...</p>
              ) : chatThreads.length === 0 ? (
                <p className="text-gray-400">No chats yet</p>
              ) : (
                <ul>
                  {chatThreads.map((thread) => (
                    <li
                      key={thread.chatId}
                      className="flex flex-col bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 p-4 rounded-xl mt-2 cursor-pointer hover:bg-indigo-100 transition-all duration-200 shadow-sm"
                      onClick={() => navigate(`/chat/${thread.chatId}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          {thread.user.uid !== currentUser?.uid && isUserOnline(thread.user) && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          <span className={unreadCounts[thread.chatId] > 0
                            ? 'text-gray-800 font-extrabold text-lg flex items-center'
                            : 'text-gray-800 font-semibold text-lg flex items-center'}>
                            {thread.user.username}
                            {unreadCounts[thread.chatId] > 0 && (
                              <span className="ml-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                {unreadCounts[thread.chatId]}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      {thread.lastMessage && (
                        <div className="text-gray-600 text-sm mt-1 truncate">
                          {thread.lastMessage.text}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {foundUsers.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Found Users:</h3>
                <ul>
                  {foundUsers.map((user) => (
                    <li key={user.uid} className="flex justify-between items-center bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 p-4 rounded-xl mt-2 shadow-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          {isUserOnline(user) && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          <span className="text-gray-800 font-semibold text-lg">{user.username}</span>
                          {isUserOnline(user) ? (
                            <span className="text-green-600 text-xs ml-2">Online</span>
                          ) : (
                            user.lastActive && (
                              <span className="text-gray-500 text-xs ml-2">Last seen: {getLastSeenString(user)}</span>
                            )
                          )}
                        </div>
                        <span className="text-gray-500 text-sm">{user.email}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartChat(user);
                        }}
                        className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all duration-200"
                      >
                        Start Chat
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 