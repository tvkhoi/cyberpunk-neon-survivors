import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Boss, BossDrone, BossShockwave, BOSS_ARCHETYPES } from '../public/js/entities/boss.js';

describe('Module 2: Multi-Phase Boss Architecture Test Suite', () => {

  // =========================================================================
  // 1. BOSS INITIALIZATION & SCALING
  // =========================================================================
  describe('1. Boss Initialization & Archetype Scaling', () => {
    it('should define all 3 distinct Cyberpunk Boss Archetypes with complete stats', () => {
      assert.equal(BOSS_ARCHETYPES.length, 3, 'Must define exactly 3 archetypes');

      const colossus = BOSS_ARCHETYPES.find((a) => a.id === 'colossus');
      const hydra = BOSS_ARCHETYPES.find((a) => a.id === 'hydra');
      const reaper = BOSS_ARCHETYPES.find((a) => a.id === 'reaper');

      assert.ok(colossus, 'Colossus archetype must exist');
      assert.equal(colossus.hullShape, 'hex');
      assert.equal(colossus.baseColor, '#00f0ff');

      assert.ok(hydra, 'Hydra archetype must exist');
      assert.equal(hydra.hullShape, 'quad');
      assert.equal(hydra.speedMult, 1.25);

      assert.ok(reaper, 'Reaper archetype must exist');
      assert.equal(reaper.hullShape, 'scythe');
      assert.equal(reaper.speedMult, 1.45);
    });

    it('should initialize Boss at Wave 5 with Tier 1 and Phase 1 Standard defaults', () => {
      const boss = new Boss(1000, 1000, 5, 0);

      assert.equal(boss.wave, 5);
      assert.equal(boss.tier, 1);
      assert.equal(boss.phase, 1);
      assert.equal(boss.prevPhase, 1);
      assert.ok(boss.health > 2000, `Boss health should scale with wave (got ${boss.health})`);
      assert.equal(boss.health, boss.maxHealth);
      assert.equal(boss.drones.length, 0, 'Phase 1 should start with 0 drones deployed');
      assert.equal(boss.laserState, 'idle');
      assert.equal(boss.shockwaves.length, 0);
    });

    it('should scale Tier and Max Health exponentially with higher boss waves', () => {
      const bossW5 = new Boss(1000, 1000, 5, 0);
      const bossW10 = new Boss(1000, 1000, 10, 0);
      const bossW20 = new Boss(1000, 1000, 20, 0);

      assert.equal(bossW5.tier, 1);
      assert.equal(bossW10.tier, 2);
      assert.equal(bossW20.tier, 4);

      assert.ok(bossW10.maxHealth > bossW5.maxHealth, 'Wave 10 HP must be greater than Wave 5');
      assert.ok(bossW20.maxHealth > bossW10.maxHealth, 'Wave 20 HP must be greater than Wave 10');
      assert.ok(bossW20.radius > bossW5.radius, 'Higher tier boss must have larger radius');
    });
  });

  // =========================================================================
  // 2. PHASE 1: STANDARD COMBAT MECHANICS
  // =========================================================================
  describe('2. Phase 1: Standard Tactical Combat (HP > 66%)', () => {
    it('should stay in Phase 1 when HP is above 66%', () => {
      const boss = new Boss(1000, 1000, 5, 0);
      const mockPlayer = { x: 1000, y: 1300, radius: 15, isDashing: false };

      // Deal small damage (10% of HP)
      boss.takeDamage(boss.maxHealth * 0.1);
      boss.update(0.016, mockPlayer);

      assert.equal(boss.phase, 1, 'Boss must remain in Phase 1 above 66% HP');
      assert.equal(boss.drones.length, 0);
    });

    it('should fire radial bursts with calculated angle distribution and speed', () => {
      const boss = new Boss(500, 500, 5, 0);
      assert.equal(boss.bullets.length, 0);

      boss.fireRadialBurst(12, 250);

      assert.equal(boss.bullets.length, 12, 'Must spawn exactly 12 bullets');
      for (const b of boss.bullets) {
        assert.ok(b.damage >= 18, 'Bullet must have base damage');
        const speed = Math.hypot(b.vx, b.vy);
        assert.ok(Math.abs(speed - 250) < 1.0, 'Bullet velocity must match speed parameter');
      }
    });

    it('should fire twin articulated turret salvos and apply mechanical recoil kickback', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.turretAngle = 0; // pointing right
      boss.fireTurretSalvo();

      assert.equal(boss.bullets.length, 2, 'Turret salvo must fire 2 heavy bolts');
      assert.ok(boss.turretRecoil > 0, 'Turret salvo must apply positive recoil kickback');

      // Update over time to verify recoil decay
      const initialRecoil = boss.turretRecoil;
      boss.update(0.1, { x: 500, y: 500 });
      assert.ok(boss.turretRecoil < initialRecoil, 'Recoil must decay over time');
    });

    it('should smoothly rotate turrets towards player position', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.turretAngle = 0;
      const player = { x: 500, y: 800, radius: 15 }; // directly below boss (angle = Math.PI / 2)

      boss.update(0.1, player);
      assert.ok(boss.turretAngle > 0, 'Turret angle should track towards positive PI/2');
    });
  });

  // =========================================================================
  // 3. PHASE 2: OVERDRIVE DRONES SYSTEM
  // =========================================================================
  describe('3. Phase 2: Overdrive Drones Deployment & Escort Behavior', () => {
    it('should transition to Phase 2 when HP drops below 66% and deploy escort drones', () => {
      const boss = new Boss(1000, 1000, 5, 0);
      const mockPlayer = { x: 1000, y: 1300, radius: 15, isDashing: false };

      // Deal damage down to 50% HP (Phase 2 territory)
      boss.health = boss.maxHealth * 0.5;
      boss.update(0.016, mockPlayer);

      assert.equal(boss.phase, 2, 'Boss must enter Phase 2 when HP <= 66%');
      assert.ok(boss.drones.length >= 2, 'Boss must deploy at least 2 Overdrive Drones');
      assert.equal(boss.speed, boss.baseSpeed * 1.25, 'Speed should increase by 1.25x in Phase 2');
    });

    it('should calculate drone orbital positions correctly along polar circumference', () => {
      const boss = new Boss(500, 500, 5, 0);
      const drone = new BossDrone(boss, 0, 100);

      // Angle 0 should place drone directly to the right of boss (x = 600, y = 500)
      assert.equal(Math.round(drone.x), 600);
      assert.equal(Math.round(drone.y), 500);

      // Advance orbit by PI/2 (90 deg)
      drone.orbitAngle = Math.PI / 2;
      drone.update(0.001); // minimal dt
      assert.equal(Math.round(drone.x), 500);
      assert.equal(Math.round(drone.y), 600);
    });

    it('should allow player projectiles to damage and destroy Overdrive Drones', () => {
      const boss = new Boss(500, 500, 5, 0);
      const drone = new BossDrone(boss, 0, 100);
      const initialHp = drone.health;

      // Partial damage
      const dead1 = drone.takeDamage(20);
      assert.equal(dead1, false);
      assert.equal(drone.health, initialHp - 20);

      // Lethal damage
      const dead2 = drone.takeDamage(initialHp);
      assert.equal(dead2, true);
      assert.ok(drone.health <= 0);
    });

    it('should have drones fire targeted projectiles towards player on cooldown', () => {
      const boss = new Boss(500, 500, 5, 0);
      const drone = new BossDrone(boss, 0, 100);
      const player = { x: 900, y: 500, radius: 15 };

      // Force shoot timer to trigger fire
      drone.shootTimer = drone.shootCooldown;
      drone.update(0.016, player);

      assert.equal(drone.bullets.length, 1, 'Drone must fire a bullet towards player');
      const bullet = drone.bullets[0];
      assert.ok(bullet.vx > 0, 'Bullet should travel right towards player');
      assert.equal(bullet.isDroneBullet, true);
    });

    it('should replenish destroyed drones during Phase 2 after respawn cooldown', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = { x: 500, y: 800, radius: 15 };
      boss.health = boss.maxHealth * 0.5; // Phase 2 HP
      boss.phase = 2;
      boss.prevPhase = 2;
      boss.maxDrones = 2;
      boss.drones = []; // both destroyed

      // Accumulate time past respawn cooldown
      boss.droneRespawnCooldown = 1.0;
      boss.update(1.1, player);

      assert.equal(boss.drones.length, 1, 'Boss must spawn a replacement drone');
    });

    it('should fire dual opposing spiral arms in Phase 2', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 2;
      boss.fireSpiralPair(280);

      assert.equal(boss.bullets.length, 2, 'Phase 2 spiral pair should fire 2 arms');
      for (const b of boss.bullets) {
        const speed = Math.hypot(b.vx, b.vy);
        assert.ok(Math.abs(speed - 280) < 1.0);
      }
    });
  });

  // =========================================================================
  // 4. PHASE 3: BERSERK LASER BEAM & SHOCKWAVE
  // =========================================================================
  describe('4. Phase 3: Berserk Overclock, Sweeping Laser & Shockwave', () => {
    it('should transition to Phase 3 when HP drops below 33% and engage Berserk state', () => {
      const boss = new Boss(1000, 1000, 5, 0);
      const mockPlayer = { x: 1000, y: 1300, radius: 15, isDashing: false };

      // Deal damage down to 20% HP (Phase 3 territory)
      boss.health = boss.maxHealth * 0.2;
      boss.update(0.016, mockPlayer);

      assert.equal(boss.phase, 3, 'Boss must enter Phase 3 when HP <= 33%');
      assert.equal(boss.speed, boss.baseSpeed * 1.5, 'Speed should increase by 1.5x in Phase 3');
      assert.ok(boss.shockwaves.length >= 1, 'Transition to Phase 3 must detonate an entry shockwave');
    });

    it('should progress Sweeping Laser through idle -> charging -> firing -> idle states', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 3;
      boss.laserCooldown = 1.0;
      boss.laserChargeTime = 0.5;
      boss.laserFireDuration = 1.0;
      boss.laserCooldownTimer = 0;
      const player = { x: 800, y: 500, radius: 15, isDashing: false, takeDamage: () => {} };

      // 1. Idle -> Charging
      boss.updateLaser(1.1, player);
      assert.equal(boss.laserState, 'charging', 'Laser should enter charging state');

      // 2. Charging -> Firing
      boss.updateLaser(0.6, player);
      assert.equal(boss.laserState, 'firing', 'Laser should transition to firing state');

      // 3. Firing -> Sweeps angle
      const initialAngle = boss.laserAngle;
      boss.updateLaser(0.2, player);
      assert.notEqual(boss.laserAngle, initialAngle, 'Laser angle must sweep during firing');

      // 4. Firing -> Idle
      boss.updateLaser(0.9, player);
      assert.equal(boss.laserState, 'idle', 'Laser should return to idle after duration expires');
    });

    it('should accurately calculate geometric laser beam ray-to-circle collision', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.laserAngle = 0; // beam points directly along positive X axis (Y = 500)
      boss.laserLength = 1000;
      boss.laserWidth = 30; // half-width = 15

      // Target directly on beam centerline
      const playerOnBeam = { x: 800, y: 500, radius: 15 };
      assert.equal(boss.checkLaserHit(playerOnBeam), true, 'Player on centerline must be hit');

      // Target within half-width + radius (e.g. Y = 500 + 25 <= 15 + 15 = 30)
      const playerNearBeam = { x: 800, y: 525, radius: 15 };
      assert.equal(boss.checkLaserHit(playerNearBeam), true, 'Player near beam must be hit');

      // Target far away from beam (Y = 600)
      const playerOffBeam = { x: 800, y: 600, radius: 15 };
      assert.equal(boss.checkLaserHit(playerOffBeam), false, 'Player far from beam must not be hit');

      // Target behind boss origin (X = 200, Y = 500)
      const playerBehind = { x: 200, y: 500, radius: 15 };
      assert.equal(boss.checkLaserHit(playerBehind), false, 'Player behind beam origin must not be hit');
    });

    it('should respect Player Dash Invulnerability during laser beam sweep', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 3;
      boss.laserState = 'firing';
      boss.laserAngle = 0;
      boss.laserLength = 1000;
      boss.laserWidth = 30;

      let damageTaken = 0;
      let hyperBoostTriggered = false;

      const dashingPlayer = {
        x: 800,
        y: 500,
        radius: 15,
        isDashing: true,
        takeDamage: (amt: number) => { damageTaken += amt; },
        triggerHyperBoost: () => { hyperBoostTriggered = true; },
      };

      boss.updateLaser(0.2, dashingPlayer);

      assert.equal(damageTaken, 0, 'Dashing player must take ZERO damage from laser');
      assert.equal(hyperBoostTriggered, true, 'Graze through laser must trigger Hyper Boost');
    });

    it('should expand BossShockwave and accurately detect player collision', () => {
      const shockwave = new BossShockwave(500, 500, 1, {
        radius: 50,
        maxRadius: 200,
        expandSpeed: 300,
        thickness: 20,
        damage: 25,
      });

      // Expand shockwave
      const isExpired = shockwave.update(0.1); // radius moves from 50 to 80
      assert.equal(isExpired, false);
      assert.equal(Math.round(shockwave.radius), 80);

      // Player at distance 80 from center (direct ring overlap)
      const playerAtRing = { x: 580, y: 500, radius: 15, isDashing: false };
      const col = shockwave.checkCollision(playerAtRing);

      assert.ok(col, 'Collision should be detected');
      assert.equal(col.hit, true);
      assert.equal(col.damage, 25);
      assert.equal(shockwave.hitPlayer, true);

      // Subsequent check should return null (no double hits)
      assert.equal(shockwave.checkCollision(playerAtRing), null);
    });

    it('should allow player to Perfect Dash through shockwave without damage', () => {
      const shockwave = new BossShockwave(500, 500, 1, {
        radius: 100,
        maxRadius: 250,
        thickness: 20,
        damage: 30,
      });

      const dashingPlayer = { x: 600, y: 500, radius: 15, isDashing: true };
      const col = shockwave.checkCollision(dashingPlayer);

      assert.ok(col);
      assert.equal(col.isDashing, true, 'Shockwave collision must record dash state');
    });

    it('should execute Berserk Ramming Dash with heavy speed and detonate shockwave on impact', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 3;
      boss.chargeCooldown = 0.5;
      boss.chargeTimer = 0.5; // ready to charge
      const player = { x: 800, y: 500, radius: 15, isDashing: false, x_vel: 0, y_vel: 0 };

      // Update into dash
      boss.updateBerserkCharge(0.016, player);
      assert.equal(boss.isCharging, true, 'Boss must enter charging state');

      // Advance dash to completion (0.7s)
      boss.updateBerserkCharge(0.7, player);
      assert.equal(boss.isCharging, false, 'Boss must exit charging state after dash');
      assert.ok(boss.shockwaves.length >= 1, 'Boss must detonate shockwave at end of dash');
      assert.ok(boss.bullets.length >= 12, 'Boss must fire radial burst at end of dash');
    });
  });

  // =========================================================================
  // 5. DEFEAT & CLEANUP
  // =========================================================================
  describe('5. Defeat & Minion Cleanup', () => {
    it('should cleanly remove all drones, bullets, shockwaves and reset laser upon defeat', () => {
      const boss = new Boss(500, 500, 5, 0);
      boss.phase = 3;
      boss.spawnDrones(3);
      boss.spawnShockwave(200, 300);
      boss.fireRadialBurst(8, 200);
      boss.laserState = 'firing';

      assert.equal(boss.drones.length, 3);
      assert.equal(boss.shockwaves.length, 1);
      assert.equal(boss.bullets.length, 8);
      assert.equal(boss.laserState, 'firing');

      // Deal lethal damage
      const isDead = boss.takeDamage(boss.maxHealth + 100);

      assert.equal(isDead, true);
      assert.equal(boss.drones.length, 0, 'Drones must be purged on boss death');
      assert.equal(boss.shockwaves.length, 0, 'Shockwaves must be purged on boss death');
      assert.equal(boss.bullets.length, 0, 'Bullets must be purged on boss death');
      assert.equal(boss.laserState, 'idle', 'Laser must be reset to idle');
    });
  });
});
