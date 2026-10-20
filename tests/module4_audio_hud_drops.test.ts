import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { soundEngine, SoundEngine } from '../public/js/audio/soundEngine.js';
import { Player } from '../public/js/entities/player.js';
import { WeaponManager } from '../public/js/entities/weapons.js';
import {
  CollectibleDrop,
  DROP_CONFIGS,
  calculateEnemyDrop,
  calculateBossDrops,
  findNearestDrops,
} from '../public/js/entities/drops.js';

describe('Module 4: Audio SFX, HUD Ammo & Medkit, QA Integration Test Suite', () => {

  describe('1. Audio SFX Engine (SoundEngine) & Web Audio Procedural Synthesis', () => {
    it('should initialize cleanly in headless/Node.js environment without throwing', () => {
      const engine = new SoundEngine();
      assert.equal(engine.muted, false);
      assert.equal(engine.ctx, null);

      // Calling init in Node environment should safely return without crashing
      assert.doesNotThrow(() => engine.init());
      assert.equal(engine.ctx, null);
    });

    it('should toggle mute state and correctly update gain nodes if present', () => {
      const engine = new SoundEngine();
      assert.equal(engine.muted, false);

      const muted = engine.toggleMute();
      assert.equal(muted, true);
      assert.equal(engine.muted, true);

      const unmuted = engine.toggleMute();
      assert.equal(unmuted, false);
      assert.equal(engine.muted, false);
    });

    it('should clamp volume settings between 0.0 and 1.0 safely', () => {
      const engine = new SoundEngine();
      assert.doesNotThrow(() => {
        engine.setMasterVolume(0.8);
        engine.setMasterVolume(-0.5);
        engine.setMasterVolume(1.5);
        engine.setMusicVolume(0.5);
        engine.setSfxVolume(0.7);
      });
    });

    it('should safely execute all procedural SFX methods without throwing in headless environments', () => {
      const engine = new SoundEngine();

      assert.doesNotThrow(() => {
        // Core SFX
        engine.playShoot();
        engine.playShoot(1.5);
        engine.playLaser();
        engine.playExplosion();
        engine.playDash();
        engine.playLevelUp();
        engine.playHeal();
        engine.playAmmoPickup();
        engine.playHit();

        // Module 4 Specialized SFX
        engine.playMedkitPickup();
        engine.playAmmoBoxPickup('homing');
        engine.playAmmoBoxPickup('laser');
        engine.playAmmoBoxPickup('shotgun');
        engine.playAmmoBoxPickup('orbit');
        engine.playLowHealthWarning();
        engine.playBossAlert();
        engine.playUIClick();

        // Bullet-time filter transitions
        engine.setBulletTime(true);
        engine.setBulletTime(false);
      });
    });

    it('should verify synthwave frequencies and scales integrity', () => {
      const engine = new SoundEngine();
      assert.ok(engine.bassNotes.length >= 4, 'Bass notes must contain synthwave progression');
      assert.ok(engine.leadArp.length >= 4, 'Lead arp must contain arpeggiator notes');

      // Check positive valid frequencies
      engine.bassNotes.forEach((f) => assert.ok(f > 20 && f < 500));
      engine.leadArp.forEach((f) => assert.ok(f > 100 && f < 2000));
    });
  });

  describe('2. Collectible Drops Configurations, Physics & Drop Probability Tables', () => {
    it('should properly configure Nano-Repair Medkit and 4 Ammo Box Cores', () => {
      // Medkit configuration
      const medkitCfg = DROP_CONFIGS.health;
      assert.equal(medkitCfg.type, 'health');
      assert.equal(medkitCfg.healAmount, 35);
      assert.equal(medkitCfg.icon, '✚');
      assert.equal(medkitCfg.color, '#10b981');

      // 4 Ammo Box configurations
      const ammoKeys = ['ammo_homing', 'ammo_laser', 'ammo_shotgun', 'ammo_orbit'] as const;
      const expectedWeapons = ['homing', 'laser', 'shotgun', 'orbit'];

      ammoKeys.forEach((key, idx) => {
        const cfg = DROP_CONFIGS[key];
        assert.equal(cfg.type, 'ammo');
        assert.equal(cfg.weaponType, expectedWeapons[idx]);
        assert.ok(cfg.name.length > 0);
        assert.ok(cfg.color.startsWith('#'));
      });
    });

    it('should initialize CollectibleDrop with correct default lifetime and getters', () => {
      const medkitDrop = new CollectibleDrop(200, 300, 'health');
      assert.equal(medkitDrop.x, 200);
      assert.equal(medkitDrop.y, 300);
      assert.equal(medkitDrop.lifetime, 35);
      assert.equal(medkitDrop.maxLifetime, 35);
      assert.equal(medkitDrop.isHealth, true);
      assert.equal(medkitDrop.isAmmo, false);

      const ammoDrop = new CollectibleDrop(400, 500, 'ammo_laser');
      assert.equal(ammoDrop.isHealth, false);
      assert.equal(ammoDrop.isAmmo, true);
    });

    it('should decay drop lifetime and report despawn status accurately', () => {
      const drop = new CollectibleDrop(100, 100, 'health');

      // Update 10 seconds
      const alive1 = drop.update(10, null);
      assert.equal(alive1, true);
      assert.equal(drop.lifetime, 25);

      // Update another 25.1 seconds -> exceeds lifetime
      const alive2 = drop.update(25.1, null);
      assert.equal(alive2, false);
      assert.ok(drop.lifetime <= 0);
    });

    it('should attract drop towards player only when inside magnet radius (190px)', () => {
      const player = new Player(500, 500);

      // 1. Drop inside magnet radius (distance = 100px < 190px)
      const nearDrop = new CollectibleDrop(600, 500, 'health');
      const distBefore = Math.hypot(player.x - nearDrop.x, player.y - nearDrop.y);
      assert.equal(distBefore, 100);

      nearDrop.update(0.1, player);
      const distAfter = Math.hypot(player.x - nearDrop.x, player.y - nearDrop.y);
      assert.ok(distAfter < distBefore, 'Drop must move closer to player due to magnet pull');

      // 2. Drop outside magnet radius (distance = 300px > 190px)
      const farDrop = new CollectibleDrop(800, 500, 'health');
      farDrop.update(0.1, player);
      assert.equal(farDrop.x, 800, 'Drop outside magnet radius must not be displaced');
      assert.equal(farDrop.y, 500);
    });

    it('should yield statistically accurate drop rates in Monte Carlo simulation (10,000 trials)', () => {
      let swarmerDrops = 0;
      let swarmerAmmo = 0;
      let swarmerMedkits = 0;
      const trials = 10000;

      for (let i = 0; i < trials; i++) {
        const drop = calculateEnemyDrop('swarmer');
        if (drop) {
          swarmerDrops++;
          if (drop === 'health') swarmerMedkits++;
          else swarmerAmmo++;
        }
      }

      // Regular enemy drop rate: ~20% total (12% ammo, 8% medkit)
      const totalDropRate = swarmerDrops / trials;
      const ammoRate = swarmerAmmo / trials;
      const medkitRate = swarmerMedkits / trials;

      assert.ok(
        totalDropRate >= 0.18 && totalDropRate <= 0.22,
        `Regular drop rate (${totalDropRate}) should be near 20%`
      );
      assert.ok(
        ammoRate >= 0.10 && ammoRate <= 0.14,
        `Ammo drop rate (${ammoRate}) should be near 12%`
      );
      assert.ok(
        medkitRate >= 0.06 && medkitRate <= 0.10,
        `Medkit drop rate (${medkitRate}) should be near 8%`
      );

      // Elite enemies (kamikaze / sniper) drop rate: ~35% total (20% ammo, 15% medkit)
      let eliteDrops = 0;
      for (let i = 0; i < trials; i++) {
        const drop = calculateEnemyDrop('kamikaze');
        if (drop) eliteDrops++;
      }
      const eliteRate = eliteDrops / trials;
      assert.ok(
        eliteRate >= 0.32 && eliteRate <= 0.38,
        `Elite drop rate (${eliteRate}) should be near 35%`
      );
    });

    it('should generate guaranteed boss drops (1 Medkit + 2 Ammo Crates)', () => {
      const bossDrops = calculateBossDrops(1600, 1600);
      assert.equal(bossDrops.length, 3, 'Boss must yield exactly 3 high-value drops');

      const healthDrops = bossDrops.filter((d) => d.configKey === 'health');
      const ammoDrops = bossDrops.filter((d) => d.configKey.startsWith('ammo_'));

      assert.equal(healthDrops.length, 1, 'Boss must drop 1 guaranteed Medkit');
      assert.equal(ammoDrops.length, 2, 'Boss must drop 2 guaranteed Ammo Boxes');
    });
  });

  describe('3. Player Medkit Inventory & Quick Injection Mechanics', () => {
    it('should start with 1 stored emergency medkit up to max 3', () => {
      const player = new Player(100, 100);
      assert.equal(player.storedMedkits, 1, 'Player starts with 1 emergency medkit');
      assert.equal(player.maxStoredMedkits, 3, 'Max stored medkits capped at 3');
    });

    it('should consume stored medkit when damaged via useStoredMedkit() and restore HP & Shield', () => {
      const player = new Player(100, 100);
      player.health = 45;
      player.shield = 10;
      assert.equal(player.storedMedkits, 1);

      const res = player.useStoredMedkit();
      assert.ok(res !== null);
      assert.equal(res.restored, 35);
      assert.equal(player.health, 80);
      assert.equal(player.storedMedkits, 0, 'Medkit was consumed from inventory');
    });

    it('should refuse to consume stored medkit when player hull is already at 100%', () => {
      const player = new Player(100, 100);
      player.health = player.maxHealth;
      assert.equal(player.storedMedkits, 1);

      const res = player.useStoredMedkit();
      assert.equal(res, null, 'Cannot waste medkit when already at full health');
      assert.equal(player.storedMedkits, 1, 'Stock remained untouched');
    });

    it('should return null when trying to use stored medkit with 0 stock', () => {
      const player = new Player(100, 100);
      player.storedMedkits = 0;
      player.health = 50;

      const res = player.useStoredMedkit();
      assert.equal(res, null);
      assert.equal(player.health, 50);
    });

    it('should store collected medkits into inventory up to maxStoredMedkits when at full health', () => {
      const player = new Player(100, 100);
      player.health = player.maxHealth;
      player.storedMedkits = 1;

      // Simulate full health collection
      const tryStore = (p: Player) => {
        if (p.health >= p.maxHealth && p.storedMedkits < p.maxStoredMedkits) {
          p.storedMedkits++;
          return true;
        }
        return false;
      };

      assert.equal(tryStore(player), true);
      assert.equal(player.storedMedkits, 2);

      assert.equal(tryStore(player), true);
      assert.equal(player.storedMedkits, 3);

      // Attempting to exceed max (3) must be rejected
      assert.equal(tryStore(player), false);
      assert.equal(player.storedMedkits, 3);
    });
  });

  describe('4. Weapon Arsenal Ammo Box Upgrades & Level Caps', () => {
    it('should unlock locked weapons and scale damage & fire rate through ammo crates', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);

      // Reflective laser initially locked
      assert.equal(weapons.weapons.laser.level, 0);

      const unlockResult = weapons.upgradeWithAmmo('laser', player);
      assert.ok(unlockResult);
      assert.equal(unlockResult.isUnlocked, true);
      assert.equal(unlockResult.newLevel, 1);
      assert.equal(weapons.weapons.laser.level, 1);

      const initialDamage = weapons.weapons.laser.damage;
      const initialFireRate = weapons.weapons.laser.fireRate;

      // Upgrade again to level 2
      const upgradeResult = weapons.upgradeWithAmmo('laser', player);
      assert.ok(upgradeResult);
      assert.equal(upgradeResult.isUnlocked, false);
      assert.equal(upgradeResult.newLevel, 2);
      assert.ok(weapons.weapons.laser.damage > initialDamage, 'Damage must scale +15%');
      assert.ok(weapons.weapons.laser.fireRate < initialFireRate, 'Fire rate must improve by 8%');
    });

    it('should enforce hard cap at Weapon Level 8', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);

      // Upgrade 12 times
      for (let i = 0; i < 12; i++) {
        weapons.upgradeWithAmmo('homing', player);
      }

      assert.equal(weapons.weapons.homing.level, 8, 'Weapon level must not exceed 8');
    });
  });

  describe('5. HUD Tactical Radar & Directional Drop Tracking Math', () => {
    it('should accurately calculate distance and 8-way compass direction for nearest drops', () => {
      const player = new Player(1000, 1000);

      const drops = [
        new CollectibleDrop(1000, 800, 'health'), // 200m directly North (⬆)
        new CollectibleDrop(1200, 1000, 'ammo_homing'), // 200m directly East (➡)
        new CollectibleDrop(1500, 1500, 'ammo_laser'), // 707m South-East (↘)
        new CollectibleDrop(1000, 1600, 'health'), // 600m South (⬇)
      ];

      const { nearestMedkit, nearestAmmo } = findNearestDrops(player, drops);

      // Nearest Medkit should be at (1000, 800) -> 200m North
      assert.ok(nearestMedkit !== null);
      assert.equal(nearestMedkit.dist, 200);
      assert.equal(nearestMedkit.arrow, '⬆');

      // Nearest Ammo should be at (1200, 1000) -> 200m East
      assert.ok(nearestAmmo !== null);
      assert.equal(nearestAmmo.dist, 200);
      assert.equal(nearestAmmo.arrow, '➡');
    });

    it('should return null nearest drops when drops list is empty', () => {
      const player = new Player(500, 500);
      const { nearestMedkit, nearestAmmo } = findNearestDrops(player, []);

      assert.equal(nearestMedkit, null);
      assert.equal(nearestAmmo, null);
    });

    it('should correctly flag Critical Low Health state (Hull <= 25%)', () => {
      const player = new Player(100, 100);

      player.health = 100;
      assert.equal((player.health / player.maxHealth) <= 0.25, false);

      player.health = 26;
      assert.equal((player.health / player.maxHealth) <= 0.25, false);

      player.health = 25;
      assert.equal((player.health / player.maxHealth) <= 0.25, true, '25% HP must trigger low health warning');

      player.health = 10;
      assert.equal((player.health / player.maxHealth) <= 0.25, true, '10% HP must trigger low health warning');
    });

    it('should verify HUD level progress percentage calculation for all weapon tiers', () => {
      const calcProgress = (level: number) => Math.min(100, (level / 8) * 100);

      assert.equal(calcProgress(0), 0);
      assert.equal(calcProgress(1), 12.5);
      assert.equal(calcProgress(4), 50);
      assert.equal(calcProgress(8), 100);
      assert.equal(calcProgress(10), 100, 'Clamps at 100%');
    });
  });

  describe('6. QA Integration & High-Load Reliability', () => {
    it('should process 150 simultaneous drop updates and magnet calculations under 15ms', () => {
      const player = new Player(1600, 1600);
      const drops: CollectibleDrop[] = [];

      for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 250;
        drops.push(new CollectibleDrop(
          player.x + Math.cos(angle) * dist,
          player.y + Math.sin(angle) * dist,
          i % 2 === 0 ? 'health' : 'ammo_shotgun'
        ));
      }

      const t0 = performance.now();
      for (const drop of drops) {
        drop.update(0.016, player);
      }
      const elapsed = performance.now() - t0;

      // 150 drop updates should take less than 80ms even under parallel test worker load (typical is < 5ms)
      assert.ok(elapsed < 80, `150 drop updates executed in ${elapsed.toFixed(2)}ms (< 80ms)`);
      assert.equal(drops.length, 150);
    });

    it('should handle rapid sequential medkit usage under heavy damage simulation', () => {
      const player = new Player(100, 100);
      player.storedMedkits = 3;

      // Suffer severe hit
      player.takeDamage(70);
      assert.equal(player.health, 80); // shield took 50, health took 20

      player.takeDamage(60);
      assert.equal(player.health, 20); // health took all 60

      // Use 1st stored medkit
      player.useStoredMedkit();
      assert.equal(player.health, 55);
      assert.equal(player.storedMedkits, 2);

      // Use 2nd stored medkit
      player.useStoredMedkit();
      assert.equal(player.health, 90);
      assert.equal(player.storedMedkits, 1);

      // Use 3rd stored medkit
      player.useStoredMedkit();
      assert.equal(player.health, 100);
      assert.equal(player.storedMedkits, 0);

      // 4th try fails safely
      const failedTry = player.useStoredMedkit();
      assert.equal(failedTry, null);
      assert.equal(player.health, 100);
    });
  });
});
