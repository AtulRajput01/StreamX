import { Router } from 'express';
import { createMeeting, listMeetings } from '../controllers/meeting.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protect all meeting routes with requireAuth
router.use(requireAuth);

router.post('/', createMeeting);
router.get('/', listMeetings);

export default router;
