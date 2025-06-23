# Real-Time Chat Application

A real-time chat application built with Firebase, React (TypeScript), and Socket.IO.

## Features

### Enhanced User Experience with Display Names

The application now supports user display names for a better chat experience:

1. **Display Name Support**: Users can set custom display names instead of showing email addresses
2. **Fallback System**: If no display name is set, the system falls back to showing the email address
3. **Real-time Updates**: Display names are fetched and cached efficiently for real-time use
4. **Profile Management**: Users can update their display names through a dedicated profile page

### Key Components

- **User Registration**: New users can set their display name during signup
- **Profile Updates**: Existing users can update their display names via the Profile page
- **Chat Interface**: Shows the other person's display name in the chat header
- **Message Display**: Messages show sender display names instead of emails
- **User Search**: Search results show display names with email fallback

### Security & Performance

- **Secure**: All user data is stored in Firestore with proper authentication
- **Efficient**: Display names are cached to minimize Firestore reads
- **Real-time**: Updates are handled through Socket.IO and Firestore listeners
- **Fallback**: Graceful handling when display names are not available

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set up Firebase**:
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Add your Firebase configuration to environment variables

3. **Start the Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. **Start the Frontend**:
   ```bash
   npm run dev
   ```

## Usage

1. **Sign Up**: Create an account with email, password, and display name
2. **Search Users**: Find other users by email address
3. **Start Chat**: Click "Start Chat" to begin a conversation
4. **Update Profile**: Use the Profile page to update your display name
5. **Real-time Messaging**: Send and receive messages in real-time

## File Structure

```
src/
├── components/
│   ├── PrivateRoute.tsx
│   └── ProfileUpdate.tsx
├── contexts/
│   └── AuthContext.tsx
├── pages/
│   ├── Chat.tsx
│   ├── ChatRoom.tsx
│   ├── Login.tsx
│   ├── Profile.tsx
│   └── Signup.tsx
├── utils/
│   └── userUtils.ts
└── config/
    └── firebase.ts
```

## Technical Details

### Display Name Implementation

- **Storage**: Display names are stored in Firestore user documents
- **Caching**: User display names are cached in component state to reduce Firestore reads
- **Fallback**: Email addresses are used as fallback when display names are not available
- **Real-time**: Display names are fetched and updated in real-time using Firestore listeners

### Security Considerations

- All user data is protected by Firebase Authentication
- Display names are validated and sanitized
- User profiles can only be updated by the authenticated user
- Chat participants are verified before allowing access

### Performance Optimizations

- Display names are cached to minimize database reads
- Efficient queries using Firestore indexes
- Real-time updates through Socket.IO for immediate feedback
- Lazy loading of user profiles when needed 