import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  extractTextFromFile,
  getActiveProfile,
  reanalyzeActiveProfile,
  saveProfileFromResume,
} from '../services/profileService';
import { logger } from '../utils/logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    }
  },
});

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const profile = await getActiveProfile();
    res.json({ data: profile });
  } catch (err) {
    logger.error('GET /profile failed', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.post('/resume', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use field name "resume".' });
      return;
    }

    const text = await extractTextFromFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    if (!text.trim() || text.length < 50) {
      res.status(400).json({ error: 'Could not extract enough text from resume' });
      return;
    }

    const profile = await saveProfileFromResume(
      text,
      req.file.originalname,
      req.file.buffer,
    );

    res.json({
      message: `Resume parsed — ${profile.skills.length} skills extracted${profile.careerAnalysis ? ` · level: ${profile.careerAnalysis.careerLevel}` : ''}`,
      data: profile,
    });
  } catch (err) {
    logger.error('POST /profile/resume failed', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to process resume',
    });
  }
});

router.post('/analyze', async (_req: Request, res: Response) => {
  try {
    const profile = await reanalyzeActiveProfile();
    res.json({
      message: `Career level: ${profile.careerAnalysis?.seniorityLabel ?? profile.role}`,
      data: profile,
    });
  } catch (err) {
    logger.error('POST /profile/analyze failed', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Career analysis failed',
    });
  }
});

export default router;
