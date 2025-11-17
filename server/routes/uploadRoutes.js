import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import multer from 'multer';
import { storageUpload, storageList, storageGetStream, storageDelete } from '../utils/storageProvider.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// auth required
router.use(verifyToken);

// Upload a file (multipart field name: file)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'file is required' });
    const result = await storageUpload({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      subdir: 'manual'
    });
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    console.error('Upload error', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// List stored files (basic) with optional folder navigation
router.get('/', async (req, res) => {
  try {
    const { path: subdir, folderId } = req.query;
    const files = await storageList({ subdir, parentFolderId: folderId });
    res.json({ success: true, data: files });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Download by id or filename
router.get('/:id', async (req, res) => {
  try {
    const stream = await storageGetStream(req.params.id);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (e) {
    res.status(404).json({ success: false, message: 'Not found' });
  }
});

// Delete by id or filename
router.delete('/:id', async (req, res) => {
  try {
    await storageDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(404).json({ success: false, message: 'Not found' });
  }
});

export default router;
