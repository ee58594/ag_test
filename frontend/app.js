'use strict';

// ─────────────────────────────────────────────────────────────
// Configuration & State
// ─────────────────────────────────────────────────────────────

const API = '';  // same origin

const state = {
  view: 'dashboard',
  scenario: null,
  projects: [],
  meta: null,
  currentProjectId: null,
  agentSession: null,
  chartInstances: {},
};

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  });
  children.forEach(c => {
    if (typeof c === 'string') e.insertAdjacentHTML('beforeend', c);
    else if (c) e.appendChild(c);
  });
  return e;
};

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const fmt = {
  date: iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  pct: v => v != null ? `${v}%` : '—',
  metric: (v, unit = '') => v != null ? `${v}${unit}` : '—',
};

// ─────────────────────────────────────────────────────────────
// Markdown rendering — marked + highlight.js + DOMPurify
// ─────────────────────────────────────────────────────────────

function initMarked() {
  if (!window.marked) return;

  const renderer = new marked.Renderer();

  // Syntax-highlighted code blocks via highlight.js
  renderer.code = ({ text, lang }) => {
    const language = lang && window.hljs?.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = window.hljs
      ? window.hljs.highlight(text, { language, ignoreIllegals: true }).value
      : text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  marked.use({
    renderer,
    gfm: true,
    breaks: true,
    async: false,
  });
}

function md(text) {
  if (!text) return '';
  if (window.marked) {
    const raw = marked.parse(text);
    return window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
  }
  // Minimal fallback if CDN failed
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br/>');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────
// ECharts helpers
// ─────────────────────────────────────────────────────────────

const ECHARTS_THEME = {
  color: ['#6366F1','#0EA5E9','#10B981','#F59E0B','#8B5CF6','#EF4444'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif', fontSize: 12 },
  title: { textStyle: { fontSize: 13, fontWeight: 600 } },
  legend: { textStyle: { fontSize: 11 } },
  categoryAxis: { axisLine: { lineStyle: { color: '#E5E7EB' } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: '#6B7280' } },
  valueAxis:    { axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#F3F4F6' } }, axisLabel: { color: '#6B7280' } },
  tooltip: { backgroundColor: '#1F2937', borderColor: '#374151', textStyle: { color: '#F9FAFB', fontSize: 12 } },
};

function getChart(domId) {
  const dom = $(domId);
  if (!dom || !window.echarts) return null;
  const existing = echarts.getInstanceByDom(dom);
  if (existing) return existing;
  const chart = echarts.init(dom, null, { renderer: 'svg' });
  state.chartInstances[domId] = chart;
  return chart;
}

function destroyChart(key) {
  const dom = $(key);
  if (dom && window.echarts) {
    const inst = echarts.getInstanceByDom(dom);
    if (inst) inst.dispose();
  }
  delete state.chartInstances[key];
}

function scenarioColor(scId) {
  const colors = {1:'#6366F1',2:'#0EA5E9',3:'#EF4444',4:'#F59E0B',5:'#8B5CF6',6:'#10B981'};
  return colors[scId] || '#6366F1';
}

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = $(`view-${name}`);
  if (target) target.classList.remove('hidden');

  const titles = {
    dashboard:        '总览大盘',
    projects:         '项目列表',
    iterations:       '迭代历史',
    scenario:         state.meta?.scenarios?.[state.scenario]?.name || 'Agent 场景',
    'project-detail': '项目详情',
    'iteration-detail': '迭代详情',
    monitoring:       '监控大盘',
  };
  $('topbarTitle').textContent = titles[name] || name;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`[data-view="${name}"]`);
  if (active) active.classList.add('active');

  state.view = name;
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  const data = await api('/api/dashboard');

  // Stat grid
  const statData = [
    { label: '活跃项目', value: data.active_projects, sub: `共 ${data.total_projects} 个`, accent: '#6366F1' },
    { label: '迭代总次数', value: data.total_iterations, sub: '全部项目', accent: '#0EA5E9' },
    { label: '初始建模', value: data.scenario_counts[1] || 0, sub: '场景1', accent: '#10B981' },
    { label: '优化/复盘/业务', value: (data.scenario_counts[2]||0)+(data.scenario_counts[3]||0)+(data.scenario_counts[4]||0), sub: '场景2/3/4', accent: '#F59E0B' },
    { label: '问题分析', value: data.scenario_counts[5] || 0, sub: '场景5', accent: '#8B5CF6' },
    { label: '监控大盘', value: data.scenario_counts[6] || 0, sub: '场景6', accent: '#EF4444' },
  ];
  const grid = $('statGrid');
  grid.innerHTML = '';
  statData.forEach(s => {
    const card = el('div', { className: 'stat-card' });
    card.style.setProperty('--accent-color', s.accent);
    card.innerHTML = `
      <span class="stat-label">${s.label}</span>
      <span class="stat-value">${s.value}</span>
      <span class="stat-sub">${s.sub}</span>`;
    grid.appendChild(card);
  });

  // Scenario bar chart (ECharts)
  destroyChart('scenarioChart');
  const scenarioChartEl = $('scenarioChart');
  if (window.echarts && scenarioChartEl) {
    const scenarios = state.meta?.scenarios || {};
    const labels = Object.values(scenarios).map(s => `${s.icon} ${s.name}`);
    const vals   = Object.keys(scenarios).map(k => data.scenario_counts[k] || 0);
    const colors = Object.keys(scenarios).map(k => scenarioColor(Number(k)));
    const chart = echarts.init(scenarioChartEl, null, { renderer: 'svg' });
    state.chartInstances['scenarioChart'] = chart;
    chart.setOption({
      ...ECHARTS_THEME,
      grid: { top: 16, right: 16, bottom: 50, left: 40 },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { rotate: 18, fontSize: 11, color: '#6B7280' },
        axisLine: { lineStyle: { color: '#E5E7EB' } }, axisTick: { show: false },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#6B7280' },
      },
      tooltip: { trigger: 'axis', ...ECHARTS_THEME.tooltip },
      series: [{
        type: 'bar',
        data: vals.map((v, i) => ({
          value: v,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: colors[i] }, { offset: 1, color: colors[i] + '88' }] },
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 48,
        label: { show: true, position: 'top', fontSize: 11, color: '#374151' },
      }],
    });
  } else if (scenarioChartEl) {
    scenarioChartEl.parentElement.innerHTML =
      '<p style="color:var(--text-muted);font-size:12px;padding:20px">ECharts 未加载</p>';
  }

  // Recent iterations
  const listEl = $('recentIterList');
  listEl.innerHTML = '';
  if (!data.recent_iterations.length) {
    listEl.innerHTML = '<p class="text-muted text-sm" style="padding:8px 0">暂无迭代记录</p>';
    return;
  }
  data.recent_iterations.forEach(it => {
    const scen = state.meta?.scenarios?.[it.scenario];
    const item = el('div', {
      className: 'recent-iter-item',
      onClick: () => loadIterationDetail(it.id),
    });
    item.innerHTML = `
      <div class="recent-iter-project">${it.project_name || '未知项目'}</div>
      <div class="recent-iter-name">
        <span>${scen?.icon || '📌'}</span>
        <span>${it.version}</span>
        <span class="truncate">${it.description}</span>
      </div>
      <div class="recent-iter-meta">${scen?.name || ''} · ${fmt.date(it.created_at)}</div>`;
    listEl.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

async function loadProjects() {
  const projects = await api('/api/projects');
  state.projects = projects;

  // Update sidebar picker + filter selects
  syncProjectPickers(projects);

  const grid = $('projectGrid');
  grid.innerHTML = '';

  if (!projects.length) {
    grid.appendChild(el('div', { className: 'empty-state' },
      '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#EEF2FF"/><path d="M24 14v20M14 24h20" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round"/></svg>',
      '<p>暂无项目，点击右上角"新建项目"开始</p>'
    ));
    return;
  }

  projects.forEach(p => {
    const card = el('div', { className: 'project-card', onClick: () => loadProjectDetail(p.id) });
    const typeLabels = { timeseries:'时序预测', classification:'分类预测', regression:'回归预测', optimization:'策略优化', anomaly:'异常检测' };
    const improvCls = p.improvement && p.improvement.startsWith('-') ? 'negative' : 'positive';

    card.innerHTML = `
      <div class="project-card-header">
        <div>
          <div class="project-name">${p.name}</div>
          <div class="text-muted text-sm" style="margin-top:2px">${typeLabels[p.type] || p.type}</div>
        </div>
        <span class="status-badge ${p.status}">${p.status === 'active' ? '运行中' : p.status === 'paused' ? '暂停' : '归档'}</span>
      </div>
      <p class="project-desc">${p.description || '暂无描述'}</p>
      <div class="project-tags">${(p.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      ${p.best_metrics ? `
      <div class="project-metrics">
        <div class="metrics-row">
          <span class="metrics-label">当前最优 ${p.best_metrics.label || ''}</span>
          <span class="metrics-value">${p.best_metrics.mape != null ? fmt.pct(p.best_metrics.mape) : (p.best_metrics.auc != null ? p.best_metrics.auc : (p.best_metrics.revenue_lift != null ? fmt.pct(p.best_metrics.revenue_lift) : '—'))}</span>
        </div>
        ${p.improvement ? `
        <div class="metrics-row">
          <span class="metrics-label">较基线改善</span>
          <span class="metrics-improvement ${improvCls}">${p.improvement}</span>
        </div>` : ''}
      </div>` : ''}
      <div class="project-footer">
        <span class="project-version">${p.current_version}</span>
        <span class="iter-count-badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 1 0 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6 2L4 4l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${p.iteration_count} 次迭代
        </span>
        <button class="btn-delete-project" data-id="${p.id}" title="删除项目" onclick="event.stopPropagation();deleteProject('${p.id}')">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.5 8.5h5L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
    grid.appendChild(card);
  });
}

function syncProjectPickers(projects) {
  const opts = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const sidebar = $('sidebarProjectPicker');
  sidebar.innerHTML = opts || '<option value="">暂无项目</option>';
  if (state.currentProjectId) sidebar.value = state.currentProjectId;

  const filterSel = $('filterProject');
  filterSel.innerHTML = '<option value="">全部项目</option>' + opts;

  const agentPicker = $('agentProjectPicker');
  agentPicker.innerHTML = opts || '<option value="">暂无项目</option>';
  if (state.currentProjectId) agentPicker.value = state.currentProjectId;
}

// ─────────────────────────────────────────────────────────────
// Iterations
// ─────────────────────────────────────────────────────────────

async function loadIterations(filterProjectId = '', filterScenario = '') {
  let url = '/api/projects';
  const allProjects = state.projects.length ? state.projects : await api(url);
  state.projects = allProjects;

  const allIter = [];
  for (const p of allProjects) {
    if (filterProjectId && p.id !== filterProjectId) continue;
    const iters = await api(`/api/projects/${p.id}/iterations`);
    iters.forEach(it => { it._project = p; allIter.push(it); });
  }

  const filtered = filterScenario
    ? allIter.filter(it => String(it.scenario) === filterScenario)
    : allIter;

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const container = $('iterationsTable');
  container.innerHTML = '';

  if (!filtered.length) {
    container.appendChild(el('div', { className: 'empty-state' },
      '<p>暂无符合条件的迭代记录</p>'
    ));
    return;
  }

  const timeline = el('div', { className: 'iter-timeline' });

  filtered.forEach(it => {
    const scen = state.meta?.scenarios?.[it.scenario];
    const agents = state.meta?.agents || {};
    const card = el('div', { className: 'iter-card', onClick: () => loadIterationDetail(it.id) });

    const mainMetric = it.metrics?.mape != null
      ? `MAPE ${fmt.pct(it.metrics.mape)}`
      : it.metrics?.auc != null
        ? `AUC ${it.metrics.auc}`
        : it.metrics?.revenue_lift != null
          ? `RevLift ${fmt.pct(it.metrics.revenue_lift)}`
          : (it.metrics?.model || '—');

    card.innerHTML = `
      <div class="iter-card-icon">${scen?.icon || '📌'}</div>
      <div class="iter-card-body">
        <div class="iter-card-title">
          <span>${it._project?.name || ''}</span>
          <span class="iter-version">${it.version}</span>
          <span style="color:var(--text-secondary);font-weight:400">${scen?.name || ''}</span>
        </div>
        <div class="iter-card-desc">${it.description}</div>
        <div class="iter-agents">
          ${(it.agents||[]).map(a => {
            const ag = agents[a]; if(!ag) return '';
            return `<span class="agent-chip" style="background:${ag.color}">${ag.initials}</span>`;
          }).join('')}
        </div>
      </div>
      <div class="iter-card-metrics">
        <div class="metric-badge">${mainMetric}</div>
        <div class="iter-date">${fmt.date(it.created_at)}</div>
      </div>`;
    timeline.appendChild(card);
  });

  container.appendChild(timeline);
}

// ─────────────────────────────────────────────────────────────
// Project Detail
// ─────────────────────────────────────────────────────────────

async function loadProjectDetail(projectId) {
  state.currentProjectId = projectId;
  showView('project-detail');

  const [p, iters] = await Promise.all([
    api(`/api/projects/${projectId}`),
    api(`/api/projects/${projectId}/iterations`),
  ]);

  const container = $('projectDetailContent');
  container.innerHTML = '';

  // Hero
  const hero = el('div', { className: 'detail-hero' });
  hero.innerHTML = `
    <div class="detail-hero-info">
      <h2>${p.name}</h2>
      <p>${p.description || '暂无描述'}</p>
      <div class="project-tags" style="margin-top:10px">${(p.tags||[]).map(t=>`<span class="tag" style="background:rgba(255,255,255,.2);color:#fff">${t}</span>`).join('')}</div>
    </div>
    <div class="detail-hero-stats">
      <div class="hero-stat">
        <div class="hero-stat-value">${p.iteration_count}</div>
        <div class="hero-stat-label">迭代次数</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">${p.current_version}</div>
        <div class="hero-stat-label">当前版本</div>
      </div>
      ${p.improvement ? `
      <div class="hero-stat">
        <div class="hero-stat-value">${p.improvement}</div>
        <div class="hero-stat-label">较基线改善</div>
      </div>` : ''}
    </div>`;
  container.appendChild(hero);

  // Metrics chart + iteration list
  const panels = el('div', { className: 'detail-panels' });

  // Chart panel
  const chartPanelId = `metricsChart_${projectId}`;
  const chartPanel = el('div', { className: 'panel' });
  chartPanel.innerHTML = `
    <div class="panel-header"><span class="panel-title">指标迭代趋势</span></div>
    <div class="panel-body"><div id="${chartPanelId}" style="height:240px;width:100%"></div></div>`;
  panels.appendChild(chartPanel);

  // Iter history panel
  const histPanel = el('div', { className: 'panel' });
  histPanel.innerHTML = `<div class="panel-header"><span class="panel-title">迭代历史</span></div>`;
  const histBody = el('div', { className: 'panel-body detail-iter-history' });

  iters.forEach(it => {
    const scen = state.meta?.scenarios?.[it.scenario];
    const row = el('div', { className: 'iter-history-item', onClick: () => loadIterationDetail(it.id) });

    const mainMetric = it.metrics?.mape != null
      ? `MAPE ${fmt.pct(it.metrics.mape)}`
      : it.metrics?.auc != null ? `AUC ${it.metrics.auc}`
      : it.metrics?.revenue_lift != null ? `↑${it.metrics.revenue_lift}%`
      : '—';

    row.innerHTML = `
      <span class="iter-hist-version">${it.version}</span>
      <div class="iter-hist-info">
        <div class="iter-hist-name">${scen?.icon || ''} ${scen?.name || '迭代'}</div>
        <div class="iter-hist-date">${fmt.date(it.created_at)}</div>
      </div>
      <span class="iter-hist-mape">${mainMetric}</span>`;
    histBody.appendChild(row);
  });

  histPanel.appendChild(histBody);
  panels.appendChild(histPanel);
  container.appendChild(panels);

  // Draw chart after DOM is ready
  setTimeout(() => drawMetricsChart(chartPanelId, iters), 50);

  // Quick-start scenario buttons
  const quickStart = el('div', { className: 'panel' });
  quickStart.innerHTML = `<div class="panel-header"><span class="panel-title">快速启动 Agent 场景</span></div>`;
  const qBody = el('div', { className: 'panel-body', style: 'display:flex;flex-wrap:wrap;gap:10px' });
  Object.values(state.meta?.scenarios || {}).forEach(sc => {
    const btn = el('button', {
      className: 'btn-outline btn-sm',
      onClick: () => {
        state.currentProjectId = projectId;
        loadScenarioView(sc.id);
      },
    });
    btn.textContent = `${sc.icon} ${sc.name}`;
    qBody.appendChild(btn);
  });
  quickStart.appendChild(qBody);
  container.appendChild(quickStart);
}

function drawMetricsChart(domId, iters) {
  destroyChart(domId);
  if (!window.echarts) return;
  const dom = $(domId);
  if (!dom) return;

  const completed = iters.filter(it => it.status === 'completed' && it.metrics);
  if (!completed.length) return;

  const labels = completed.map(it => `${it.version} ${state.meta?.scenarios?.[it.scenario]?.icon||''}`);

  const hasMape    = completed.some(it => it.metrics.mape != null);
  const hasAuc     = completed.some(it => it.metrics.auc != null);
  const hasRevLift = completed.some(it => it.metrics.revenue_lift != null);

  const series = [];
  if (hasMape) series.push({
    name: 'MAPE (%)', type: 'line',
    data: completed.map(it => it.metrics.mape ?? null),
    smooth: true, symbol: 'circle', symbolSize: 7,
    lineStyle: { color: '#EF4444', width: 2.5 },
    itemStyle: { color: '#EF4444' },
    areaStyle: { color: { type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'#EF444430'},{offset:1,color:'#EF444405'}] } },
  });
  if (hasAuc) series.push({
    name: 'AUC', type: 'line',
    data: completed.map(it => it.metrics.auc ?? null),
    smooth: true, symbol: 'circle', symbolSize: 7,
    lineStyle: { color: '#6366F1', width: 2.5 },
    itemStyle: { color: '#6366F1' },
    areaStyle: { color: { type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'#6366F130'},{offset:1,color:'#6366F105'}] } },
  });
  if (hasRevLift) series.push({
    name: '收入提升%', type: 'line',
    data: completed.map(it => it.metrics.revenue_lift ?? null),
    smooth: true, symbol: 'circle', symbolSize: 7,
    lineStyle: { color: '#10B981', width: 2.5 },
    itemStyle: { color: '#10B981' },
    areaStyle: { color: { type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'#10B98130'},{offset:1,color:'#10B98105'}] } },
  });

  if (!series.length) return;

  const chart = echarts.init(dom, null, { renderer: 'svg' });
  state.chartInstances[domId] = chart;
  chart.setOption({
    ...ECHARTS_THEME,
    grid: { top: 30, right: 20, bottom: 40, left: 48 },
    tooltip: { trigger: 'axis', ...ECHARTS_THEME.tooltip },
    legend: { top: 4, right: 8, textStyle: { fontSize: 11, color: '#6B7280' } },
    xAxis: {
      type: 'category', data: labels,
      boundaryGap: false,
      axisLabel: { fontSize: 10, color: '#6B7280' },
      axisLine: { lineStyle: { color: '#E5E7EB' } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#6B7280', fontSize: 11 },
    },
    series,
  });
}

// ─────────────────────────────────────────────────────────────
// Iteration Detail
// ─────────────────────────────────────────────────────────────

async function loadIterationDetail(iterId) {
  showView('iteration-detail');
  const it = await api(`/api/iterations/${iterId}`);
  const proj = state.projects.find(p => p.id === it.project_id) ||
               await api(`/api/projects/${it.project_id}`).catch(() => ({}));
  const scen = state.meta?.scenarios?.[it.scenario];
  const agents = state.meta?.agents || {};

  const container = $('iterationDetailContent');
  container.innerHTML = '';

  // Header
  const header = el('div', { className: 'iter-detail-header' });
  header.innerHTML = `
    <div class="iter-detail-icon">${scen?.icon || '📌'}</div>
    <div class="iter-detail-meta">
      <h2>${proj.name || ''} · ${it.version} · ${scen?.name || ''}</h2>
      <p>${it.description}</p>
      <div class="iter-agents" style="margin-top:8px">
        ${(it.agents||[]).map(a => {
          const ag = agents[a]; if(!ag) return '';
          return `<span class="agent-chip" style="background:${ag.color}">${ag.initials} ${ag.name}</span>`;
        }).join('')}
      </div>
    </div>`;
  container.appendChild(header);

  // Two-column grid
  const grid = el('div', { className: 'iter-detail-grid' });

  // Metrics panel
  const metricsPanel = el('div', { className: 'panel' });
  metricsPanel.innerHTML = `<div class="panel-header"><span class="panel-title">评估指标</span></div>`;
  const mBody = el('div', { className: 'panel-body' });

  const metricsRows = Object.entries(it.metrics || {})
    .filter(([k]) => k !== 'model')
    .map(([k, v]) => {
      const delta = it.vs_prev?.[k];
      const isLower = ['mae','rmse','mape'].includes(k);
      let deltaHtml = '';
      if (delta != null) {
        const sign = delta > 0 ? '+' : '';
        const cls  = (isLower ? delta < 0 : delta > 0) ? 'delta-positive' : 'delta-negative';
        deltaHtml = `<span class="${cls}">${sign}${typeof delta === 'number' ? delta.toFixed(1) : delta}${typeof delta === 'number' && Math.abs(delta) < 1 ? '' : (k==='mape'||k==='revenue_lift'?'%':'')}</span>`;
      }
      return `<tr><td>${k.toUpperCase()}</td><td><strong>${v}</strong></td><td>${deltaHtml}</td></tr>`;
    }).join('');

  mBody.innerHTML = `
    <table class="iter-metrics-table">
      <thead><tr><th>指标</th><th>值</th><th>较上版本</th></tr></thead>
      <tbody>${metricsRows}</tbody>
    </table>
    ${it.metrics?.model ? `<p style="font-size:11px;color:var(--text-muted);margin-top:8px">模型: ${it.metrics.model}</p>` : ''}
    ${it.backtest_period ? `<p style="font-size:11px;color:var(--text-muted)">回测期: ${it.backtest_period}</p>` : ''}`;
  metricsPanel.appendChild(mBody);
  grid.appendChild(metricsPanel);

  // Highlights panel
  const hlPanel = el('div', { className: 'panel' });
  hlPanel.innerHTML = `<div class="panel-header"><span class="panel-title">本次亮点</span></div>`;
  const hlBody = el('div', { className: 'panel-body' });
  if (it.highlights?.length) {
    const ul = el('ul', { className: 'highlights-list' });
    it.highlights.forEach(h => {
      const li = el('li'); li.textContent = h;
      ul.appendChild(li);
    });
    hlBody.appendChild(ul);
  }
  if (it.conclusion) {
    const concl = el('div', { style: 'margin-top:12px;padding:10px 12px;background:var(--indigo-50);border-radius:8px;border-left:3px solid var(--indigo-500)' });
    concl.innerHTML = `<p style="font-size:12px;font-weight:600;color:var(--indigo-700);margin-bottom:4px">结论</p>
                       <p style="font-size:12px;color:var(--text-secondary)">${it.conclusion}</p>`;
    hlBody.appendChild(concl);
  }
  hlPanel.appendChild(hlBody);
  grid.appendChild(hlPanel);

  container.appendChild(grid);

  // Code preview
  if (it.code_preview && it.code_preview !== '# 参见Agent输出日志') {
    const codePanel = el('div', { className: 'panel' });
    codePanel.innerHTML = `<div class="panel-header"><span class="panel-title">关键代码片段</span></div>`;
    const cBody = el('div', { className: 'panel-body' });
    cBody.innerHTML = `<pre class="code-block">${escHtml(it.code_preview)}</pre>`;
    codePanel.appendChild(cBody);
    container.appendChild(codePanel);
  }
}

// ─────────────────────────────────────────────────────────────
// Scenario / Agent Run
// ─────────────────────────────────────────────────────────────

function loadScenarioView(scenarioId) {
  state.scenario = scenarioId;
  const scen = state.meta?.scenarios?.[scenarioId];
  if (!scen) return;

  // Scenario 6 gets special monitoring view
  if (scenarioId === 6) {
    loadMonitoringView();
    return;
  }

  showView('scenario');

  $('scenarioHeroIcon').textContent  = scen.icon;
  $('scenarioHeroName').textContent  = scen.name;
  $('scenarioHeroDesc').textContent  = scen.desc;
  $('topbarTitle').textContent       = scen.name;

  // Agent roster
  const agents = state.meta?.agents || {};
  const roster = $('agentRoster');
  roster.innerHTML = '<div class="agent-roster-label">参与 Agent</div>';
  scen.agents.forEach(aId => {
    const ag = agents[aId]; if (!ag) return;
    const row = el('div', { className: 'agent-row' });
    row.innerHTML = `
      <div class="agent-avatar" style="background:${ag.color}">${ag.initials}</div>
      <span class="agent-name">${ag.name}</span>
      <span class="agent-role-tag">${aId}</span>`;
    roster.appendChild(row);
  });

  // Populate project picker
  const picker = $('agentProjectPicker');
  picker.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (state.currentProjectId) picker.value = state.currentProjectId;

  // Reset stream panel
  $('streamPlaceholder').classList.remove('hidden');
  $('streamMessages').classList.add('hidden');
  $('streamMessages').innerHTML = '';
  $('streamDone').classList.add('hidden');

  const btn = $('btnRunAgent');
  btn.disabled = !picker.value;
  picker.addEventListener('change', () => { btn.disabled = !picker.value; });
  btn.onclick = () => startAgentStream(scenarioId, picker.value);
}

async function startAgentStream(scenarioId, projectId) {
  if (!projectId) return;

  const btn = $('btnRunAgent');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> 运行中…';

  $('streamPlaceholder').classList.add('hidden');
  $('streamMessages').classList.remove('hidden');
  $('streamMessages').innerHTML = '';
  $('streamDone').classList.add('hidden');

  const { sessionId } = await api('/api/agent/start', {
    method: 'POST',
    body: { project_id: projectId, scenario: scenarioId },
  });

  const msgMap = {};  // agentId → { bubble, bodyEl }

  const es = new EventSource(`${API}/api/agent/stream/${sessionId}`);

  es.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === 'agent_start') {
      const ag = data.agent;
      const bubble = el('div', { className: 'message-bubble' });
      bubble.innerHTML = `
        <div class="message-avatar" style="background:${ag.color}">${ag.initials}</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-agent-name" style="color:${ag.color}">${ag.name}</span>
            <span class="message-time">${new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          </div>
          <div class="message-body" style="border-color:${ag.color}">
            <span class="typing-cursor"></span>
          </div>
        </div>`;
      $('streamMessages').appendChild(bubble);
      bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
      msgMap[ag.id] = { bubble, bodyEl: bubble.querySelector('.message-body') };
    }

    if (data.type === 'token') {
      const entry = msgMap[data.agent.id];
      if (entry) {
        entry.bodyEl.innerHTML = md(data.full) + '<span class="typing-cursor"></span>';
        entry.bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }

    if (data.type === 'agent_end') {
      const entry = msgMap[data.agent.id];
      if (entry) {
        entry.bodyEl.innerHTML = md(data.content);
        delete msgMap[data.agent.id];
      }
    }

    if (data.type === 'complete') {
      es.close();
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg> 再次运行';

      $('streamDone').classList.remove('hidden');
      $('streamDoneNote').textContent = `迭代记录已生成 (ID: ${data.iteration_id})，可在"迭代历史"中查看`;
      $('btnViewNewIter').onclick = () => loadIterationDetail(data.iteration_id);

      // Refresh project list in background
      loadProjects().catch(() => {});
    }
  };

  es.onerror = () => {
    es.close();
    btn.disabled = false;
    btn.textContent = '启动 Agent 分析';
    const errMsg = el('div', { style: 'padding:12px;color:var(--red-500);font-size:13px' });
    errMsg.textContent = '连接中断，请检查网络后重试';
    $('streamMessages').appendChild(errMsg);
  };
}

// ─────────────────────────────────────────────────────────────
// Monitoring View (Scenario 6)
// ─────────────────────────────────────────────────────────────

async function loadMonitoringView() {
  showView('monitoring');
  $('topbarTitle').textContent = '监控大盘';

  const projectId = state.currentProjectId || state.projects[0]?.id;
  if (!projectId) {
    $('monitoringContent').innerHTML = '<div class="empty-state"><p>请先选择或创建项目</p></div>';
    return;
  }

  const data = await api(`/api/monitoring/${projectId}`);
  const container = $('monitoringContent');
  container.innerHTML = '';

  // KPI cards
  const kpiDefs = [
    { key: 'overall_mape',     label: '整体MAPE',   unit: '%', color: '#EF4444', statusFn: v => v<10?'good':v<15?'warning':'alert' },
    { key: 'stability_index',  label: '稳定性指数', unit: '',  color: '#6366F1', statusFn: v => v>0.8?'good':v>0.7?'warning':'alert' },
    { key: 'coverage_rate',    label: '覆盖率',     unit: '%', color: '#10B981', statusFn: v => v>95?'good':v>90?'warning':'alert' },
    { key: 'data_latency_h',   label: '数据延迟(h)',unit: 'h', color: '#0EA5E9', statusFn: v => v<2?'good':v<4?'warning':'alert' },
    { key: 'alert_count',      label: '告警数',     unit: '',  color: '#F43F5E', statusFn: v => v===0?'good':v<3?'warning':'alert' },
    { key: 'warning_count',    label: '预警数',     unit: '',  color: '#F59E0B', statusFn: v => v===0?'good':v<5?'warning':'alert' },
  ];

  const kpiGrid = el('div', { className: 'monitoring-grid' });
  kpiDefs.forEach(def => {
    const v = data.kpis[def.key];
    const status = def.statusFn(v);
    const statusLabel = { good: '正常', warning: '预警', alert: '告警' };
    const kpiCard = el('div', { className: 'kpi-card' });
    kpiCard.style.setProperty('--kpi-color', def.color);
    kpiCard.innerHTML = `
      <div class="kpi-label">${def.label}</div>
      <div class="kpi-value">${v}${def.unit}</div>
      <div class="kpi-status ${status}">
        <span>●</span><span>${statusLabel[status]}</span>
      </div>`;
    kpiGrid.appendChild(kpiCard);
  });
  container.appendChild(kpiGrid);

  // MAPE trend chart + category table
  const row = el('div', { className: 'monitoring-row' });

  const trendPanel = el('div', { className: 'panel flex-2' });
  trendPanel.innerHTML = `<div class="panel-header"><span class="panel-title">30天MAPE趋势</span></div>
                          <div class="panel-body"><div id="mapeChart" style="height:230px;width:100%"></div></div>`;
  row.appendChild(trendPanel);

  const alertPanel = el('div', { className: 'panel' });
  alertPanel.innerHTML = `<div class="panel-header"><span class="panel-title">告警汇总</span></div>`;
  const alertBody = el('div', { className: 'panel-body' });
  const alertItems = data.categories.filter(c => c.status !== 'normal');
  if (alertItems.length) {
    alertItems.forEach(c => {
      const d = el('div', { style: 'padding:8px;background:var(--gray-50);border-radius:6px;margin-bottom:6px' });
      d.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:12px;font-weight:600">${c.name}</span>
          <span class="status-badge ${c.status === 'alert' ? 'active' : 'paused'}" style="font-size:10px">${c.status === 'alert' ? '🔴 告警' : '🟡 预警'}</span>
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">MAPE: <strong>${c.mape}%</strong> · SKU数: ${c.sku_count}</div>`;
      alertBody.appendChild(d);
    });
  } else {
    alertBody.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">暂无异常告警</p>';
  }
  alertPanel.appendChild(alertBody);
  row.appendChild(alertPanel);

  container.appendChild(row);

  // Category table
  const catPanel = el('div', { className: 'panel' });
  catPanel.innerHTML = `<div class="panel-header"><span class="panel-title">品类精度明细</span></div>`;
  const catBody = el('div', { className: 'panel-body' });
  let catHtml = `<table class="category-table">
    <thead><tr><th>品类</th><th>状态</th><th>MAPE</th><th>误差分布</th><th>SKU数</th></tr></thead>
    <tbody>`;
  data.categories.forEach(c => {
    const barColor = c.status === 'alert' ? '#EF4444' : c.status === 'warning' ? '#F59E0B' : '#10B981';
    const barWidth = Math.min(c.mape * 3, 100);
    catHtml += `
      <tr>
        <td style="font-weight:600">${c.name}</td>
        <td><span class="status-dot ${c.status}"></span>${c.status === 'normal' ? '正常' : c.status === 'warning' ? '预警' : '告警'}</td>
        <td style="font-weight:700;color:${barColor}">${c.mape}%</td>
        <td>
          <div class="mape-bar-wrap"><div class="mape-bar" style="width:${barWidth}%;background:${barColor}"></div></div>
        </td>
        <td>${c.sku_count.toLocaleString()}</td>
      </tr>`;
  });
  catHtml += '</tbody></table>';
  catBody.innerHTML = catHtml;
  catPanel.appendChild(catBody);
  container.appendChild(catPanel);

  // Draw MAPE trend chart (ECharts)
  setTimeout(() => {
    destroyChart('mapeChart');
    if (!window.echarts) return;
    const dom = $('mapeChart');
    if (!dom) return;
    const chart = echarts.init(dom, null, { renderer: 'svg' });
    state.chartInstances['mapeChart'] = chart;
    chart.setOption({
      ...ECHARTS_THEME,
      grid: { top: 16, right: 20, bottom: 40, left: 48 },
      tooltip: {
        trigger: 'axis', ...ECHARTS_THEME.tooltip,
        formatter: params => `${params[0].axisValue}<br/>MAPE: <b>${params[0].value}%</b>`,
      },
      xAxis: {
        type: 'category',
        data: data.trend.map(t => t.date.slice(5)),
        boundaryGap: false,
        axisLabel: { fontSize: 10, color: '#6B7280', interval: 4 },
        axisLine: { lineStyle: { color: '#E5E7EB' } }, axisTick: { show: false },
      },
      yAxis: {
        type: 'value', name: 'MAPE %',
        nameTextStyle: { fontSize: 11, color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: { color: '#6B7280', fontSize: 11 },
      },
      visualMap: {
        show: false, type: 'continuous',
        min: 5, max: 20,
        inRange: { color: ['#10B981','#F59E0B','#EF4444'] },
        dimension: 1,
      },
      series: [{
        type: 'line', data: data.trend.map(t => t.mape),
        smooth: true, symbol: 'none',
        lineStyle: { width: 2.5, color: '#6366F1' },
        areaStyle: { color: { type:'linear',x:0,y:0,x2:0,y2:1,
          colorStops:[{offset:0,color:'#6366F140'},{offset:1,color:'#6366F105'}] } },
        markLine: {
          silent: true,
          data: [{ yAxis: 10, lineStyle: { color: '#F59E0B', type: 'dashed' } }],
          label: { formatter: '预警线 10%', fontSize: 10, color: '#F59E0B' },
        },
      }],
    });
  }, 50);

  // Start monitoring agent stream as well
  setTimeout(() => {
    if (state.projects.length) {
      startMonitoringAgentStream(projectId);
    }
  }, 500);
}

async function startMonitoringAgentStream(projectId) {
  const msgEl = el('div', { className: 'panel', style: 'margin-top:20px' });
  msgEl.innerHTML = `<div class="panel-header"><span class="panel-title">Agent 监控分析</span></div>`;
  const msgBody = el('div', { className: 'panel-body', style: 'display:flex;flex-direction:column;gap:14px' });
  msgEl.appendChild(msgBody);
  $('monitoringContent').appendChild(msgEl);

  const { sessionId } = await api('/api/agent/start', {
    method: 'POST',
    body: { project_id: projectId, scenario: 6 },
  });

  const agents = state.meta?.agents || {};
  const msgMap = {};
  const es = new EventSource(`${API}/api/agent/stream/${sessionId}`);

  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'agent_start') {
      const ag = data.agent;
      const bubble = el('div', { className: 'message-bubble' });
      bubble.innerHTML = `
        <div class="message-avatar" style="background:${ag.color}">${ag.initials}</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-agent-name" style="color:${ag.color}">${ag.name}</span>
          </div>
          <div class="message-body" style="border-color:${ag.color}"><span class="typing-cursor"></span></div>
        </div>`;
      msgBody.appendChild(bubble);
      bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
      msgMap[ag.id] = { bodyEl: bubble.querySelector('.message-body') };
    }
    if (data.type === 'token') {
      const entry = msgMap[data.agent.id];
      if (entry) entry.bodyEl.innerHTML = md(data.full) + '<span class="typing-cursor"></span>';
    }
    if (data.type === 'agent_end') {
      const entry = msgMap[data.agent.id];
      if (entry) { entry.bodyEl.innerHTML = md(data.content); delete msgMap[data.agent.id]; }
    }
    if (data.type === 'complete') es.close();
  };
  es.onerror = () => es.close();
}

// ─────────────────────────────────────────────────────────────
// New Project Modal
// ─────────────────────────────────────────────────────────────

function openNewProjectModal() {
  $('modalOverlay').classList.remove('hidden');
  $('inputProjectName').value = '';
  $('inputProjectDesc').value = '';
  $('inputProjectType').value = 'timeseries';
  $('inputProjectTags').value = '';
  $('inputProjectName').focus();
}

function closeModal() {
  $('modalOverlay').classList.add('hidden');
}

async function createProject() {
  const name = $('inputProjectName').value.trim();
  if (!name) { $('inputProjectName').focus(); return; }

  const tags = $('inputProjectTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const btn = $('btnModalCreate');
  btn.disabled = true;
  btn.textContent = '创建中…';

  try {
    await api('/api/projects', {
      method: 'POST',
      body: {
        name,
        description: $('inputProjectDesc').value.trim(),
        type: $('inputProjectType').value,
        tags,
      },
    });
    closeModal();
    await loadProjects();
    showView('projects');
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '创建项目';
  }
}

// ─────────────────────────────────────────────────────────────
// Sidebar Toggle
// ─────────────────────────────────────────────────────────────

function initSidebar() {
  const sidebar = $('sidebar');
  const toggle  = $('sidebarToggle');
  const menuBtn = $('topbarMenuBtn');

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Navigation wiring
// ─────────────────────────────────────────────────────────────

function wireNav() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      const scenario = Number(link.dataset.scenario);

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      link.classList.add('active');

      if (view === 'dashboard') {
        showView('dashboard');
        await loadDashboard();
      } else if (view === 'projects') {
        showView('projects');
        await loadProjects();
      } else if (view === 'iterations') {
        showView('iterations');
        await loadIterations();
      } else if (view === 'scenario' && scenario) {
        loadScenarioView(scenario);
      }
    });
  });

  // Sidebar project picker
  $('sidebarProjectPicker').addEventListener('change', e => {
    state.currentProjectId = e.target.value;
  });

  // Iteration filters
  const filterFn = () => loadIterations(
    $('filterProject').value,
    $('filterScenario').value
  );
  $('filterProject').addEventListener('change', filterFn);
  $('filterScenario').addEventListener('change', filterFn);

  // Back buttons
  $('btnBackToProjects').addEventListener('click', () => {
    showView('projects');
    loadProjects();
  });
  $('btnBackToIterations').addEventListener('click', () => {
    showView('iterations');
    loadIterations();
  });

  // New project button
  $('btnNewProject').addEventListener('click', openNewProjectModal);
  $('btnModalCancel').addEventListener('click', closeModal);
  $('modalClose').addEventListener('click', closeModal);
  $('btnModalCreate').addEventListener('click', createProject);
  $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });

  // Enter in modal
  $('inputProjectName').addEventListener('keydown', e => { if (e.key === 'Enter') createProject(); });
}

// ─────────────────────────────────────────────────────────────
// Project Deletion
// ─────────────────────────────────────────────────────────────

async function deleteProject(id) {
  const p = state.projects.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`确认删除项目「${p.name}」及其所有迭代记录？此操作不可撤销。`)) return;
  try {
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    await loadProjects();
  } catch (err) {
    alert(`删除失败：${err.message}`);
  }
}
window.deleteProject = deleteProject;

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

async function init() {
  initMarked();
  initSidebar();
  wireNav();

  try {
    state.meta = await api('/api/meta');
  } catch (e) {
    console.warn('Failed to load meta', e);
  }

  try {
    await loadProjects();
  } catch (e) {
    console.warn('Failed to load projects', e);
  }

  // Default: dashboard
  showView('dashboard');
  try { await loadDashboard(); } catch (e) { console.warn('Dashboard load error', e); }
}

document.addEventListener('DOMContentLoaded', init);
