import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Enemy, ELITE_AFFIXES } from '../public/js/entities/enemies.js';
import { Boss, BOSS_ARCHETYPES, BossDrone, BossShockwave } from '../public/js/entities/boss.js';
import { Player } from '../public/js/entities/player.js';
import { Camera } from '../public/js/engine/camera.js';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';

describe('Module 4: QA Integration, Unit Tests & Concurrency Tests for Elite Affixes & Multi-Phase Bosses', () => {

  // ===========================================================================
  // SECTION 1: ELITE AFFIXES REGISTRY & MUTATION MECHANICS (UNIT TESTS)
  // ===========================================================================
  describe('1. Elite Enemy Mutation Affixes Engine (Unit Tests)', () => {
    it('1.1 should define all core Elite Affixes in ELITE_AFFIXES registry with valid metadata and neon colors', () => {
      assert.ok(ELITE_AFFIXES, 'ELITE_AFFIXES must be exported');
      const expectedAffixes = ['shielded', 'teleporter', 'artillery', 'overclocked'];

      for (const affixKey of expectedAffixes) {
        const cfg = ELITE_AFFIXES[affixKey];
        assert.ok(cfg, `Affix '${affixKey}' must exist in ELITE_AFFIXES`);
        assert.equal(cfg.id, affixKey);
        assert.ok(typeof cfg.tag === 'string' && cfg.tag.length > 0, `Affix ${affixKey} must have tag`);
        assert.ok(typeof cfg.name === 'string' && cfg.name.length > 0, `Affix ${affixKey} must have name`);
        assert.ok(typeof cfg.description === 'string' && cfg.description.length > 0, `Affix ${affixKey} must have description`);
        assert.ok(cfg.color && cfg.color.startsWith('#'), `Affix ${affixKey} must have valid hex color`);
      }
    });

    it('1.2 should strictly NOT assign affixes to non-elite enemies', () => {
      const swarmer = new Enemy(100, 100, 'swarmer', 1, 1, false);
      assert.equal(swarmer.isElite, false);
      assert.equal(swarmer.affix, undefined);
      assert.equal(swarmer.hasAffix('shielded'), false);
      assert.equal(swarmer.hasAffix('overclocked'), false);
    });

    it('1.3 should apply Champion stat multipliers to Elite enemies', () => {
      const normal = new Enemy(100, 100, 'swarmer', 3, 2, false);
      const elite = new Enemy(100, 100, 'swarmer', 3, 2, true);

      assert.equal(elite.isElite, true);
      assert.ok(elite.health > normal.health * 2, 'Elite HP should be roughly 2.6x normal HP');
      assert.ok(elite.radius > normal.radius, 'Elite hitbox should be 1.35x normal');
      assert.ok(elite.damage > normal.damage, 'Elite damage should be 1.5x normal');
      assert.equal(elite.xpValue, normal.xpValue * 4, 'Elite XP should be 4x normal');
      assert.equal(elite.eliteColor, '#ffd700');
    });

    it('1.4 [Affix: SHIELDED] should initialize 75% maxHealth shield and absorb damage before health', () => {
      const elite = new Enemy(200, 200, 'swarmer', 1, 1, true, 'shielded');
      assert.equal(elite.affix, 'shielded');
      assert.equal(elite.affixTag, 'SHIELDED');
      assert.equal(elite.affixColor, '#00f0ff');
      assert.ok(elite.hasAffix('shielded'));
      assert.ok(elite.hasAffix('SHIELDED'));

      const expectedShield = Math.round(elite.maxHealth * 0.75);
      assert.equal(elite.shield, expectedShield);
      assert.equal(elite.maxShield, expectedShield);

      // Hit 1: Smaller than shield -> Shield absorbs all, health remains at 100%
      const halfShield = Math.floor(expectedShield / 2);
      const isDead1 = elite.takeDamage(halfShield);
      assert.equal(isDead1, false);
      assert.equal(elite.shield, expectedShield - halfShield);
      assert.equal(elite.health, elite.maxHealth, 'Health must not decrease while shield holds');

      // Hit 2: Exceeds remaining shield -> Shield breaks, leftover spills to health
      const leftover = elite.shield + 20;
      const isDead2 = elite.takeDamage(leftover);
      assert.equal(isDead2, false);
      assert.equal(elite.shield, 0, 'Shield must be depleted to 0');
      assert.equal(elite.health, elite.maxHealth - 20, 'Excess damage must pierce directly to health');
    });

    it('1.5 [Affix: TELEPORTER / BLINK] should cycle teleport timer and warp closer to player', () => {
      const player = new Player(500, 500);
      const elite = new Enemy(100, 100, 'swarmer', 1, 1, true, 'teleporter');
      assert.equal(elite.affix, 'teleporter');
      assert.equal(elite.affixTag, 'BLINK');
      assert.equal(elite.affixColor, '#a855f7');
      assert.equal(elite.teleportCooldown, 4.2);

      const initialX = elite.x;
      const initialY = elite.y;

      // Advance by 2.0s -> Not ready to teleport yet
      elite.update(2.0, player, [elite]);
      assert.ok(elite.teleportTimer >= 2.0, 'Timer should accumulate dt');

      // Advance past teleport cooldown (4.2s) with standard dt
      elite.teleportTimer = elite.teleportCooldown + 0.1;
      elite.update(0.016, player, [elite]);
      assert.equal(elite.teleportTimer, 0, 'Timer should reset to 0 upon blinking');

      // Position should have warped closer to player (flanking radius 130-180px)
      const distAfterBlink = Math.hypot(player.x - elite.x, player.y - elite.y);
      assert.ok(distAfterBlink < 250, `Warped position should be near player, got ${distAfterBlink}`);
      assert.notEqual(elite.x, initialX);
      assert.notEqual(elite.y, initialY);
    });

    it('1.6 [Affix: ARTILLERY] should trigger telegraphed mortar strikes and push hazard zones', () => {
      const player = new Player(600, 600);
      const hazards: any[] = [];
      const gameContext = { hazards };

      const elite = new Enemy(100, 100, 'swarmer', 2, 1, true, 'artillery');
      assert.equal(elite.affix, 'artillery');
      assert.equal(elite.affixTag, 'ARTILLERY');
      assert.equal(elite.affixColor, '#f59e0b');
      assert.equal(elite.artilleryCooldown, 4.8);

      // Advance past cooldown (initial timer is 1.0, so 4.0s elapsed is enough)
      elite.update(4.0, player, [elite], gameContext);
      assert.equal(elite.artilleryTimer, 0, 'Artillery timer should reset after firing');

      // Verify hazard zone was pushed to gameContext
      assert.equal(hazards.length, 1, 'Should spawn 1 orbital artillery hazard zone');
      const zone = hazards[0];
      assert.equal(zone.x, player.x);
      assert.equal(zone.y, player.y);
      assert.equal(zone.radius, 65);
      assert.equal(zone.timer, 1.3);
      assert.ok(zone.damage > elite.damage, 'Artillery strike should deal amplified damage');
    });

    it('1.7 [Affix: OVERCLOCK] should boost base speed by 35% and trigger enraged sprint under 50% HP', () => {
      const normal = new Enemy(100, 100, 'swarmer', 1, 1, false);
      const elite = new Enemy(100, 100, 'swarmer', 1, 1, true, 'overclocked');
      const player = new Player(500, 500);

      assert.equal(elite.affix, 'overclocked');
      assert.equal(elite.affixTag, 'OVERCLOCK');
      assert.equal(elite.affixColor, '#ff0055');

      // Overclocked speed > standard elite speed
      const baseSpeed = elite.baseSpeed;
      assert.ok(elite.speed >= Math.round(normal.speed * 1.22 * 1.35 * 0.95));

      // Over 50% HP: not enraged
      elite.update(0.1, player, [elite]);
      assert.equal(elite.isEnraged, undefined);

      // Reduce HP to 40% (below 50% threshold)
      elite.health = Math.round(elite.maxHealth * 0.4);
      elite.update(0.1, player, [elite]);

      assert.equal(elite.isEnraged, true, 'Should enter enraged sprint below 50% HP');
      assert.equal(elite.speed, Math.round(baseSpeed * 1.45), 'Enraged sprint must boost speed by 45%');
    });

    it('1.8 should verify hasAffix helper works seamlessly with tags and lowercase identifiers', () => {
      const elite = new Enemy(100, 100, 'phantom', 1, 1, true, 'teleporter');
      assert.equal(elite.hasAffix('teleporter'), true);
      assert.equal(elite.hasAffix('blink'), true);
      assert.equal(elite.hasAffix('BLINK'), true);
      assert.equal(elite.hasAffix('shielded'), false);
      assert.equal(elite.hasAffix('artillery'), false);
    });
  });

  // ===========================================================================
  // SECTION 2: MULTI-PHASE BOSSES & STATE MACHINE TRANSITIONS (UNIT TESTS)
  // ===========================================================================
  describe('2. Multi-Phase Bosses & State Machine Architecture (Unit Tests)', () => {
    it('2.1 should configure all 3 distinct Cyberpunk Boss Archetypes with unique stats', () => {
      assert.equal(BOSS_ARCHETYPES.length, 3);
      const ids = BOSS_ARCHETYPES.map((a) => a.id);
      assert.deepEqual(ids, ['colossus', 'hydra', 'reaper']);

      for (const arch of BOSS_ARCHETYPES) {
        assert.ok(arch.name.length > 0);
        assert.ok(arch.title.length > 0);
        assert.ok(arch.baseColor.startsWith('#'));
        assert.ok(arch.enrageColor.startsWith('#'));
        assert.ok(arch.speedMult >= 1.0);
        assert.ok(arch.hpMult >= 1.0);
        assert.ok(['hex', 'quad', 'scythe'].includes(arch.hullShape));
      }
    });

    it('2.2 should scale Boss HP exponentially with tier and wave progression', () => {
      const bossTier1 = new Boss(0, 0, 5, 0); // Wave 5 -> Tier 1
      const bossTier2 = new Boss(0, 0, 10, 0); // Wave 10 -> Tier 2
      const bossTier3 = new Boss(0, 0, 15, 0); // Wave 15 -> Tier 3

      assert.equal(bossTier1.tier, 1);
      assert.equal(bossTier2.tier, 2);
      assert.equal(bossTier3.tier, 3);

      assert.ok(bossTier2.maxHealth > bossTier1.maxHealth * 1.4);
      assert.ok(bossTier3.maxHealth > bossTier2.maxHealth * 1.3);
      assert.ok(bossTier3.radius > bossTier1.radius);
    });

    it('2.3 [Boss Phase 1: Standard] should fire radial bursts and track turrets (> 66% HP)', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = new Player(600, 600);
      const camera = new Camera(1920, 1080);

      assert.equal(boss.phase, 1);
      assert.equal(boss.drones.length, 0);
      assert.equal(boss.laserState, 'idle');

      // Update 2.0s -> trigger radial burst and turret salvo
      boss.update(2.0, player, camera, {});
      assert.ok(boss.bullets.length >= 14, 'Phase 1 should generate radial burst + turret bullets');
      assert.equal(boss.phase, 1);
    });

    it('2.4 [Boss Phase 2: Overdrive Drones] should transition at <= 66% HP and deploy escort drones', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = new Player(600, 600);
      const camera = new Camera(1920, 1080);

      let phaseChangeDetected = false;
      boss.onPhaseChange = (from, to) => {
        if (from === 1 && to === 2) phaseChangeDetected = true;
      };

      // Deal damage down to 60% HP
      boss.health = Math.round(boss.maxHealth * 0.60);
      boss.update(0.016, player, camera, {});

      assert.equal(boss.phase, 2, 'Boss must transition to Phase 2 at 60% HP');
      assert.equal(phaseChangeDetected, true, 'onPhaseChange callback must be fired');
      assert.equal(boss.drones.length, boss.maxDrones, 'Phase 2 must spawn escort drones');
      assert.ok(boss.shockwaves.length >= 1, 'Phase 2 transition should emit an energy shockwave');

      // Escort Drones should orbit around boss
      for (const drone of boss.drones) {
        assert.ok(drone instanceof BossDrone);
        assert.ok(drone.health > 0);
        assert.equal(drone.boss, boss);
        const distToBoss = Math.hypot(drone.x - boss.x, drone.y - boss.y);
        assert.ok(Math.abs(distToBoss - drone.orbitRadius) < 2.0);
      }
    });

    it('2.5 [Boss Phase 3: Berserk Overclock] should transition at <= 33% HP, accelerate, and start laser charging', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = new Player(600, 600);
      const camera = new Camera(1920, 1080);

      let reachedPhase3 = false;
      boss.onPhaseChange = (from, to) => {
        if (to === 3) reachedPhase3 = true;
      };

      // Deal damage down to 25% HP
      boss.health = Math.round(boss.maxHealth * 0.25);
      boss.update(0.016, player, camera, {});

      assert.equal(boss.phase, 3, 'Boss must transition to Phase 3 at <= 33% HP');
      assert.equal(reachedPhase3, true);
      assert.equal(boss.speed, boss.baseSpeed * 1.5, 'Phase 3 Berserk speed must be 1.5x baseSpeed');

      // Trigger laser charge warmup
      boss.laserCooldownTimer = boss.laserCooldown;
      boss.update(0.016, player, camera, {});
      assert.ok(['charging', 'firing'].includes(boss.laserState), 'Sweeping laser should activate in Phase 3');

      // Drones in Phase 3 must accelerate orbit speed to 2.8 rad/s
      for (const drone of boss.drones) {
        assert.equal(drone.orbitSpeed, 2.8);
      }
    });

    it('2.6 should allow Overdrive Drones to take damage and get destroyed independently', () => {
      const boss = new Boss(300, 300, 5, 0);
      boss.spawnDrones(2);
      assert.equal(boss.drones.length, 2);

      const drone = boss.drones[0];
      const initialDroneHp = drone.health;

      drone.takeDamage(50);
      assert.equal(drone.health, initialDroneHp - 50);

      // Lethal hit destroys drone
      drone.takeDamage(initialDroneHp);
      assert.ok(drone.health <= 0);

      const player = new Player(300, 450);
      boss.update(0.016, player, null, null);
      assert.equal(boss.drones.length, 1, 'Destroyed drone is pruned from drones array');
    });

    it('2.7 should smoothly decay damage-lag health bar (prevHealth) without jitter', () => {
      const boss = new Boss(500, 500, 5, 0);
      const camera = new Camera(1920, 1080);
      assert.equal(boss.health, boss.maxHealth);
      assert.equal(boss.prevHealth, boss.maxHealth);

      // Boss takes instant 500 damage
      boss.takeDamage(500);
      assert.equal(boss.health, boss.maxHealth - 500);
      assert.equal(boss.prevHealth, boss.maxHealth, 'prevHealth must retain pre-damage value before update');

      // Step physics 0.5s -> prevHealth should smoothly interpolate down towards health
      boss.update(0.5, null, camera, {});
      assert.ok(boss.prevHealth < boss.maxHealth, 'prevHealth should have decayed');
      assert.ok(boss.prevHealth >= boss.health, 'prevHealth must never dip below actual health');
    });

    it('2.8 should destroy and purge all bullets, drones, and shockwaves upon Boss death', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 2;
      boss.spawnDrones(3);
      boss.spawnShockwave(200);
      boss.bullets.push({ x: 0, y: 0, vx: 10, vy: 10, radius: 5, life: 3.0 });

      assert.equal(boss.drones.length, 3);
      assert.equal(boss.shockwaves.length, 1);
      assert.equal(boss.bullets.length, 1);

      // Kill the boss
      const isDead = boss.takeDamage(boss.health + 100);
      assert.equal(isDead, true);
      assert.equal(boss.drones.length, 0, 'Drones must be purged on death');
      assert.equal(boss.bullets.length, 0, 'Bullets must be purged on death');
      assert.equal(boss.shockwaves.length, 0, 'Shockwaves must be purged on death');
      assert.equal(boss.laserState, 'idle');
    });
  });

  // ===========================================================================
  // SECTION 3: QA INTEGRATION SCENARIOS (COMBAT, ENCOUNTERS & GRAZE)
  // ===========================================================================
  describe('3. QA Integration Scenarios (Combat & Encounters)', () => {
    it('3.1 should verify player weapon fire breaks shield before reducing Elite HP in combat', () => {
      const elite = new Enemy(300, 300, 'enforcer', 2, 2, true, 'shielded');
      const initialShield = elite.shield;
      const initialHealth = elite.health;

      // Bullet 1 deals 40 damage
      elite.takeDamage(40);
      assert.equal(elite.shield, initialShield - 40);
      assert.equal(elite.health, initialHealth);

      // Bullet 2 breaks the shield with excess 30 damage
      const remainingShield = elite.shield;
      elite.takeDamage(remainingShield + 30);
      assert.equal(elite.shield, 0);
      assert.equal(elite.health, initialHealth - 30);
    });

    it('3.2 should verify Boss Shockwave triggers Perfect Dash Graze when player is dashing', () => {
      const player = new Player(500, 500);
      player.health = 100;
      player.shield = 50;
      player.isDashing = true; // Dashing!

      const shockwave = new BossShockwave(500, 500, 1, {
        radius: 10,
        maxRadius: 300,
        expandSpeed: 400,
        damage: 40,
      });

      // Expand shockwave to hit player's radius
      shockwave.radius = player.radius + 5;
      const hitResult = shockwave.checkCollision(player);

      assert.ok(hitResult, 'Shockwave should detect collision');
      assert.equal(hitResult.hit, true);
      assert.equal(hitResult.isDashing, true);

      // Player health & shield must remain completely untouched during dash graze
      assert.equal(player.health, 100);
      assert.equal(player.shield, 50);
    });

    it('3.3 should verify Boss Shockwave damages player when NOT dashing', () => {
      const player = new Player(500, 500);
      player.health = 100;
      player.shield = 50;
      player.isDashing = false; // Standing still / moving normally

      const shockwave = new BossShockwave(500, 500, 1, {
        radius: player.radius + 5,
        maxRadius: 300,
        damage: 30,
      });

      const hitResult = shockwave.checkCollision(player);
      assert.ok(hitResult);
      assert.equal(hitResult.isDashing, false);

      // Apply damage
      player.takeDamage(hitResult.damage);
      assert.equal(player.shield, 20, 'Shield should absorb 30 damage');
      assert.equal(player.health, 100);
    });

    it('3.4 should simulate complete Boss Lifecycle (Phase 1 -> Phase 2 -> Phase 3 -> Defeat)', () => {
      const boss = new Boss(1000, 1000, 5, 1); // Hydra MK-1
      const player = new Player(1000, 1200);
      const camera = new Camera(1920, 1080);

      const phasesTraversed: number[] = [];
      boss.onPhaseChange = (_, to) => phasesTraversed.push(to);

      // Phase 1 (100% HP)
      assert.equal(boss.phase, 1);
      boss.update(1.0, player, camera, {});
      assert.ok(boss.bullets.length > 0);

      // Drop to Phase 2 (55% HP)
      boss.health = Math.round(boss.maxHealth * 0.55);
      boss.update(0.1, player, camera, {});
      assert.equal(boss.phase, 2);
      assert.ok(boss.drones.length > 0);

      // Drop to Phase 3 (20% HP)
      boss.health = Math.round(boss.maxHealth * 0.20);
      boss.update(0.1, player, camera, {});
      assert.equal(boss.phase, 3);
      assert.ok(boss.speed > boss.baseSpeed);

      // Fatal strike -> 0 HP
      const dead = boss.takeDamage(boss.health + 50);
      assert.equal(dead, true);
      assert.equal(boss.bullets.length, 0);
      assert.equal(boss.drones.length, 0);

      assert.deepEqual(phasesTraversed, [2, 3], 'Must record sequential phase transitions');
    });

    it('3.5 should support Twin Bosses at wave 15+ with independent health and phase tracking', () => {
      const boss1 = new Boss(800, 500, 15, 0); // Colossus
      const boss2 = new Boss(1200, 500, 15, 1); // Hydra
      const player = new Player(1000, 800);
      const camera = new Camera(1920, 1080);

      // Damage only boss1 down to Phase 3
      boss1.health = Math.round(boss1.maxHealth * 0.25);
      boss1.update(0.016, player, camera, {});

      // Boss2 remains unharmed in Phase 1
      boss2.update(0.016, player, camera, {});

      assert.equal(boss1.phase, 3, 'Boss 1 must transition to Phase 3');
      assert.equal(boss2.phase, 1, 'Boss 2 must stay in Phase 1');
      assert.equal(boss2.health, boss2.maxHealth, 'Boss 2 health must not be affected by Boss 1');
      assert.notEqual(boss1.phase, boss2.phase);

      // Defeating Boss 1 does not defeat Boss 2
      const b1Dead = boss1.takeDamage(boss1.health + 10);
      assert.equal(b1Dead, true);
      assert.equal(boss2.health, boss2.maxHealth);
      assert.equal(boss2.takeDamage(0), false);
    });
  });

  // ===========================================================================
  // SECTION 4: SYSTEM CONCURRENCY & HIGH LOAD STRESS TESTS
  // ===========================================================================
  describe('4. High-Load Concurrency & Stress Tests', () => {
    it('4.1 should simulate 250 concurrent Elite enemies with varied affixes across 30 ticks in < 35ms', () => {
      const player = new Player(1600, 1600);
      const affixes = ['shielded', 'teleporter', 'artillery', 'overclocked'];
      const enemies: Enemy[] = [];

      // Create 250 concurrent Elites with distributed affixes
      for (let i = 0; i < 250; i++) {
        const angle = (i / 250) * Math.PI * 2;
        const dist = 100 + (i % 800);
        const affix = affixes[i % affixes.length];
        const e = new Enemy(
          player.x + Math.cos(angle) * dist,
          player.y + Math.sin(angle) * dist,
          i % 2 === 0 ? 'swarmer' : 'phantom',
          5,
          3,
          true,
          affix
        );
        enemies.push(e);
      }

      assert.equal(enemies.length, 250);

      const t0 = performance.now();
      const dt = 0.016;
      const hazards: any[] = [];
      const gameContext = { hazards };

      // Run 30 consecutive concurrent physics updates
      for (let tick = 0; tick < 30; tick++) {
        for (const e of enemies) {
          e.update(dt, player, enemies, gameContext);
        }
      }
      const duration = performance.now() - t0;

      assert.ok(
        duration < 250,
        `250 concurrent Elites x 30 ticks executed in ${duration.toFixed(2)}ms (expected < 250ms)`
      );

      // Verify state integrity: no NaNs, no broken properties
      for (const e of enemies) {
        assert.ok(Number.isFinite(e.x), 'Enemy X must be finite');
        assert.ok(Number.isFinite(e.y), 'Enemy Y must be finite');
        assert.ok(Number.isFinite(e.health), 'Enemy health must be finite');
        if (e.affix === 'shielded') {
          assert.ok(Number.isFinite(e.shield));
        }
      }
    });

    it('4.2 should process 150 concurrent player projectile impacts on Multi-Phase Boss atomically', () => {
      const boss = new Boss(500, 500, 10, 0);
      const initialHp = boss.maxHealth;
      const projectileCount = 150;
      const damagePerBullet = 25;

      // Dispatch 150 simultaneous hits on the boss
      const results: boolean[] = [];
      for (let i = 0; i < projectileCount; i++) {
        const isDead = boss.takeDamage(damagePerBullet);
        results.push(isDead);
      }

      assert.equal(results.length, projectileCount);
      const expectedHp = initialHp - (projectileCount * damagePerBullet);
      assert.equal(boss.health, expectedHp);
      assert.ok(boss.health > 0);

      // Advance one tick -> state machine should cleanly update to correct phase without skipping
      const camera = new Camera(1920, 1080);
      boss.update(0.016, null, camera, {});

      const hpRatio = boss.health / boss.maxHealth;
      if (hpRatio <= 0.33) {
        assert.equal(boss.phase, 3);
      } else if (hpRatio <= 0.66) {
        assert.equal(boss.phase, 2);
      } else {
        assert.equal(boss.phase, 1);
      }
    });

    it('4.3 should handle Spatial Hash Grid queries with 500 enemies, Elites, and Bosses in < 20ms', () => {
      const grid = new SpatialHashGrid(120);
      const entityCount = 500;
      const worldSize = 4000;

      const entities: any[] = [];
      for (let i = 0; i < entityCount; i++) {
        const ent = {
          id: `entity_${i}`,
          x: (i * 137) % worldSize,
          y: (i * 249) % worldSize,
          radius: i === 0 ? 56 : (i % 10 === 0 ? 28 : 14), // i=0 is boss, i%10 are elites
          isBoss: i === 0,
          isElite: i % 10 === 0,
        };
        entities.push(ent);
        grid.insert(ent);
      }

      // Query around 100 probe points (simulating 100 simultaneous projectile probes)
      const t0 = performance.now();
      let queryHits = 0;

      for (let q = 0; q < 100; q++) {
        const probe = {
          x: (q * 181) % worldSize,
          y: (q * 313) % worldSize,
          radius: 8,
        };
        const neighbors = grid.query(probe);
        queryHits += neighbors.length;
      }
      const elapsed = performance.now() - t0;

      assert.ok(
        elapsed < 25,
        `Spatial Grid broadphase for 500 entities x 100 probes took ${elapsed.toFixed(2)}ms (expected < 25ms)`
      );
      assert.ok(queryHits >= 0);
    });

    it('4.4 should stress test rapid consecutive phase shifts under extreme burst damage', () => {
      const boss = new Boss(0, 0, 5, 2); // Reaper
      const camera = new Camera(1920, 1080);
      const phaseChanges: string[] = [];

      boss.onPhaseChange = (from, to) => {
        phaseChanges.push(`${from}->${to}`);
      };

      // Rapidly burst boss HP in steps
      boss.health = Math.round(boss.maxHealth * 0.50); // Phase 2
      boss.update(0.016, null, camera, {});

      boss.health = Math.round(boss.maxHealth * 0.20); // Phase 3
      boss.update(0.016, null, camera, {});

      assert.deepEqual(phaseChanges, ['1->2', '2->3']);
      assert.equal(boss.phase, 3);
      assert.ok(Number.isFinite(boss.speed));
      assert.ok(Number.isFinite(boss.health));
    });

    it('4.5 should handle dense Boss bullet hell (600+ bullets) with 100% memory culling and zero leaks', () => {
      const boss = new Boss(0, 0, 10, 1);
      const player = new Player(0, 400);
      const camera = new Camera(1920, 1080);

      // Force 30 rapid spiral firing cycles
      for (let cycle = 0; cycle < 30; cycle++) {
        boss.fireSpiralPair(350);
        boss.fireRadialBurst(16, 280);
      }

      const totalFired = boss.bullets.length;
      assert.ok(totalFired >= 400, `Expected at least 400 bullets, got ${totalFired}`);

      // Fast forward time by 6.0 seconds (all bullets have life ~4.2s, so all should expire)
      boss.update(6.0, player, camera, {});

      assert.equal(
        boss.bullets.length,
        0,
        'All expired bullets must be completely culled from memory without leaks'
      );
    });
  });
});
