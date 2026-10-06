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

// Setup Redis adapter for multi-instance scaling
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis adapter connected successfully');
  })
  .catch((err) => {
    console.warn('Redis adapter connection failed, running with default in-memory adapter:', err.message);
  });

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Join a specific meeting room
  socket.on('join-room', async (roomId: string, userDetails: any) => {
    if (!roomId) return;
    
    socket.join(roomId);
    (socket as any).roomId = roomId;
    (socket as any).userName = userDetails?.name || 'StreamX User';
    
    console.log(`[Room] ${socket.id} (${(socket as any).userName}) joined room: ${roomId}`);
    
    // 1. Broadcast user-joined to everyone else in the room
    socket.to(roomId).emit('user-joined', { userId: socket.id, name: (socket as any).userName });

    // 2. Send list of existing users to the joining socket
    try {
      const socketsInRoom = await io.in(roomId).fetchSockets();
      const existingUsers = socketsInRoom
        .filter(s => s.id !== socket.id)
        .map(s => ({ userId: s.id, name: (s as any).userName || 'StreamX User' }));

      socket.emit('existing-users', existingUsers);
    } catch (err) {
      console.error('Error fetching room sockets:', err);
    }
  });

  // Handle live chat messages
  socket.on('send-message', (roomId: string, message: { sender: string, text: string }) => {
    console.log(`[Chat] Room ${roomId} | ${message.sender}: ${message.text}`);
    // Broadcast to everyone else in the room
    socket.to(roomId).emit('receive-message', message);
  });

  // WebRTC Signaling: Offer (Target specific user using io.to)
  socket.on('webrtc-offer', (targetId: string, offer: any) => {
    console.log(`[WebRTC] Offer from ${socket.id} -> ${targetId}`);
    io.to(targetId).emit('webrtc-offer', { senderId: socket.id, offer });
  });

  // WebRTC Signaling: Answer (Target specific user using io.to)
  socket.on('webrtc-answer', (targetId: string, answer: any) => {
    console.log(`[WebRTC] Answer from ${socket.id} -> ${targetId}`);
    io.to(targetId).emit('webrtc-answer', { senderId: socket.id, answer });
  });

  // WebRTC Signaling: ICE Candidate (Target specific user using io.to)
  socket.on('webrtc-ice-candidate', (targetId: string, candidate: any) => {
    io.to(targetId).emit('webrtc-ice-candidate', { senderId: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId;
    console.log(`[Socket] Disconnected: ${socket.id} (room: ${roomId || 'none'})`);
    if (roomId) {
      socket.to(roomId).emit('user-left', { userId: socket.id });
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'signaling-service' });
});

server.listen(port, () => {
  console.log(`Signaling Service (WebSockets) running on http://localhost:${port}`);
});

