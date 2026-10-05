import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import meetingRoutes from './routes/meeting.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/meetings', meetingRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'meeting-service' });
});

app.listen(port, () => {
  console.log(`Meeting service listening at http://localhost:${port}`);
});
