'use strict';

const API_BASE = '/api';
const POLL_INTERVAL = 800; // ms

// ── In-browser mock backend ───────────────────────────
// Activated automatically when the real backend is unreachable
// (e.g. when served from GitHub Pages).
let USE_MOCK = false;

const MOCK_LANGUAGES = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
];

const MOCK_LANG_MAP = Object.fromEntries(MOCK_LANGUAGES.map((l) => [l.code, l.label]));

const MOCK_STEPS = [
  { step: 1, label: '解析PDF文档',    delay: 1200 },
  { step: 2, label: '提取文本内容',   delay: 1800 },
  { step: 3, label: '调用翻译引擎',   delay: 2200 },
  { step: 4, label: '重排版与生成PDF', delay: 1600 },
];

const mockTasks = {};
let _mockObjectUrl = null; // track Blob URL for cleanup

/** Returns true when taskId belongs to an in-browser mock task. */
function isMockTask(taskId) {
  return USE_MOCK || taskId.startsWith('mock-');
}

function createMockTask(file, sourceLang, targetLang) {
  const taskId = 'mock-' + Math.random().toString(36).slice(2, 10);
  mockTasks[taskId] = {
    taskId,
    status: 'processing',
    progress: 0,
    currentStep: 0,
    currentStepLabel: '等待处理',
    originalName: file.name,
    sourceLang,
    targetLang,
    sourceLangLabel: MOCK_LANG_MAP[sourceLang] || sourceLang,
    targetLangLabel: MOCK_LANG_MAP[targetLang] || targetLang,
    createdAt: new Date().toISOString(),
    completedAt: null,
    _file: file,
  };

  let elapsed = 0;
  MOCK_STEPS.forEach(({ step, label, delay }) => {
    elapsed += delay;
    setTimeout(() => {
      const t = mockTasks[taskId];
      if (t) {
        t.currentStep = step;
        t.currentStepLabel = label;
        t.progress = Math.round((step / MOCK_STEPS.length) * 100);
      }
    }, elapsed);
  });
  setTimeout(() => {
    const t = mockTasks[taskId];
    if (t) {
      t.status = 'completed';
      t.progress = 100;
      t.completedAt = new Date().toISOString();
    }
  }, elapsed + 500);

  return taskId;
}

// ── DOM references ────────────────────────────────────
const sourceLangSel = document.getElementById('sourceLang');
const targetLangSel = document.getElementById('targetLang');
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const fileInfo      = document.getElementById('fileInfo');
const translateBtn  = document.getElementById('translateBtn');
const errorBanner   = document.getElementById('errorBanner');
const errorMsg      = document.getElementById('errorMsg');

const stepUpload    = document.getElementById('stepUpload');
const stepProgress  = document.getElementById('stepProgress');
const stepDone      = document.getElementById('stepDone');

const progressBar   = document.getElementById('progressBar');
const progressPct   = document.getElementById('progressPercent');
const progressTitle = document.getElementById('progressTitle');
const pipeline      = document.getElementById('pipeline');
const pipelineItems = pipeline.querySelectorAll('.pipeline-item');

const doneSub       = document.getElementById('doneSub');
const downloadBtn   = document.getElementById('downloadBtn');
const translateAgain = document.getElementById('translateAgain');

let selectedFile = null;
let pollTimer = null;

// ── Load languages ────────────────────────────────────
function populateLanguageSelects(langs) {
  langs.forEach(({ code, label }) => {
    sourceLangSel.add(new Option(label, code));
    targetLangSel.add(new Option(label, code));
  });
  sourceLangSel.value = 'en';
  targetLangSel.value = 'zh';
}

async function loadLanguages() {
  try {
    const res = await fetch(`${API_BASE}/languages`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const langs = await res.json();
    USE_MOCK = false;
    populateLanguageSelects(langs);
  } catch {
    // Backend not available — switch to in-browser mock mode silently
    USE_MOCK = true;
    populateLanguageSelects(MOCK_LANGUAGES);
  }
}

// ── File handling ─────────────────────────────────────
function onFileChosen(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    showError('请选择 PDF 格式的文件。');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showError('文件大小不能超过 50 MB。');
    return;
  }
  hideError();
  selectedFile = file;
  fileInfo.textContent = `已选择：${file.name}（${formatSize(file.size)}）`;
  fileInfo.hidden = false;
  translateBtn.disabled = false;
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', () => onFileChosen(fileInput.files[0]));

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  onFileChosen(e.dataTransfer.files[0]);
});

