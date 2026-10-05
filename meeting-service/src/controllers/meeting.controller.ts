import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const createMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { title, isPrivate, allowedEmails } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process allowed emails into an array of trimmed strings
    const emailsArray = allowedEmails 
      ? allowedEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e !== '')
      : [];

    const meeting = await prisma.meeting.create({
      data: {
        title,
        hostId: userId,
        isPrivate: isPrivate || false,
        allowedEmails: emailsArray
      }
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Error creating meeting' });
  }
};

export const listMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Return meetings that the user is allowed to see:
    // 1. User is the host
    // 2. Meeting is public
    // 3. Meeting is private AND user's email is in the allowedEmails array
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { hostId: userId },
          { isPrivate: false },
          { 
            isPrivate: true,
            allowedEmails: {
              has: userEmail
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(meetings);
  } catch (error) {
    console.error('List meetings error:', error);
    res.status(500).json({ message: 'Error fetching meetings' });
  }
};
