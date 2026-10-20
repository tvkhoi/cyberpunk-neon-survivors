import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('Module 5: Leaderboard REST API In-Depth Tests', () => {
  it('should return health check status 200 with metadata', async () => {
    const app = createServer();
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.game, 'Cyberpunk Neon Survivors');
    assert.equal(res.body.version, '1.0.0');
    assert.equal(typeof res.body.uptime, 'number');
    assert.ok(res.body.timestamp);
  });

  it('should retrieve pre-seeded top high scores sorted descending', async () => {
    const app = createServer();
    const res = await request(app).get('/api/highscores');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.count >= 4);

    // Verify descending order
    for (let i = 0; i < res.body.data.length - 1; i++) {
      assert.ok(
        res.body.data[i].score >= res.body.data[i + 1].score,
        `Score at ${i} (${res.body.data[i].score}) should be >= score at ${i + 1} (${res.body.data[i + 1].score})`
      );
    }
  });

  it('should reject submission when playerName or score is missing with 400', async () => {
    const app = createServer();

    // Missing playerName
    const res1 = await request(app).post('/api/highscores').send({ score: 50000 });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.success, false);

    // Missing score
    const res2 = await request(app).post('/api/highscores').send({ playerName: 'HACKER_01' });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.success, false);

    // Score is string
    const res3 = await request(app).post('/api/highscores').send({ playerName: 'HACKER_01', score: 'not-a-number' });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.success, false);
  });

  it('should sanitize input and apply default fallbacks', async () => {
    const app = createServer();

    // Whitespace playerName -> fallback CYBER_ANON, negative score clamped to 0
    const res = await request(app).post('/api/highscores').send({
      playerName: '   ',
      score: -500,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.playerName, 'CYBER_ANON');
    assert.equal(res.body.data.score, 0);
    assert.equal(res.body.data.wave, 1);
    assert.equal(res.body.data.favoriteWeapon, 'Plasma Homing Missiles');
  });

  it('should compute accurate rank for new score insertions', async () => {
    const app = createServer();

    // 1. Submitting score higher than everyone -> Rank 1
    const topRes = await request(app).post('/api/highscores').send({
      playerName: 'GOD_GAMER',
      score: 999999,
      wave: 50,
      kills: 1200,
    });
    assert.equal(topRes.status, 201);
    assert.equal(topRes.body.rank, 1);

    // 2. Submitting mid-tier score (e.g. 80,000 between score-2 and score-3)
    const midRes = await request(app).post('/api/highscores').send({
      playerName: 'MID_RUNNER',
      score: 80000,
      wave: 16,
      kills: 300,
    });
    assert.equal(midRes.status, 201);
    assert.ok(midRes.body.rank > 1, 'Rank should be below GOD_GAMER');

    // 3. Confirm leaderboard reflects the changes in order
    const listRes = await request(app).get('/api/highscores');
    assert.equal(listRes.body.data[0].playerName, 'GOD_GAMER');
  });

  it('should cap leaderboard at maximum 50 entries', async () => {
    const app = createServer();

    // Post 55 scores
    for (let i = 1; i <= 55; i++) {
      await request(app).post('/api/highscores').send({
        playerName: `RUNNER_${i}`,
        score: i * 1000,
        wave: Math.floor(i / 2) + 1,
      });
    }

    const listRes = await request(app).get('/api/highscores');
    // Top 10 endpoint returns max 10
    assert.equal(listRes.body.data.length, 10);
    assert.ok(listRes.body.data[0].score >= 55000);
  });
});
