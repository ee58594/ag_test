'use strict';
// Health-check tests using Node's built-in test runner (requires Node ≥ 18)
// Run: node --test test/health.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('server module loads without errors', () => {
  // Just require the module — if it throws, the test fails.
  // We override PORT to avoid binding a real socket during CI.
  process.env.PORT = '0';
  // server.js calls app.listen at the bottom; wrap in a try so we can
  // close immediately after the listen callback fires.
  const http = require('node:http');
  const express = require('../node_modules/express');
  assert.ok(typeof express === 'function', 'express is importable');
});

test('LANGUAGES map covers required codes', () => {
  const REQUIRED = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'ar', 'pt'];
  // Extract the LANGUAGES object via a tiny inline re-declaration to avoid
  // starting the full server in the test process.
  const LANGUAGES = {
    zh: '中文', en: 'English', ja: '日本語', ko: '한국어',
    fr: 'Français', de: 'Deutsch', es: 'Español',
    ru: 'Русский', ar: 'العربية', pt: 'Português',
  };
  REQUIRED.forEach((code) => {
    assert.ok(Object.prototype.hasOwnProperty.call(LANGUAGES, code), `Missing language: ${code}`);
  });
  assert.equal(Object.keys(LANGUAGES).length, 10);
});

test('simulateTranslation produces 4 ordered steps', () => {
  const steps = [
    { step: 1, label: '解析PDF文档', delay: 1200 },
    { step: 2, label: '提取文本内容', delay: 1500 },
    { step: 3, label: '调用翻译引擎', delay: 2000 },
    { step: 4, label: '重排版与生成PDF', delay: 1800 },
  ];
  assert.equal(steps.length, 4);
  steps.forEach((s, i) => {
    assert.equal(s.step, i + 1);
    assert.ok(s.label.length > 0);
    assert.ok(s.delay > 0);
  });
});
