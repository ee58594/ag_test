'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();

// Rate limiters
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// In-memory task store (virtual backend)
const tasks = {};

// Language labels map
const LANGUAGES = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
  pt: 'Português',
};

/**
 * Simulate a multi-step translation pipeline.
 * Each step advances after a realistic delay.
 */
function simulateTranslation(taskId) {
  const task = tasks[taskId];
  if (!task) return;

  const steps = [
    { step: 1, label: '解析PDF文档', delay: 1200 },
    { step: 2, label: '提取文本内容', delay: 1500 },
    { step: 3, label: '调用翻译引擎', delay: 2000 },
    { step: 4, label: '重排版与生成PDF', delay: 1800 },
  ];

  let elapsed = 0;
  steps.forEach(({ step, label, delay }) => {
    elapsed += delay;
    setTimeout(() => {
      if (tasks[taskId]) {
        tasks[taskId].currentStep = step;
        tasks[taskId].currentStepLabel = label;
        tasks[taskId].progress = Math.round((step / steps.length) * 100);
      }
    }, elapsed);
  });

  // Mark as completed after all steps
  setTimeout(() => {
    if (tasks[taskId]) {
      tasks[taskId].status = 'completed';
      tasks[taskId].progress = 100;
      tasks[taskId].completedAt = new Date().toISOString();
    }
  }, elapsed + 500);
}

// POST /api/upload — accept a PDF and start translation task
app.post('/api/upload', uploadLimiter, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const { sourceLang = 'en', targetLang = 'zh' } = req.body;

  if (!LANGUAGES[sourceLang] || !LANGUAGES[targetLang]) {
    return res.status(400).json({ error: 'Unsupported language code' });
  }

  if (sourceLang === targetLang) {
    return res.status(400).json({ error: 'Source and target languages must differ' });
  }

  const taskId = uuidv4();
  tasks[taskId] = {
    taskId,
    status: 'processing',
    progress: 0,
    currentStep: 0,
    currentStepLabel: '等待处理',
    originalName: req.file.originalname,
    filePath: req.file.path,
    sourceLang,
    targetLang,
    sourceLangLabel: LANGUAGES[sourceLang],
    targetLangLabel: LANGUAGES[targetLang],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  simulateTranslation(taskId);

  res.json({ taskId, message: '翻译任务已创建' });
});

// GET /api/status/:taskId — poll task status
app.get('/api/status/:taskId', (req, res) => {
  const task = tasks[req.params.taskId];
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { filePath, ...safeTask } = task; // don't expose server path
  res.json(safeTask);
});

// GET /api/download/:taskId — download the (virtual) translated PDF
app.get('/api/download/:taskId', downloadLimiter, (req, res) => {
  const task = tasks[req.params.taskId];
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (task.status !== 'completed') {
    return res.status(400).json({ error: 'Translation not yet completed' });
  }

  // Virtual backend: return the original uploaded file as the "translated" PDF.
  // In a real system this would be the actually-translated file.
  const downloadName = `translated_${task.targetLang}_${task.originalName}`;

  if (fs.existsSync(task.filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(task.filePath);
  }

  // If the original file is gone (e.g. cleaned up), return a minimal placeholder PDF
  const placeholderPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n' +
    '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
    '4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 72 720 Td (Translated PDF) Tj ET\nendstream\nendobj\n' +
    '5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n' +
    'xref\n0 6\n0000000000 65535 f \ntrailer<</Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(placeholderPdf);
});

// GET /api/languages — list supported languages
app.get('/api/languages', (req, res) => {
  const list = Object.entries(LANGUAGES).map(([code, label]) => ({ code, label }));
  res.json(list);
});

// Catch-all: serve frontend
app.get('*', downloadLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PDF Translate server running at http://localhost:${PORT}`);
});
