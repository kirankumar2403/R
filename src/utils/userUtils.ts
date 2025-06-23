import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  username?: string
  createdAt?: Date
  online?: boolean
  lastSeen?: any
  lastActive?: any
}

/**
 * Fetch a user's profile from Firestore
 * @param uid - The user's UID
 * @returns Promise<UserProfile | null>
 */
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      return {
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.username || userData.displayName || userData.email, // Prioritize username
        username: userData.username,
        createdAt: userData.createdAt?.toDate() || new Date(),
        online: userData.online || false,
        lastSeen: userData.lastSeen,
        lastActive: userData.lastActive
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

/**
 * Get display name for a user with fallback
 * @param user - User profile or Firebase User object
 * @returns string - Display name or email as fallback
 */
export const getDisplayName = (user: UserProfile | any): string => {
  if (user?.username) {
    return user.username;
  }
  if (user?.displayName) {
    return user.displayName
  }
  if (user?.email) {
    return user.email
  }
  return 'Unknown User'
}

/**
 * Get the other user's UID from chat participants
 * @param participants - Array of participant UIDs
 * @param currentUserUid - Current user's UID
 * @returns string | null - The other user's UID or null
 */
export const getOtherUserUid = (participants: string[], currentUserUid: string): string | null => {
  if (!currentUserUid || participants.length !== 2) return null
  return participants.find(uid => uid !== currentUserUid) || null
}

/**
 * Update user's online status and last seen timestamp
 * @param uid - User's UID
 * @param isOnline - Whether the user is online
 */
export const updateOnlineStatus = async (uid: string, isOnline: boolean) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      online: isOnline,
      lastSeen: serverTimestamp(),
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

/**
 * Get user's online status and last seen timestamp
 * @param uid - User's UID
 * @returns Promise<{ online: boolean, lastSeen: any, lastActive: any } | null>
 */
export const getOnlineStatus = async (uid: string): Promise<{ online: boolean, lastSeen: any, lastActive: any } | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        online: data.online || false,
        lastSeen: data.lastSeen,
        lastActive: data.lastActive
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting online status:', error);
    return null;
  }
};

/**
 * Update user's last active timestamp
 * @param uid - User's UID
 */
export const updateLastActive = async (uid: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating last active:', error);
  }
};

/**
 * Check if a user is currently online based on their last activity
 * @param user - User profile object
 * @returns boolean - True if user is online
 */
export const isUserOnline = (user: UserProfile): boolean => {
  if (!user || !user.online) return false;
  
  // Check if user has been active in the last 5 minutes
  const lastActiveTime = user.lastActive?.toDate ? user.lastActive.toDate().getTime() : 
                        user.lastSeen?.toDate ? user.lastSeen.toDate().getTime() : 
                        user.lastActive || user.lastSeen;
  
  if (!lastActiveTime) return false;
  
  // Consider user online if they've been active in the last 5 minutes
  return Date.now() - lastActiveTime < 5 * 60 * 1000; // 5 minutes
};

/**
 * Get a user-friendly last seen string
 * @param user - User profile object
 * @returns string - Formatted last seen string
 */
export const getLastSeenString = (user: UserProfile): string => {
  if (!user) return '';
  
  const lastSeenTime = user.lastSeen?.toDate ? user.lastSeen.toDate().getTime() : 
                      user.lastActive?.toDate ? user.lastActive.toDate().getTime() : 
                      user.lastSeen || user.lastActive;
  
  if (!lastSeenTime) return '';
  
  const now = Date.now();
  const diff = now - lastSeenTime;
  
  // Convert to seconds, minutes, hours, days
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `Last seen ${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `Last seen ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (seconds > 30) {
    return `Last seen ${seconds} second${seconds > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}; 