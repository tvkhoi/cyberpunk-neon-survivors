import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../api/index.js';

describe('Vercel Serverless & Deployment Readiness Tests', () => {

  it('1. Vercel Configuration: vercel.json is valid JSON with proper rewrites/routes', () => {
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist in project root');
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(parsed.version === 2, 'vercel.json must use version 2');
    assert.ok(Array.isArray(parsed.rewrites) || Array.isArray(parsed.routes), 'vercel.json must define rewrites or routes');
  });

  it('2. Vercel Ignore Rules: .gitignore and .vercelignore protect sensitive/heavy files', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    const vercelignorePath = path.resolve(process.cwd(), '.vercelignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
    assert.ok(fs.existsSync(vercelignorePath), '.vercelignore must exist');

    const vIgnoreContent = fs.readFileSync(vercelignorePath, 'utf8');
    assert.ok(vIgnoreContent.includes('tests/'), '.vercelignore must ignore test suites');
  });

  it('3. Serverless Entrypoint: api/index.ts exports a valid Express application', () => {
    assert.ok(app, 'api/index.ts must export a default app');
    assert.equal(typeof app, 'function', 'Express app should be callable function/handler');
  });

  it('4. Health Check Endpoint: GET /api/health succeeds on serverless app', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.game, 'Cyberpunk Neon Survivors');
  });

  it('5. Leaderboard REST API: GET /api/highscores succeeds on serverless app', async () => {
    const res = await request(app).get('/api/highscores');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('6. Leaderboard Submission: POST /api/highscores accepts and persists high score', async () => {
    const newScore = {
      playerName: 'VercelPilot',
      avatar: '⚡',
      score: 88880,
      wave: 9,
      kills: 120,
      maxCombo: 25,
      favoriteWeapon: 'Plasma Homing Missiles',
    };

    const res = await request(app)
      .post('/api/highscores')
      .send(newScore);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.playerName, 'VercelPilot');
    assert.equal(res.body.data.score, 88880);
  });
});
