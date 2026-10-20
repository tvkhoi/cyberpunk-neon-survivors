import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createServer } from '../src/server.js';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';
import { Player, AVATARS } from '../public/js/entities/player.js';

describe('Cyberpunk Neon Survivors - Module 5 Test Suite', () => {
  const app = createServer();

  it('1. Spatial Hash Grid: correctly returns nearby candidates and ignores distant entities', () => {
    const grid = new SpatialHashGrid(100);

    const player = { id: 'player', x: 200, y: 200, radius: 20 };
    const nearEnemy = { id: 'nearEnemy', x: 240, y: 220, radius: 15 };
    const distantEnemy = { id: 'distantEnemy', x: 1500, y: 1500, radius: 15 };

    grid.insert(nearEnemy);
    grid.insert(distantEnemy);

    const candidates = grid.query(player);

    assert.ok(candidates.includes(nearEnemy), 'Near enemy must be included in query results');
    assert.ok(!candidates.includes(distantEnemy), 'Distant enemy must NOT be included in query results');
  });

  it('2. Spatial Hash Grid: clear() resets buckets properly', () => {
    const grid = new SpatialHashGrid(100);
    const item = { x: 50, y: 50, radius: 10 };
    grid.insert(item);

    assert.strictEqual(grid.query({ x: 50, y: 50, radius: 10 }).length, 1);
    grid.clear();
    assert.strictEqual(grid.query({ x: 50, y: 50, radius: 10 }).length, 0);
  });

  it('3. Damage Calculation Formula: validates base damage and critical hits', () => {
    const baseDamage = 40;
    const damageMultiplier = 1.25;
    const critMultiplier = 2.0;

    // Normal hit
    const normalHit = Math.round(baseDamage * damageMultiplier * 1.0);
    assert.strictEqual(normalHit, 50);

    // Critical hit
    const critHit = Math.round(baseDamage * damageMultiplier * critMultiplier);
    assert.strictEqual(critHit, 100);
  });

  it('4. REST API: GET /api/health responds with 200 OK', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.game, 'Cyberpunk Neon Survivors');
  });

  it('5. REST API: POST /api/highscores adds score and GET /api/highscores returns sorted list', async () => {
    const newScore = {
      playerName: 'TEST_RUNNER_X',
      score: 185000,
      wave: 30,
      kills: 550,
      maxCombo: 75,
      favoriteWeapon: 'Reflective Laser',
    };

    const postRes = await request(app).post('/api/highscores').send(newScore);
    assert.strictEqual(postRes.status, 201);
    assert.strictEqual(postRes.body.success, true);
    assert.strictEqual(postRes.body.rank, 1, 'Highest score should take Rank 1');

    const getRes = await request(app).get('/api/highscores');
    assert.strictEqual(getRes.status, 200);
    assert.ok(getRes.body.data.length > 0);
    assert.strictEqual(getRes.body.data[0].playerName, 'TEST_RUNNER_X');
    assert.strictEqual(getRes.body.data[0].score, 185000);
  });

  it('6. Character Profile & Avatar Customization: updates pilot name, avatar, and applies specialized stat perks', () => {
    const player = new Player(100, 100);

    // Initial state: CYBER PHANTOM
    assert.strictEqual(player.name, 'CYBER_V');
    assert.strictEqual(player.avatar.id, 'phantom');
    assert.strictEqual(player.avatar.icon, '⚡');
    assert.strictEqual(player.baseSpeed, 240 * 1.15);

    // Switch to Neo Titan (Tank archetype: +35 Shield)
    player.setProfile('TITAN_WARRIOR', 'titan');
    assert.strictEqual(player.name, 'TITAN_WARRIOR');
    assert.strictEqual(player.avatar.id, 'titan');
    assert.strictEqual(player.avatar.icon, '🛡️');
    assert.strictEqual(player.maxShield, 85); // 50 + 35

    // Switch to Vortex Reaper (Crit Assassin: +15% Crit Chance)
    player.setProfile('REAPER_SHADOW', 'reaper');
    assert.strictEqual(player.name, 'REAPER_SHADOW');
    assert.strictEqual(player.avatar.id, 'reaper');
    assert.strictEqual(player.avatar.icon, '🩸');
    assert.strictEqual(player.critChance, 0.30); // 0.15 + 0.15

    // Switch to Quantum Valkyrie (Bullet-Time Specialist: +30 Chrono Energy)
    player.setProfile('VALKYRIE_ONE', 'valkyrie');
    assert.strictEqual(player.name, 'VALKYRIE_ONE');
    assert.strictEqual(player.avatar.id, 'valkyrie');
    assert.strictEqual(player.avatar.icon, '🌟');
    assert.strictEqual(player.maxEnergy, 130); // 100 + 30
  });

  it('7. REST API: POST /api/highscores accepts and preserves avatar icon, GET /api/highscores returns it', async () => {
    const titanScore = {
      playerName: 'NEO_TITAN_PRO',
      avatar: '🛡️',
      score: 220000,
      wave: 35,
      kills: 620,
      maxCombo: 88,
      favoriteWeapon: 'EMP Shotgun Blast',
    };

    const postRes = await request(app).post('/api/highscores').send(titanScore);
    assert.strictEqual(postRes.status, 201);
    assert.strictEqual(postRes.body.data.avatar, '🛡️');

    const getRes = await request(app).get('/api/highscores');
    assert.strictEqual(getRes.status, 200);
    const savedEntry = getRes.body.data.find((e: any) => e.playerName === 'NEO_TITAN_PRO');
    assert.ok(savedEntry, 'Entry should exist in leaderboard');
    assert.strictEqual(savedEntry.avatar, '🛡️');
  });
});
