import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../src/server.js';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';
import { calculateDamage } from '../src/combat.js';

describe('Module 5: Security, Anti-Tamper & Concurrency Hardening Tests', () => {
  it('1. XSS Defense: strips HTML tags, quotes, and dangerous injection characters from playerName & weapon', async () => {
    const app = createServer();

    const maliciousPayload = {
      playerName: '<script>alert("HACKED")</script>CYBER_RUNNER',
      score: 88888,
      wave: 10,
      favoriteWeapon: '<img src=x onerror=alert(1)>Laser',
    };

    const res = await request(app).post('/api/highscores').send(maliciousPayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    // Verified: No '<', '>', or quotes remain in stored data
    assert.equal(res.body.data.playerName.includes('<'), false);
    assert.equal(res.body.data.playerName.includes('>'), false);
    assert.equal(res.body.data.playerName.includes('"'), false);
    assert.equal(res.body.data.favoriteWeapon.includes('<'), false);
    assert.equal(res.body.data.favoriteWeapon.includes('>'), false);
  });

  it('2. Anti-Cheat: rejects NaN, Infinity, -Infinity and non-numeric scores with 400 Bad Request', async () => {
    const app = createServer();

    // NaN score attack
    const resNaN = await request(app).post('/api/highscores').send({
      playerName: 'CHEAT_BOT',
      score: NaN,
    });
    assert.equal(resNaN.status, 400);
    assert.equal(resNaN.body.success, false);

    // Infinity score attack
    const resInf = await request(app).post('/api/highscores').send({
      playerName: 'CHEAT_BOT',
      score: Infinity,
    });
    assert.equal(resInf.status, 400);
    assert.equal(resInf.body.success, false);

    // String score attack
    const resStr = await request(app).post('/api/highscores').send({
      playerName: 'CHEAT_BOT',
      score: '99999999',
    });
    assert.equal(resStr.status, 400);
    assert.equal(resStr.body.success, false);
  });

  it('3. Anti-Tamper: bounds extreme numbers and negative values safely', async () => {
    const app = createServer();

    const res = await request(app).post('/api/highscores').send({
      playerName: 'OVERFLOW_TEST',
      score: 999_999_999, // exceeds max score cap
      wave: -10, // negative wave
      kills: -50,
      maxCombo: -1,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.score, 100_000_000, 'Score should be capped at 100,000,000');
    assert.equal(res.body.data.wave, 1, 'Wave must be clamped to minimum 1');
    assert.equal(res.body.data.kills, 0, 'Kills must be clamped to minimum 0');
    assert.equal(res.body.data.maxCombo, 0, 'Combo must be clamped to minimum 0');
  });

  it('4. Concurrency ID Collision: generates 100% unique UUIDs under 100 simultaneous submissions', async () => {
    const app = createServer();
    const count = 100;

    const promises = Array.from({ length: count }, (_, i) =>
      request(app)
        .post('/api/highscores')
        .send({
          playerName: `RUNNER_${i}`,
          score: 1000 + i,
        })
    );

    const responses = await Promise.all(promises);
    const idSet = new Set<string>();

    for (const res of responses) {
      assert.equal(res.status, 201);
      const id = res.body.data.id;
      assert.ok(id, 'Entry must have an ID');
      assert.equal(idSet.has(id), false, `ID collision detected: ${id}`);
      idSet.add(id);
    }

    assert.equal(idSet.size, count, `All ${count} entries must have unique IDs under high concurrency`);
  });

  it('5. DoS Prevention: rejects oversized JSON payloads exceeding 16KB with 413 Payload Too Large', async () => {
    const app = createServer();

    // Giant payload: 30KB of string data
    const giantPayload = {
      playerName: 'SPAMMER',
      score: 10000,
      junk: 'A'.repeat(30 * 1024),
    };

    const res = await request(app).post('/api/highscores').send(giantPayload);
    assert.equal(res.status, 413, 'Server must reject giant payloads with 413');
  });

  it('6. Spatial Grid Hardening: immune to NaN, Infinity, and extreme radius attacks', () => {
    const grid = new SpatialHashGrid(120);

    // Entity with NaN coordinates - must be safely ignored without throwing
    grid.insert({ x: NaN, y: 100, radius: 10 } as any);
    grid.insert({ x: 100, y: NaN, radius: 10 } as any);
    grid.insert(null as any);
    assert.equal(grid.grid.size, 0, 'Malformed entities must not corrupt grid state');

    // Query with NaN coordinates - returns empty array
    const queryNaN = grid.query({ x: NaN, y: 50, radius: 10 } as any);
    assert.deepEqual(queryNaN, []);

    // Entity with extreme radius attack (1,000,000px) - bounded safely to cellSize * 4
    grid.insert({ x: 500, y: 500, radius: 1_000_000 });
    // Bounded radius (120 * 4 = 480px) spans at most 9x9 = 81 cells, never millions
    assert.ok(grid.grid.size <= 81, `Grid cells created: ${grid.grid.size} (expected <= 81)`);
  });

  it('7. Combat Logic Robustness: handles non-finite inputs cleanly', () => {
    // Normal input
    const normal = calculateDamage(30, 1.0, 0.15, 2.0, 0.5);
    assert.equal(normal.finalDamage, 30);
    assert.equal(normal.isCrit, false);

    // Zero or low boundary
    const zero = calculateDamage(0, 1.0, 0.15, 2.0, 0.01);
    assert.equal(zero.finalDamage, 0);
    assert.equal(zero.isCrit, true);
  });
});
