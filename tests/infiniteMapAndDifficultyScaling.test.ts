import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../public/js/engine/camera.js';
import { Player } from '../public/js/entities/player.js';
import { Enemy } from '../public/js/entities/enemies.js';
import { LightingEngine } from '../public/js/vfx/lighting.js';

describe('Module 1: Infinite Procedural Map & Dynamic Level Difficulty Scaling Test Suite', () => {
  describe('1. Infinite Map Roaming & Unbounded Camera Tracking', () => {
    it('should allow player to roam beyond 3200px without boundary restriction when bounds are Infinity', () => {
      const player = new Player(0, 0);
      assert.equal(player.x, 0);
      assert.equal(player.y, 0);

      // Move deep into positive coordinates
      player.vx = 800;
      player.vy = 800;
      player.update(10, Infinity, Infinity);

      assert.equal(player.x, 8000, 'Player should reach 8000 X in infinite mode');
      assert.equal(player.y, 8000, 'Player should reach 8000 Y in infinite mode');

      // Move into negative coordinates
      player.vx = -1200;
      player.vy = -1200;
      player.update(10, Infinity, Infinity);

      assert.equal(player.x, -4000, 'Player should move freely into negative X coordinates');
      assert.equal(player.y, -4000, 'Player should move freely into negative Y coordinates');
    });

    it('should track player seamlessly in infinite space without boundary clamping', () => {
      const camera = new Camera(1920, 1080, Infinity, Infinity);
      assert.equal(camera.isInfinite, true);

      // Camera smoothly updates towards far-away player at (-5000, -8000)
      for (let i = 0; i < 60; i++) {
        camera.update(-5000, -8000, 1 / 60);
      }

      assert.ok(camera.x < -4000, `Camera should follow into deep negative space: ${camera.x}`);
      assert.ok(camera.y < -7000, `Camera should follow into deep negative space: ${camera.y}`);

      // Bounding box in negative coordinates
      const bounds = camera.getVisibleBounds(100);
      assert.ok(bounds.minX < bounds.maxX);
      assert.ok(bounds.minY < bounds.maxY);
      assert.ok(camera.isVisible(camera.x, camera.y, 10), 'Camera center must be visible');
    });

    it('should preserve finite clamping when explicit world bounds are supplied', () => {
      const camera = new Camera(800, 600, 2000, 2000);
      assert.equal(camera.isInfinite, false);

      camera.update(-500, -500, 1.0);
      assert.equal(camera.x, 400, 'Bounded camera cannot cross half viewport width');
      assert.equal(camera.y, 300, 'Bounded camera cannot cross half viewport height');
    });
  });

  describe('2. Dynamic Difficulty Scaling (Wave + Player Level)', () => {
    it('should scale enemy HP, damage, and speed aggressively with both Wave and Player Level', () => {
      // Wave 1, Level 1 (Baseline)
      const baseSwarmer = new Enemy(0, 0, 'swarmer', 1, 1, false);

      // Wave 5, Level 10 (Mid-to-Late game progression)
      const lateSwarmer = new Enemy(0, 0, 'swarmer', 5, 10, false);

      assert.ok(
        lateSwarmer.health > baseSwarmer.health * 1.5,
        `Late game HP (${lateSwarmer.health}) must exceed base HP (${baseSwarmer.health}) by >1.5x`
      );
      assert.ok(
        lateSwarmer.damage > baseSwarmer.damage * 1.3,
        `Late game damage (${lateSwarmer.damage}) must exceed base damage (${baseSwarmer.damage}) by >1.3x`
      );
      assert.ok(
        lateSwarmer.speed > baseSwarmer.speed,
        `Late game speed (${lateSwarmer.speed}) must be faster than base speed (${baseSwarmer.speed})`
      );
    });

    it('should accelerate sniper and swarmer shoot cooldowns at higher levels requiring player dodging focus', () => {
      const earlySniper = new Enemy(0, 0, 'sniper', 1, 1);
      const veteranSniper = new Enemy(0, 0, 'sniper', 6, 12);

      assert.ok(
        veteranSniper.aimCooldown < earlySniper.aimCooldown,
        `Veteran sniper aim cooldown (${veteranSniper.aimCooldown}s) must be faster than early sniper (${earlySniper.aimCooldown}s)`
      );
    });

    it('should empower Elite Champion enemies with massive health, speed, and 4x XP value', () => {
      const normalEnforcer = new Enemy(0, 0, 'enforcer', 3, 5, false);
      const eliteEnforcer = new Enemy(0, 0, 'enforcer', 3, 5, true);

      assert.equal(eliteEnforcer.isElite, true);
      assert.ok(
        eliteEnforcer.health >= Math.round(normalEnforcer.health * 2.5),
        `Elite HP (${eliteEnforcer.health}) must be at least 2.5x normal HP (${normalEnforcer.health})`
      );
      assert.ok(
        eliteEnforcer.speed > normalEnforcer.speed,
        `Elite speed (${eliteEnforcer.speed}) must be faster than normal (${normalEnforcer.speed})`
      );
      assert.equal(
        eliteEnforcer.xpValue,
        normalEnforcer.xpValue * 4,
        'Elite must award 4x XP value upon elimination'
      );
      assert.equal(eliteEnforcer.eliteColor, '#ffd700');
    });

    it('should initialize Phantom and Colossus archetypes with distinct combat attributes', () => {
      const phantom = new Enemy(0, 0, 'phantom', 4, 8);
      assert.equal(phantom.type, 'phantom');
      assert.ok(phantom.speed >= 180, 'Phantom must have high base agility');
      assert.equal(phantom.color, '#00ffcc');
      assert.ok(phantom.teleportCooldown > 0);

      const colossus = new Enemy(0, 0, 'colossus', 5, 10);
      assert.equal(colossus.type, 'colossus');
      assert.ok(colossus.health >= 300, `Colossus must be an armored titan (health: ${colossus.health})`);
      assert.equal(colossus.color, '#ff0033');
      assert.ok(colossus.radius >= 28, 'Colossus has large hitbox');
    });
  });

  describe('3. LightingEngine Infinite Arena Verification', () => {
    it('should initialize LightingEngine in infinite mode without errors', () => {
      const engine = new LightingEngine(Infinity, Infinity);
      assert.equal(engine.isInfinite, true);
      assert.equal(engine.gridSpacing, 90);
    });
  });
});
