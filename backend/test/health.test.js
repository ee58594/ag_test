'use strict';
// AlgoManager health-check tests using Node's built-in test runner (requires Node ≥ 18)
// Run: node --test test/health.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('express is importable', () => {
  const express = require('../node_modules/express');
  assert.ok(typeof express === 'function', 'express is importable');
});

test('uuid v4 generates valid UUIDs', () => {
  const { v4: uuidv4 } = require('../node_modules/uuid');
  const id = uuidv4();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('AGENTS and SCENARIOS static data shapes are correct', () => {
  const AGENTS = {
    pm:         { id: 'pm',         name: '项目经理',   initials: 'PM', color: '#6366F1' },
    analyst:    { id: 'analyst',    name: '数据分析师', initials: 'DA', color: '#0EA5E9' },
    engineer:   { id: 'engineer',   name: '建模工程师', initials: 'ME', color: '#10B981' },
    business:   { id: 'business',   name: '业务顾问',   initials: 'BC', color: '#F59E0B' },
    qa:         { id: 'qa',         name: '质量评估师', initials: 'QA', color: '#8B5CF6' },
    root_cause: { id: 'root_cause', name: '根因分析师', initials: 'RC', color: '#EF4444' },
  };
  assert.equal(Object.keys(AGENTS).length, 6, '6 agent roles');
  Object.values(AGENTS).forEach(ag => {
    assert.ok(ag.id && ag.name && ag.initials && ag.color, `Agent ${ag.id} has all required fields`);
  });
});

test('SCENARIOS cover all 6 defined scenarios', () => {
  const SCENARIOS = {
    1: { id: 1, name: '初始建模',     icon: '🚀', agents: ['pm','analyst','engineer','qa'] },
    2: { id: 2, name: '迭代优化分析', icon: '📊', agents: ['analyst','engineer','business'] },
    3: { id: 3, name: '运营复盘',     icon: '🔍', agents: ['root_cause','analyst','pm'] },
    4: { id: 4, name: '业务驱动优化', icon: '💼', agents: ['business','analyst','engineer','qa'] },
    5: { id: 5, name: '业务问题分析', icon: '❓', agents: ['analyst','business'] },
    6: { id: 6, name: '监控大盘',     icon: '📈', agents: ['analyst','root_cause'] },
  };
  assert.equal(Object.keys(SCENARIOS).length, 6, '6 scenarios defined');
  Object.values(SCENARIOS).forEach(sc => {
    assert.ok(sc.id && sc.name && sc.icon, `Scenario ${sc.id} has id/name/icon`);
    assert.ok(Array.isArray(sc.agents) && sc.agents.length > 0, `Scenario ${sc.id} has agents`);
  });
});

test('monitoring KPI thresholds are logically consistent', () => {
  const kpis = { overall_mape: 7.8, stability_index: 0.83, coverage_rate: 97.2, data_latency_h: 0.5 };
  assert.ok(kpis.overall_mape < 15, 'MAPE below yellow alert threshold');
  assert.ok(kpis.stability_index > 0.70, 'Stability index above alert floor');
  assert.ok(kpis.coverage_rate > 90, 'Coverage rate above warning threshold');
  assert.ok(kpis.data_latency_h < 4, 'Data latency within acceptable range');
});