// ── Translate ─────────────────────────────────────────
translateBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const sourceLang = sourceLangSel.value;
  const targetLang = targetLangSel.value;

  if (sourceLang === targetLang) {
    showError('原文语言与目标语言不能相同。');
    return;
  }

  hideError();
  showStep(stepProgress);

  if (USE_MOCK) {
    const taskId = createMockTask(selectedFile, sourceLang, targetLang);
    startPolling(taskId);
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('sourceLang', sourceLang);
  formData.append('targetLang', targetLang);

  try {
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const { taskId } = await res.json();
    startPolling(taskId);
  } catch (e) {
    showStep(stepUpload);
    showError(`上传失败：${e.message}`);
  }
});

// ── Polling ───────────────────────────────────────────
function startPolling(taskId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      let task;
      if (isMockTask(taskId)) {
        task = mockTasks[taskId];
        if (!task) throw new Error('Task not found');
      } else {
        const res = await fetch(`${API_BASE}/status/${taskId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        task = await res.json();
      }
      updateProgress(task);

      if (task.status === 'completed') {
        clearInterval(pollTimer);
        showDone(task, taskId);
      }
    } catch (e) {
      clearInterval(pollTimer);
      showStep(stepUpload);
      showError(`查询翻译状态失败：${e.message}`);
    }
  }, POLL_INTERVAL);
}

function updateProgress(task) {
  const pct = task.progress || 0;
  progressBar.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
  progressTitle.textContent = task.currentStepLabel || '正在翻译…';

  pipelineItems.forEach((item) => {
    const step = parseInt(item.dataset.step, 10);
    const statusEl = item.querySelector('.pipeline-status');
    item.classList.remove('active', 'done');
    if (step < task.currentStep) {
      item.classList.add('done');
      statusEl.textContent = '✓ 完成';
    } else if (step === task.currentStep) {
      item.classList.add('active');
      statusEl.textContent = '进行中…';
    } else {
      statusEl.textContent = '';
    }
  });
}

function showDone(task, taskId) {
  // Mark all pipeline items done
  pipelineItems.forEach((item) => {
    item.classList.remove('active');
    item.classList.add('done');
    item.querySelector('.pipeline-status').textContent = '✓ 完成';
  });
  progressBar.style.width = '100%';
  progressPct.textContent = '100%';

  setTimeout(() => {
    doneSub.textContent =
      `已将 "${task.originalName}" 从 ${task.sourceLangLabel} 翻译为 ${task.targetLangLabel}`;

    if (isMockTask(taskId)) {
      // In mock mode, offer the original file back as the "translated" download
      if (_mockObjectUrl) URL.revokeObjectURL(_mockObjectUrl);
      const file = mockTasks[taskId]?._file;
      if (file) {
        _mockObjectUrl = URL.createObjectURL(file);
        downloadBtn.href = _mockObjectUrl;
        downloadBtn.download = `translated_${task.targetLang}_${task.originalName}`;
        downloadBtn.style.display = '';
      }
    } else {
      downloadBtn.href = `${API_BASE}/download/${taskId}`;
      downloadBtn.download = `translated_${task.targetLang}_${task.originalName}`;
    }
    showStep(stepDone);
  }, 400);
}

// ── Translate Again ───────────────────────────────────
translateAgain.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.hidden = true;
  translateBtn.disabled = true;
  if (_mockObjectUrl) {
    URL.revokeObjectURL(_mockObjectUrl);
    _mockObjectUrl = null;
  }
  resetPipeline();
  progressBar.style.width = '0%';
  progressPct.textContent = '0%';
  hideError();
  showStep(stepUpload);
});

function resetPipeline() {
  pipelineItems.forEach((item) => {
    item.classList.remove('active', 'done');
    item.querySelector('.pipeline-status').textContent = '';
  });
}

// ── Helpers ───────────────────────────────────────────
function showStep(target) {
  [stepUpload, stepProgress, stepDone].forEach((s) => {
    s.classList.toggle('hidden', s !== target);
  });
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Init ──────────────────────────────────────────────
loadLanguages();
