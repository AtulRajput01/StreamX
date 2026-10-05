import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4003;

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Redis adapter for scaling
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter connected');
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a specific meeting room
  socket.on('join-room', (roomId: string, userDetails: any) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);
    
    // Broadcast to others in the room
    socket.to(roomId).emit('user-joined', { userId: socket.id, ...userDetails });
  });

  // Handle chat messages
  socket.on('send-message', (roomId: string, message: { sender: string, text: string }) => {
    // Send to everyone in the room EXCEPT the sender
    socket.to(roomId).emit('receive-message', message);
  });

  // WebRTC Signaling: Offer
  socket.on('webrtc-offer', (targetId: string, offer: any) => {
    socket.to(targetId).emit('webrtc-offer', { senderId: socket.id, offer });
  });

  // WebRTC Signaling: Answer
  socket.on('webrtc-answer', (targetId: string, answer: any) => {
    socket.to(targetId).emit('webrtc-answer', { senderId: socket.id, answer });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('webrtc-ice-candidate', (targetId: string, candidate: any) => {
    socket.to(targetId).emit('webrtc-ice-candidate', { senderId: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'signaling-service' });
});

server.listen(port, () => {
  console.log(`Signaling Service (WebSockets) running on http://localhost:${port}`);
});
