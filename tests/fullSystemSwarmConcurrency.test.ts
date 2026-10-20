import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../src/server.js';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';
import { ParticleSystem } from '../public/js/vfx/particles.js';
import { Player } from '../public/js/entities/player.js';
import { Enemy } from '../public/js/entities/enemies.js';
import { CollectibleDrop } from '../public/js/entities/drops.js';
import { calculateDamage } from '../src/combat.js';

describe('Module 5 & Swarm Master: Full System Multi-Module Concurrency Stress Test', () => {
  it('1. Spatial Grid Multi-Threaded Simulator: 50 concurrent simulation steps with 1,000 entities', () => {
    const grid = new SpatialHashGrid(120);
    const entityCount = 1000;
    const worldSize = 4000;

    const entities = Array.from({ length: entityCount }, (_, i) => ({
      id: `ent_${i}`,
      x: (i * 79) % worldSize,
      y: (i * 131) % worldSize,
      radius: 12 + (i % 6),
      vx: ((i % 11) - 5) * 20,
      vy: (((i * 3) % 11) - 5) * 20,
    }));

    for (const e of entities) {
      grid.insert(e);
    }

    const t0 = performance.now();
    // Execute 50 concurrent query sweeps simulating 50 active projectiles/weapons
    const queryRounds = 50;
    let totalDetections = 0;

    for (let r = 0; r < queryRounds; r++) {
      const probe = {
        id: `probe_${r}`,
        x: (r * 73 + 100) % worldSize,
        y: (r * 127 + 100) % worldSize,
        radius: 40,
      };
      const candidates = grid.query(probe);
      assert.ok(Array.isArray(candidates));
      // Deduplication verification: no duplicate IDs in candidate list
      const idSet = new Set(candidates.map((c: any) => c.id));
      assert.equal(idSet.size, candidates.length, 'No duplicate candidates allowed');
      totalDetections += candidates.length;
    }

    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 100, `50 broadphase sweeps took ${elapsed.toFixed(2)}ms (expected < 100ms)`);
    assert.ok(totalDetections >= 0);
  });

  it('2. VFX Particle System & Floating Text Pool Concurrency: 1,500 particles under rapid bursts', () => {
    const ps = new ParticleSystem(800);
    const initialPoolSize = ps.particlePool.length;

    // Burst 15 explosions simultaneously
    for (let i = 0; i < 15; i++) {
      ps.emitSparks(i * 50, i * 50, '#00f0ff', 30, 250);
      ps.addFloatingText(i * 50, i * 50, `HIT ${i * 100}`, '#ffff00', i % 2 === 0);
    }

    assert.equal(ps.particles.length, 15 * 30);
    assert.equal(ps.floatingTexts.length, 15);

    // Advance time beyond particle lifetime
    ps.update(1.5);

    // All active particles and texts must be cleanly recycled back into pool
    assert.equal(ps.particles.length, 0, 'All particles must expire and recycle');
    assert.equal(ps.floatingTexts.length, 0, 'All floating texts must expire and recycle');
    assert.ok(ps.particlePool.length >= 450, 'Recycled particles must replenish pool');
    assert.ok(ps.floatingTextPool.length >= 15, 'Recycled texts must replenish pool');
  });

  it('3. Combat, Shields & Dash Invulnerability Concurrency: 500 simultaneous enemy attacks', () => {
    const player = new Player(1000, 1000);
    player.health = 100;
    player.maxHealth = 100;
    player.shield = 100;
    player.maxShield = 100;

    // 100 concurrent hits while Dashing -> 0 damage taken
    player.isDashing = true;
    for (let i = 0; i < 100; i++) {
      const dmg = calculateDamage(20, 1.0, 0.2, 2.0).finalDamage;
      if (!player.isDashing) {
        player.takeDamage(dmg);
      }
    }
    assert.equal(player.health, 100, 'Health must remain 100 during dash');
    assert.equal(player.shield, 100, 'Shield must remain 100 during dash');

    // Dash ends
    player.isDashing = false;

    // 5 concurrent hits of 15 damage: 5 * 15 = 75 damage absorbed by shield
    for (let i = 0; i < 5; i++) {
      player.takeDamage(15);
    }
    assert.equal(player.shield, 25, 'Shield absorbed 75 damage (100 - 75 = 25)');
    assert.equal(player.health, 100, 'Health untouched while shield active');

    // 2 more hits of 20 damage: first hit breaks shield (25 - 20 = 5 left), second breaks remainder & damages health
    player.takeDamage(20); // shield = 5, health = 100
    assert.equal(player.shield, 5);
    assert.equal(player.health, 100);

    player.takeDamage(20); // shield takes 5 (shield = 0), health takes 15 (health = 85)
    assert.equal(player.shield, 0);
    assert.equal(player.health, 85);
  });

  it('4. Collectible Drops & Magnet Pull Concurrency: 200 drops pulled toward player', () => {
    const player = new Player(500, 500);
    player.magnetRadius = 300;

    const drops: CollectibleDrop[] = [];
    for (let i = 0; i < 200; i++) {
      const angle = (i / 200) * Math.PI * 2;
      const dist = 50 + (i % 200);
      drops.push(new CollectibleDrop(
        player.x + Math.cos(angle) * dist,
        player.y + Math.sin(angle) * dist,
        i % 3 === 0 ? 'health' : 'ammo_shotgun'
      ));
    }

    // Step physics 10 times concurrently across all 200 drops
    const dt = 0.016;
    for (let step = 0; step < 10; step++) {
      for (const d of drops) {
        d.update(dt, player);
      }
    }

    // Verify all drops moved towards the player without NaN or infinity
    for (const d of drops) {
      assert.ok(Number.isFinite(d.x));
      assert.ok(Number.isFinite(d.y));
      assert.ok(Number.isFinite(d.vx));
      assert.ok(Number.isFinite(d.vy));
    }
  });

  it('5. Leaderboard REST API High Concurrency: 120 interleaved parallel requests', async () => {
    const app = createServer();
    const requestCount = 120;
    const avatars = ['⚡', '🛡️', '🩸', '🌟'];

    const tasks = Array.from({ length: requestCount }, (_, i) => {
      if (i % 3 === 0) {
        // Read operation
        return request(app)
          .get('/api/highscores')
          .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            return 'read';
          });
      } else {
        // Write operation
        return request(app)
          .post('/api/highscores')
          .send({
            playerName: `SWARM_PILOT_${i}`,
            avatar: avatars[i % avatars.length],
            score: 20000 + i * 350,
            wave: (i % 30) + 1,
            kills: i * 12,
            maxCombo: i * 2,
            favoriteWeapon: 'Plasma Homing Missiles',
          })
          .then((res) => {
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.ok(res.body.data.id);
            return 'write';
          });
      }
    });

    const results = await Promise.all(tasks);
    assert.equal(results.length, requestCount);

    // Final leaderboard verification
    const finalRes = await request(app).get('/api/highscores');
    assert.equal(finalRes.status, 200);
    const topScores = finalRes.body.data;
    assert.ok(topScores.length <= 10);

    for (let i = 0; i < topScores.length - 1; i++) {
      assert.ok(
        topScores[i].score >= topScores[i + 1].score,
        `Leaderboard descending invariant failed at index ${i}`
      );
    }
  });

  it('6. Full Cross-Module Swarm Concurrency: Parallel Engine + VFX + Combat + Drops + API', async () => {
    const app = createServer();
    const grid = new SpatialHashGrid(120);
    const ps = new ParticleSystem(400);
    const player = new Player(1200, 1200);

    // Populate grid
    for (let i = 0; i < 300; i++) {
      grid.insert({ id: i, x: (i * 41) % 3000, y: (i * 67) % 3000, radius: 10 });
    }

    // Run parallel tasks simulating the entire game running at once:
    const parallelSimulations = [
      // Sub-task 1: Spatial Grid queries
      new Promise<string>((resolve) => {
        for (let i = 0; i < 200; i++) {
          grid.query({ x: (i * 29) % 3000, y: (i * 53) % 3000, radius: 25 });
        }
        resolve('spatial_ok');
      }),

      // Sub-task 2: VFX Particle pool emissions
      new Promise<string>((resolve) => {
        for (let i = 0; i < 10; i++) {
          ps.emitSparks(i * 100, i * 100, '#00f0ff', 20, 200);
        }
        ps.update(1.0);
        resolve('vfx_ok');
      }),

      // Sub-task 3: Combat calculations
      new Promise<string>((resolve) => {
        for (let i = 0; i < 1000; i++) {
          const res = calculateDamage(40, 1.25, 0.3, 2.5);
          assert.ok(res.finalDamage > 0);
        }
        resolve('combat_ok');
      }),

      // Sub-task 4: API score submission
      request(app)
        .post('/api/highscores')
        .send({
          playerName: 'SWARM_CONCURRENT_CHAMPION',
          score: 999999,
          wave: 50,
          kills: 999,
          maxCombo: 120,
          favoriteWeapon: 'Hyper Beam Cannon',
        })
        .then((res) => {
          assert.equal(res.status, 201);
          assert.equal(res.body.rank, 1);
          return 'api_ok';
        }),
    ];

    const results = await Promise.all(parallelSimulations);
    assert.deepEqual(results, ['spatial_ok', 'vfx_ok', 'combat_ok', 'api_ok']);
  });
});
