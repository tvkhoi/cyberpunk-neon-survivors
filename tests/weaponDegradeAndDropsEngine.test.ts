import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WeaponManager } from '../public/js/entities/weapons.js';
import { Player } from '../public/js/entities/player.js';
import { Game } from '../public/js/game.js';
import { CollectibleDrop, calculateEnemyDrop, calculateBossDrops } from '../public/js/entities/drops.js';

describe('Module 1: Drops Engine - Weapon Upgrade Ammo Crates & Degradation on Hit Tests', () => {

  describe('1. Weapon Degradation Mechanics (degradeWeapon & degradeOnHit)', () => {
    it('should degrade weapon level by 1 and accurately revert damage and fire rate without rounding drift', () => {
      const weapons = new WeaponManager();
      const w = weapons.weapons.homing;

      assert.equal(w.level, 1);
      assert.equal(w.damage, 28);
      assert.equal(w.fireRate, 0.65);

      // Upgrade homing to level 3
      weapons.upgradeWithAmmo('homing');
      weapons.upgradeWithAmmo('homing');
      assert.equal(w.level, 3);
      assert.equal(w.damage, Math.round(28 * Math.pow(1.15, 2))); // 37
      assert.equal(w.fireRate, Number((0.65 * Math.pow(0.92, 2)).toFixed(4))); // 0.5502

      // Degrade back to level 2
      const deg1 = weapons.degradeWeapon('homing');
      assert.ok(deg1 !== null);
      assert.equal(deg1.prevLevel, 3);
      assert.equal(deg1.newLevel, 2);
      assert.equal(deg1.isLocked, false);
      assert.equal(w.damage, Math.round(28 * 1.15)); // 32
      assert.equal(w.fireRate, Number((0.65 * 0.92).toFixed(4))); // 0.598

      // Degrade back to base level 1
      const deg2 = weapons.degradeWeapon('homing');
      assert.equal(deg2?.newLevel, 1);
      assert.equal(w.damage, 28);
      assert.equal(w.fireRate, 0.65);
    });

    it('should strictly protect starting weapon (homing) from degrading below Level 1', () => {
      const weapons = new WeaponManager();
      assert.equal(weapons.weapons.homing.level, 1);

      // Attempt to degrade Level 1 homing
      const result = weapons.degradeWeapon('homing');
      assert.equal(result, null, 'Homing weapon must never degrade below Level 1');
      assert.equal(weapons.weapons.homing.level, 1);
    });

    it('should allow secondary weapons to degrade from Level 1 to Level 0 (Locked)', () => {
      const weapons = new WeaponManager();
      // Unlock laser with Ammo Crate
      weapons.upgradeWithAmmo('laser');
      assert.equal(weapons.weapons.laser.level, 1);

      // Degrade laser
      const deg = weapons.degradeWeapon('laser');
      assert.ok(deg !== null);
      assert.equal(deg.prevLevel, 1);
      assert.equal(deg.newLevel, 0);
      assert.equal(deg.isLocked, true);
      assert.equal(weapons.weapons.laser.level, 0);

      // Degrading locked weapon returns null safely
      const failedDeg = weapons.degradeWeapon('laser');
      assert.equal(failedDeg, null);
      assert.equal(weapons.weapons.laser.level, 0);
    });

    it('should automatically degrade the highest level weapon when degradeOnHit() is triggered', () => {
      const weapons = new WeaponManager();
      // homing = 2, laser = 4, shotgun = 1
      weapons.upgradeWithAmmo('homing'); // lvl 2
      weapons.upgradeWithAmmo('laser');  // lvl 1
      weapons.upgradeWithAmmo('laser');  // lvl 2
      weapons.upgradeWithAmmo('laser');  // lvl 3
      weapons.upgradeWithAmmo('laser');  // lvl 4
      weapons.upgradeWithAmmo('shotgun'); // lvl 1

      // degradeOnHit should pick laser (highest at lvl 4)
      const res1 = weapons.degradeOnHit();
      assert.equal(res1?.weapon.id, 'laser');
      assert.equal(res1?.prevLevel, 4);
      assert.equal(res1?.newLevel, 3);

      // Next hit should still target laser (lvl 3 vs homing lvl 2)
      const res2 = weapons.degradeOnHit();
      assert.equal(res2?.weapon.id, 'laser');
      assert.equal(res2?.newLevel, 2);

      // Next hit: tie between laser (2) and homing (2) -> secondary weapon (laser) degrades first to protect primary gun
      const res3 = weapons.degradeOnHit();
      assert.equal(res3?.weapon.id, 'laser');
      assert.equal(res3?.newLevel, 1);
    });

    it('should safely return null when all weapons are at minimal levels and cannot degrade', () => {
      const weapons = new WeaponManager();
      // homing = 1, all others = 0
      assert.equal(weapons.weapons.homing.level, 1);
      assert.equal(weapons.weapons.laser.level, 0);
      assert.equal(weapons.weapons.shotgun.level, 0);
      assert.equal(weapons.weapons.orbit.level, 0);

      const res = weapons.degradeOnHit();
      assert.equal(res, null, 'Must return null safely without errors when no weapons can degrade');
    });
  });

  describe('2. Combat Degradation Cooldown & Dash Immunity', () => {
    it('should enforce grace cooldown between consecutive hits to prevent instant weapon wiping', () => {
      // Mock minimal canvas and Game instance in Node.js
      const mockCanvas = {
        getContext: () => ({
          clearRect: () => {},
          save: () => {},
          restore: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          translate: () => {},
          rotate: () => {},
          drawImage: () => {},
        }),
        width: 1920,
        height: 1080,
      } as unknown as HTMLCanvasElement;

      // Provide window mock if needed in Node
      if (typeof globalThis.window === 'undefined') {
        (globalThis as any).window = {
          innerWidth: 1920,
          innerHeight: 1080,
          addEventListener: () => {},
          dispatchEvent: () => true,
        };
      }

      const game = new Game(mockCanvas);
      // Upgrade homing to level 4
      game.weapons.upgradeWithAmmo('homing');
      game.weapons.upgradeWithAmmo('homing');
      game.weapons.upgradeWithAmmo('homing');
      assert.equal(game.weapons.weapons.homing.level, 4);

      // Hit 1: Trigger degradation -> degrades to level 3, sets cooldown = 1.0s
      const hit1 = game.triggerWeaponDegradeOnHit();
      assert.ok(hit1 !== null);
      assert.equal(game.weapons.weapons.homing.level, 3);
      assert.equal(game.weaponDegradeCooldownTimer, 1.0);

      // Hit 2: Immediate consecutive hit (cooldown still active: 1.0s) -> ignored!
      const hit2 = game.triggerWeaponDegradeOnHit();
      assert.equal(hit2, null, 'Weapon must not degrade while grace cooldown is active');
      assert.equal(game.weapons.weapons.homing.level, 3);

      // Simulate 0.6s passing -> timer = 0.4s (still on cooldown)
      game.weaponDegradeCooldownTimer -= 0.6;
      const hit3 = game.triggerWeaponDegradeOnHit();
      assert.equal(hit3, null);
      assert.equal(game.weapons.weapons.homing.level, 3);

      // Simulate another 0.5s passing -> timer <= 0 (cooldown expired)
      game.weaponDegradeCooldownTimer = 0;
      const hit4 = game.triggerWeaponDegradeOnHit();
      assert.ok(hit4 !== null);
      assert.equal(game.weapons.weapons.homing.level, 2);
    });

    it('should completely protect weapons from degradation when Player is Dashing (Dash Invulnerability)', () => {
      const mockCanvas = {
        getContext: () => ({ clearRect: () => {} }),
        width: 1920,
        height: 1080,
      } as unknown as HTMLCanvasElement;

      const game = new Game(mockCanvas);
      game.weapons.upgradeWithAmmo('homing');
      assert.equal(game.weapons.weapons.homing.level, 2);

      // Player is currently dashing
      game.player.isDashing = true;
      const res = game.triggerWeaponDegradeOnHit();
      assert.equal(res, null, 'Dashing player cannot have weapons degraded');
      assert.equal(game.weapons.weapons.homing.level, 2);
    });
  });

  describe('3. Dynamic Recovery via Ammo Crates & Nano Medkits', () => {
    it('should recover degraded weapons immediately upon picking up Ammo Crates', () => {
      const weapons = new WeaponManager();
      const player = new Player(100, 100);

      // Laser unlocked to lvl 1, then degraded to lvl 0
      weapons.upgradeWithAmmo('laser', player);
      assert.equal(weapons.weapons.laser.level, 1);
      weapons.degradeWeapon('laser', player);
      assert.equal(weapons.weapons.laser.level, 0);

      // Player picks up a Laser Ammo Core drop -> Re-activates laser!
      const dropResult = weapons.upgradeWithAmmo('laser', player);
      assert.equal(dropResult?.isUnlocked, true);
      assert.equal(weapons.weapons.laser.level, 1);
      assert.equal(weapons.weapons.laser.damage, 45);
    });

    it('should verify boss guaranteed drops contain specialized ammo cores to recover arsenal', () => {
      const bossDrops = calculateBossDrops(500, 500);
      assert.equal(bossDrops.length, 3);

      const medkits = bossDrops.filter(d => d.configKey === 'health');
      const ammoCrates = bossDrops.filter(d => d.isAmmo);

      assert.equal(medkits.length, 1);
      assert.equal(ammoCrates.length, 2);
      assert.ok(ammoCrates.some(d => d.configKey === 'ammo_laser'));
      assert.ok(ammoCrates.some(d => d.configKey === 'ammo_shotgun'));
    });
  });
});
