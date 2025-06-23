require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin SDK
// The GOOGLE_APPLICATION_CREDENTIALS environment variable should point to your service account key file
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const app = express();
const server = http.createServer(app);

// Use CORS middleware
// Allow requests from your React frontend URL
app.use(cors({
  origin: 'http://localhost:5173', // Updated to match frontend URL
  methods: ['GET', 'POST']
}));

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected', socket.id);

  // When a user joins a chat room
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat: ${chatId}`);
  });

  // When a user sends a message
  socket.on('send-message', async ({ chatId, senderId, senderEmail, text, idToken }) => {
    console.log(`Message in chat ${chatId} from ${senderEmail}: ${text}`);

    try {
      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Ensure the senderId from the message matches the authenticated UID
      if (uid !== senderId) {
        console.warn(`Security Alert: Mismatched senderId! Token UID: ${uid}, Provided senderId: ${senderId}`);
        // Optionally, emit an error back to the client or just ignore the message
        return;
      }

      // Fetch the sender's display name from Firestore
      let senderDisplayName = senderEmail; // Fallback to email
      try {
        const userDoc = await db.collection('users').doc(senderId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          senderDisplayName = userData.displayName || userData.email;
        }
      } catch (error) {
        console.error('Error fetching user display name:', error);
        // Continue with email as fallback
      }

      const messagesRef = db.collection('chats').doc(chatId).collection('messages');
      const newMessageRef = await messagesRef.add({
        senderId,
        senderEmail,
        senderDisplayName,
        text,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get the message back with the generated ID and timestamp
      const newMessageDoc = await newMessageRef.get();
      const messageData = { id: newMessageDoc.id, ...newMessageDoc.data() };

      // Emit the message to everyone in the chat room (including sender) for real-time update
      io.to(chatId).emit('receive-message', messageData);

    } catch (error) {
      console.error('Error saving or emitting message:', error);
    }
  });

  // Typing indicator events
  socket.on('typing', ({ chatId, user }) => {
    console.log('Received typing event', chatId, user);
    socket.to(chatId).emit('typing', { user });
  });

  socket.on('stop-typing', ({ chatId, user }) => {
    console.log('Received stop-typing event', chatId, user);
    socket.to(chatId).emit('stop-typing', { user });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

// Basic test route
app.get('/', (req, res) => {
  res.send('Chat backend is running!');
}); 