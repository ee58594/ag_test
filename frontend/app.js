'use strict';

const API_BASE = '/api';
const POLL_INTERVAL = 800; // ms

// DOM references
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
async function loadLanguages() {
  try {
    const res = await fetch(`${API_BASE}/languages`);
    const langs = await res.json();
    langs.forEach(({ code, label }) => {
      sourceLangSel.add(new Option(label, code));
      targetLangSel.add(new Option(label, code));
    });
    // Default: source = en, target = zh
    sourceLangSel.value = 'en';
    targetLangSel.value = 'zh';
  } catch (e) {
    showError('无法加载语言列表，请确认后端服务已启动。');
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
      const res = await fetch(`${API_BASE}/status/${taskId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const task = await res.json();
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
    downloadBtn.href = `${API_BASE}/download/${taskId}`;
    downloadBtn.download = `translated_${task.targetLang}_${task.originalName}`;
    showStep(stepDone);
  }, 400);
}

// ── Translate Again ───────────────────────────────────
translateAgain.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.hidden = true;
  translateBtn.disabled = true;
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
