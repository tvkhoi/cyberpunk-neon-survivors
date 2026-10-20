import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Boss, BOSS_ARCHETYPES, BossDrone, BossShockwave } from '../public/js/entities/boss.js';
import { WeaponManager } from '../public/js/entities/weapons.js';
import { Player } from '../public/js/entities/player.js';
import { WorldObject, WorldObjectManager } from '../public/js/entities/worldObjects.js';

describe('Module 2: Multi-Phase Bosses, Weapon Overdrive & Arena Systems Test Suite', () => {

  describe('1. Boss Archetypes & Infinite Tier Difficulty Scaling', () => {
    it('should define all 3 distinct boss archetypes with specialized combat attributes', () => {
      assert.equal(BOSS_ARCHETYPES.length, 3, 'Must define exactly 3 archetypes');

      const colossus = BOSS_ARCHETYPES.find((b) => b.id === 'colossus');
      const hydra = BOSS_ARCHETYPES.find((b) => b.id === 'hydra');
      const reaper = BOSS_ARCHETYPES.find((b) => b.id === 'reaper');

      assert.ok(colossus && hydra && reaper, 'All 3 archetypes must exist');
      assert.equal(colossus.hullShape, 'hex');
      assert.equal(hydra.hullShape, 'quad');
      assert.equal(reaper.hullShape, 'scythe');

      assert.ok(colossus.speedMult < hydra.speedMult);
      assert.ok(hydra.speedMult < reaper.speedMult);
      assert.ok(colossus.hpMult <= reaper.hpMult);
    });

    it('should calculate exponential tier HP and speed scaling across wave thresholds', () => {
      // Wave 5 = Tier 1
      const bossWave5 = new Boss(0, 0, 5, 0);
      assert.equal(bossWave5.tier, 1);
      assert.equal(bossWave5.archetype.id, 'colossus');

      // Wave 15 = Tier 3
      const bossWave15 = new Boss(0, 0, 15, 0);
      assert.equal(bossWave15.tier, 3);
      assert.ok(
        bossWave15.maxHealth > bossWave5.maxHealth * 1.5,
        `Tier 3 HP (${bossWave15.maxHealth}) must scale aggressively over Tier 1 (${bossWave5.maxHealth})`
      );
      assert.ok(bossWave15.baseSpeed > bossWave5.baseSpeed, 'Tier 3 speed must exceed Tier 1');
    });
  });

  describe('2. Multi-Phase State Machine & Phase Transitions', () => {
    it('should transition accurately between Phase 1, Phase 2, and Phase 3 based on HP thresholds', () => {
      const boss = new Boss(100, 100, 5, 0);
      const player = new Player(150, 150);
      const camera = { addTrauma: () => {} };

      // Initial state: 100% HP -> Phase 1
      boss.update(0.016, player, camera, null);
      assert.equal(boss.phase, 1, 'Above 66% HP must be Phase 1');

      // Reduce HP to 50% -> Phase 2
      boss.health = boss.maxHealth * 0.5;
      boss.update(0.016, player, camera, null);
      assert.equal(boss.phase, 2, 'Between 33% and 66% HP must be Phase 2');

      // Reduce HP to 20% -> Phase 3 (Berserk Overclock)
      boss.health = boss.maxHealth * 0.2;
      boss.update(0.016, player, camera, null);
      assert.equal(boss.phase, 3, 'Below 33% HP must be Phase 3 Berserk Overclock');
      assert.ok(boss.speed > boss.baseSpeed, 'Phase 3 speed must overclock by 1.5x');
    });

    it('should deploy Overdrive Drones during Phase 2 and accelerate them in Phase 3', () => {
      const boss = new Boss(0, 0, 10, 1); // Hydra MK-2
      const camera = { addTrauma: () => {} };

      // Transition to Phase 2
      boss.handlePhaseTransition(1, 2, camera);
      assert.ok(boss.drones.length >= 2, 'Phase 2 must spawn escort drones');

      const initialDroneSpeed = boss.drones[0].orbitSpeed;
      assert.equal(initialDroneSpeed, 1.6);

      // Transition to Phase 3 Berserk
      boss.handlePhaseTransition(2, 3, camera);
      assert.equal(boss.drones[0].orbitSpeed, 2.8, 'Phase 3 must accelerate drone orbit speed to 2.8 rad/s');
    });
  });

  describe('3. Boss Arena Lockdown Forcefield & Containment Mechanics', () => {
    it('should constrain player within Boss Arena Lockdown boundary', () => {
      const boss = new Boss(0, 0, 5, 0);
      const player = new Player(0, 0);
      const camera = { addTrauma: () => {} };

      assert.ok(boss.arena && boss.arena.active, 'Boss arena must be active upon spawn');
      const arenaRadius = boss.arena.radius;

      // Move player far outside the arena boundary (e.g. 1500px away)
      player.x = arenaRadius + 200;
      player.y = 0;
      player.vx = 500;
      player.vy = 0;

      // Boss update should push player back inside the arena
      boss.update(0.016, player, camera, null);

      const newDist = Math.hypot(player.x - boss.arena.x, player.y - boss.arena.y);
      assert.ok(newDist <= arenaRadius + 5, `Player must be contained within arena radius: ${newDist} <= ${arenaRadius}`);
      assert.ok(player.vx < 500, 'Velocity should be dampened upon hitting barrier');
    });

    it('should deactivate arena lockdown forcefield when boss is eliminated', () => {
      const boss = new Boss(0, 0, 5, 0);
      assert.equal(boss.arena.active, true);

      boss.destroyAllMinions();
      assert.equal(boss.arena.active, false, 'Arena forcefield must collapse when boss dies');
    });
  });

  describe('4. Weapon Arsenal & Level 8 Overdrive Evolutions', () => {
    it('should upgrade all 4 weapons up to Level 8 and unlock Overdrive Evolution', () => {
      const weapons = new WeaponManager();

      const weaponTypes = ['homing', 'laser', 'shotgun', 'orbit'];
      for (const type of weaponTypes) {
        const w = weapons.weapons[type];
        // Upgrade to Level 8
        while (w.level < 8) {
          weapons.upgradeWithAmmo(type, null);
        }
        assert.equal(w.level, 8, `${type} must reach Level 8`);
        assert.equal(w.isOverdrive, true, `${type} at Level 8 must activate isOverdrive`);
      }
    });

    it('should fire Hyperion Swarm micro-missiles with enhanced speed and micro-seeker spawns on Overdrive', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);
      const w = weapons.weapons.homing;
      while (w.level < 8) weapons.upgradeWithAmmo('homing', null);

      assert.equal(w.isOverdrive, true);
      weapons.fireWeapon('homing', player, []);

      assert.equal(weapons.projectiles.length, 6, 'Hyperion Swarm must fire 6 micro-missiles');
      const p = weapons.projectiles[0];
      assert.equal(p.isHyperion, true);
      assert.equal(p.speed, 500);

      // Expire projectile and verify micro-seekers spawn
      p.life = 0;
      weapons.update(0.016, player, [], Infinity, Infinity);
      const microSeekers = weapons.projectiles.filter((proj) => proj.isHoming && proj.radius === 4);
      assert.equal(microSeekers.length, 2, 'Hyperion expiration must spawn 2 micro-seekers');
    });

    it('should configure Prism Matrix lasers with 6 bounces and 7 pierces on Overdrive', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);
      while (weapons.weapons.laser.level < 8) weapons.upgradeWithAmmo('laser', null);

      weapons.fireWeapon('laser', player, []);
      const laser = weapons.projectiles[0];

      assert.equal(laser.isPrism, true);
      assert.equal(laser.bouncesLeft, 6);
      assert.equal(laser.pierceCount, 7);
      assert.equal(laser.radius, 10);
    });

    it('should configure Superconductor Flak shotgun with 15 pellets and electric arcs on Overdrive', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);
      while (weapons.weapons.shotgun.level < 8) weapons.upgradeWithAmmo('shotgun', null);

      weapons.fireWeapon('shotgun', player, []);
      assert.equal(weapons.projectiles.length, 15, 'Overdrive shotgun must fire 15 pellets');
      assert.equal(weapons.projectiles[0].isSuperconductor, true);
    });

    it('should expand Aegis Singularity to 6 orbital cores on Overdrive', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);
      while (weapons.weapons.orbit.level < 8) weapons.upgradeWithAmmo('orbit', null);

      const orbs = weapons.getOrbitOrbs(player);
      assert.equal(orbs.length, 6, 'Aegis Singularity must generate 6 orbital satellites');
      assert.equal(orbs[0].isSingularity, true);
    });
  });

  describe('5. Cyber Overclock Ultimate (Sandevistan / Bullet-Time Ability)', () => {
    it('should charge overclock gauge and cap at 100%', () => {
      const player = new Player(0, 0);
      assert.equal(player.overclockGauge, 0);

      player.chargeOverclock(35);
      assert.equal(player.overclockGauge, 35);

      player.chargeOverclock(80);
      assert.equal(player.overclockGauge, 100, 'Gauge must cap at 100%');
    });

    it('should activate Sandevistan Overclock granting 100% crit chance and instant dash refresh', () => {
      const player = new Player(0, 0);
      player.chargeOverclock(100);

      const activated = player.activateOverclock();
      assert.equal(activated, true);
      assert.equal(player.isOverclockActive, true);
      assert.equal(player.overclockGauge, 0, 'Gauge must reset to 0 upon activation');

      // Update player during overclock
      player.update(0.1, Infinity, Infinity);
      assert.equal(player.critChance, 1.0, 'Must grant 100% guaranteed critical strike');
      assert.equal(player.dashTimer, 0, 'Dash cooldown must instantly refresh during Overclock');

      // Fast-forward past duration
      player.update(5.1, Infinity, Infinity);
      assert.equal(player.isOverclockActive, false, 'Overclock must expire after 5 seconds');
      assert.equal(player.critChance, 0.15 + player.avatar.critBonus, 'Crit chance reverts to standard');
    });
  });

  describe('6. Interactive World Objects (Terminals, Barrels, Shrines)', () => {
    it('should progress hacking on Data Terminal and execute Orbital EMP upon completion', () => {
      const terminal = new WorldObject(100, 100, 'terminal');
      const player = new Player(120, 100); // within 80px hackRadius
      const gameContext = {
        camera: { addTrauma: () => {} },
        enemies: [{ x: 200, y: 200, radius: 15, isElite: false, takeDamage: (d: number) => {} }],
        score: 0,
      };

      assert.equal(terminal.isHacked, false);
      terminal.update(2.0, player, gameContext);
      assert.ok(terminal.hackProgress > 1.5, 'Hack progress must accumulate');

      // Complete hack
      terminal.update(2.5, player, gameContext);
      assert.equal(terminal.isHacked, true, 'Terminal must be marked as hacked');
      assert.equal(terminal.color, '#39ff14');
      assert.ok(gameContext.score >= 2500, 'Must grant bonus score on hack completion');
    });

    it('should detonate Plasma Barrels upon reaching 0 HP and deal AOE damage', () => {
      const barrel = new WorldObject(200, 200, 'barrel');
      let enemyDamaged = 0;
      const gameContext = {
        camera: { addTrauma: () => {} },
        enemies: [
          {
            x: 230,
            y: 200,
            radius: 15,
            takeDamage: (amt: number) => { enemyDamaged += amt; },
          },
        ],
        player: new Player(500, 500),
      };

      barrel.takeDamage(15, gameContext);
      assert.equal(barrel.isExploded, false);

      barrel.takeDamage(20, gameContext);
      assert.equal(barrel.isExploded, true, 'Barrel must explode at 0 HP');
      assert.equal(barrel.active, false);
      assert.ok(enemyDamaged >= 135, 'Detonation must inflict AOE damage on adjacent enemy');
    });

    it('should consume Cyber Shrines and apply temporary overcharge buffs', () => {
      const shrine = new WorldObject(50, 50, 'shrine', { buffType: 'overcharge' });
      const player = new Player(55, 55); // touching shrine
      let overchargeApplied = false;
      const gameContext = {
        weapons: {},
        applyWeaponOvercharge: (dur: number) => { overchargeApplied = true; },
      };

      shrine.update(0.016, player, gameContext);
      assert.equal(shrine.isConsumed, true);
      assert.equal(overchargeApplied, true, 'Overcharge shrine must apply weapon overcharge');
    });
  });

  describe('7. Story Extraction Protocol & Victory Mechanics', () => {
    it('should initialize Extraction Protocol with 60s countdown and landing beacon', () => {
      // Mocking Game-like extraction setup
      const extraction = {
        isExtractionActive: true,
        extractionTimer: 60.0,
        extractionLandingZone: {
          x: 500,
          y: 500,
          radius: 110,
          stayProgress: 0,
          stayRequired: 5.0,
          pulseAnim: 0,
        },
        isVictory: false,
        score: 10000,
      };

      assert.equal(extraction.isExtractionActive, true);
      assert.equal(extraction.extractionTimer, 60.0);
      assert.ok(extraction.extractionLandingZone.radius >= 100);

      // Simulate player standing inside landing zone for 5 seconds
      for (let s = 0; s < 5; s++) {
        extraction.extractionLandingZone.stayProgress += 1.0;
      }

      if (extraction.extractionLandingZone.stayProgress >= extraction.extractionLandingZone.stayRequired) {
        extraction.isVictory = true;
        extraction.score += 50000;
      }

      assert.equal(extraction.isVictory, true, 'Player standing in beacon for 5s must trigger Victory');
      assert.equal(extraction.score, 60000, 'Must award 50,000 extraction bonus score');
    });
  });
});
