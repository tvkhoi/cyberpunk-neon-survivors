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
    assert.ok(res.body.timestamp);
    assert.equal(typeof res.body.uptime, 'number');
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

  // ===========================================================================
  // SECTION 2: SERVERLESS ROUTING & PATH NORMALIZATION VERIFICATION
  // ===========================================================================

  it('7. Serverless Routing: GET /health (without /api prefix) correctly normalizes and succeeds', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.game, 'Cyberpunk Neon Survivors');
  });

  it('8. Serverless Routing: GET /highscores (without /api prefix) correctly normalizes and succeeds', async () => {
    const res = await request(app).get('/highscores');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('9. Serverless Routing: POST /highscores (without /api prefix) correctly normalizes and creates record', async () => {
    const rootScore = {
      playerName: 'ROOT_RUNNER',
      avatar: '🛡️',
      score: 105000,
      wave: 14,
      kills: 210,
      maxCombo: 40,
      favoriteWeapon: 'Reflective Laser',
    };

    const res = await request(app)
      .post('/highscores')
      .send(rootScore);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.playerName, 'ROOT_RUNNER');
    assert.equal(res.body.data.score, 105000);
  });

  it('10. Serverless Routing: Query parameters are preserved during rewrite (?limit=3)', async () => {
    const res = await request(app).get('/highscores?limit=3');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length <= 3);
  });

  it('11. Serverless Routing: CORS headers are properly served on serverless requests', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://cyberpunk-neon-survivors.vercel.app');

    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });

  it('12. Serverless Routing: OPTIONS preflight check succeeds with HTTP 204 or 200', async () => {
    const res = await request(app)
      .options('/api/highscores')
      .set('Origin', 'https://cyberpunk-neon-survivors.vercel.app')
      .set('Access-Control-Request-Method', 'POST');

    assert.ok(res.status === 204 || res.status === 200);
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });

  it('13. Serverless Routing: Input validation failure returns 400 Bad Request with error details', async () => {
    const res = await request(app)
      .post('/api/highscores')
      .send({ playerName: '', score: 'invalid-score' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error);
  });

  it('14. Serverless Routing: Unknown API endpoint cleanly returns 404 Not Found', async () => {
    const res = await request(app).get('/api/non-existent-route-999');
    assert.equal(res.status, 404);
  });
});
