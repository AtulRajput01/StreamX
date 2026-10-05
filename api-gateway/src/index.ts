import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(morgan('dev'));

// Service endpoints
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';

// Proxy endpoints
app.use(createProxyMiddleware({
  pathFilter: '/api/auth',
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
}));

const MEETING_SERVICE_URL = process.env.MEETING_SERVICE_URL || 'http://localhost:4002';
app.use(createProxyMiddleware({
  pathFilter: '/api/meetings',
  target: MEETING_SERVICE_URL,
  changeOrigin: true,
}));

const SIGNALING_SERVICE_URL = process.env.SIGNALING_SERVICE_URL || 'http://localhost:4003';
app.use(createProxyMiddleware({
  pathFilter: '/socket.io',
  target: SIGNALING_SERVICE_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
}));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});
