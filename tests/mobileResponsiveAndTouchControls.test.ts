import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Player } from '../public/js/entities/player.js';

describe('Module 4: Mobile Responsive & Virtual Touch Controls Test Suite', () => {

  describe('1. Virtual Joystick Math & Analog Vector Calculation', () => {
    const maxRadius = 45;

    function calculateJoystickVector(touchX: number, touchY: number, centerX: number, centerY: number) {
      let dx = touchX - centerX;
      let dy = touchY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
      }

      const normalizedMagnitude = Math.min(1, distance / maxRadius);
      const angle = Math.atan2(dy, dx);
      return {
        dx,
        dy,
        distance,
        vector: {
          x: Math.cos(angle) * normalizedMagnitude,
          y: Math.sin(angle) * normalizedMagnitude,
        },
      };
    }

    it('should return zero vector when touch is at center (0,0)', () => {
      const res = calculateJoystickVector(100, 100, 100, 100);
      assert.strictEqual(res.dx, 0);
      assert.strictEqual(res.dy, 0);
      assert.strictEqual(res.distance, 0);
      assert.strictEqual(res.vector.x, 0);
      assert.strictEqual(res.vector.y, 0);
    });

    it('should accurately calculate cardinal directions (Up, Down, Left, Right)', () => {
      const center = 100;
      // Right (+X)
      const right = calculateJoystickVector(center + 45, center, center, center);
      assert.strictEqual(Math.round(right.vector.x), 1);
      assert.strictEqual(Math.round(right.vector.y), 0);

      // Left (-X)
      const left = calculateJoystickVector(center - 45, center, center, center);
      assert.strictEqual(Math.round(left.vector.x), -1);
      assert.strictEqual(Math.round(left.vector.y), 0);

      // Down (+Y)
      const down = calculateJoystickVector(center, center + 45, center, center);
      assert.strictEqual(Math.round(down.vector.x), 0);
      assert.strictEqual(Math.round(down.vector.y), 1);

      // Up (-Y)
      const up = calculateJoystickVector(center, center - 45, center, center);
      assert.strictEqual(Math.round(up.vector.x), 0);
      assert.strictEqual(Math.round(up.vector.y), -1);
    });

    it('should clamp displacement to maxRadius (45px) when finger drags outside base', () => {
      const center = 100;
      // Drag 150px to the right
      const dragFarRight = calculateJoystickVector(center + 150, center, center, center);
      assert.strictEqual(dragFarRight.dx, 45);
      assert.strictEqual(dragFarRight.dy, 0);
      assert.strictEqual(Math.round(dragFarRight.vector.x), 1);

      // Diagonal drag far top-left
      const dragFarDiagonal = calculateJoystickVector(center - 200, center - 200, center, center);
      const clampedDist = Math.hypot(dragFarDiagonal.dx, dragFarDiagonal.dy);
      assert(Math.abs(clampedDist - 45) < 0.001, `Expected 45, got ${clampedDist}`);
      assert(dragFarDiagonal.vector.x < 0);
      assert(dragFarDiagonal.vector.y < 0);
    });

    it('should scale vector magnitude proportionally for subtle analog movement', () => {
      const center = 100;
      // Half-tilt right (22.5px / 45px = 0.5 magnitude)
      const halfTilt = calculateJoystickVector(center + 22.5, center, center, center);
      assert(Math.abs(halfTilt.vector.x - 0.5) < 0.01);
      assert(Math.abs(halfTilt.vector.y) < 0.01);
    });
  });

  describe('2. Player Integration with Virtual Joystick Vector', () => {
    it('should update player velocity vx, vy from joystickVector', () => {
      const player = new Player(500, 500);
      player.joystickVector = { x: 1, y: 0 }; // Moving right
      player.handleInput({}, null, 0.016);

      assert(player.vx > 0, `Expected vx > 0, got ${player.vx}`);
      assert.strictEqual(player.vy, 0);
      assert.strictEqual(player.speed, player.baseSpeed);
    });

    it('should auto-face moving direction when auto-aim and manual aim are not active', () => {
      const player = new Player(500, 500);
      player.isAutoAiming = false;
      player.isManualAiming = false;

      // Moving diagonally down-right (45 deg = PI / 4)
      player.joystickVector = { x: 1, y: 1 };
      player.handleInput({}, null, 0.016);

      const expectedAngle = Math.PI / 4;
      assert(Math.abs(player.angle - expectedAngle) < 0.01, `Expected angle ${expectedAngle}, got ${player.angle}`);
    });

    it('should execute Dash correctly via player.dash() and trigger invulnerability', () => {
      const player = new Player(500, 500);
      assert.strictEqual(player.isDashing, false);
      assert.strictEqual(player.dashTimer, 0);

      const dashResult = player.dash();
      assert.strictEqual(dashResult, true);
      assert.strictEqual(player.isDashing, true);
      assert(player.dashTimer > 0);
      assert.strictEqual(player.isInvulnerable(), true);

      // Consecutive immediate dash should be rejected by cooldown
      const secondDash = player.dash();
      assert.strictEqual(secondDash, false);
    });

    it('should toggle bullet time cleanly with player.toggleBulletTime()', () => {
      const player = new Player(500, 500);
      player.energy = 100;
      assert.strictEqual(player.isBulletTime, false);

      // 1. Toggle ON
      const stateOn = player.toggleBulletTime();
      assert.strictEqual(stateOn, true);
      assert.strictEqual(player.isBulletTime, true);
      assert.strictEqual(player.touchBulletTimeToggle, true);

      // 2. Toggle OFF
      const stateOff = player.toggleBulletTime();
      assert.strictEqual(stateOff, false);
      assert.strictEqual(player.isBulletTime, false);
      assert.strictEqual(player.touchBulletTimeToggle, false);

      // 3. Reject toggle ON if energy is <= 15
      player.energy = 10;
      const rejectOn = player.toggleBulletTime();
      assert.strictEqual(rejectOn, false);
      assert.strictEqual(player.isBulletTime, false);
    });
  });

  describe('3. Auto-Aim Nearest Enemy Targeting Algorithm', () => {
    function findNearestEnemy(player: { x: number; y: number }, enemies: Array<{ id: string; x: number; y: number; health: number }>, maxRange = 650) {
      let nearest = null;
      let minDistanceSq = maxRange * maxRange;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.health <= 0) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          nearest = e;
        }
      }
      return nearest;
    }

    it('should select the nearest living enemy within maxRange', () => {
      const player = { x: 500, y: 500 };
      const enemies = [
        { id: 'far', x: 1000, y: 500, health: 100 },     // dist = 500
        { id: 'near', x: 620, y: 500, health: 100 },    // dist = 120
        { id: 'medium', x: 500, y: 750, health: 100 },  // dist = 250
      ];

      const target = findNearestEnemy(player, enemies);
      assert(target !== null);
      assert.strictEqual(target.id, 'near');
    });

    it('should ignore dead enemies (health <= 0) and target next closest living hostile', () => {
      const player = { x: 500, y: 500 };
      const enemies = [
        { id: 'dead_close', x: 510, y: 500, health: 0 },    // dist = 10, dead
        { id: 'dead_closer', x: 505, y: 500, health: -20 }, // dist = 5, dead
        { id: 'alive_next', x: 580, y: 500, health: 80 },    // dist = 80, living
      ];

      const target = findNearestEnemy(player, enemies);
      assert(target !== null);
      assert.strictEqual(target.id, 'alive_next');
    });

    it('should return null when all enemies are beyond 650px range', () => {
      const player = { x: 500, y: 500 };
      const enemies = [
        { id: 'too_far_1', x: 1200, y: 500, health: 100 }, // dist = 700 > 650
        { id: 'too_far_2', x: 500, y: 1500, health: 100 }, // dist = 1000 > 650
      ];

      const target = findNearestEnemy(player, enemies);
      assert.strictEqual(target, null);
    });

    it('should calculate precise targeting aim angle toward hostile', () => {
      const player = { x: 500, y: 500 };
      const target = { id: 'target_east', x: 650, y: 500, health: 100 }; // Due East (0 radians)

      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const aimAngle = Math.atan2(dy, dx);

      assert.strictEqual(aimAngle, 0);

      // Target South (Math.PI / 2 radians)
      const targetSouth = { id: 'target_south', x: 500, y: 700, health: 100 };
      const angleSouth = Math.atan2(targetSouth.y - player.y, targetSouth.x - player.x);
      assert.strictEqual(angleSouth, Math.PI / 2);
    });
  });

  describe('4. Central Settings & Responsive Viewport Rules', () => {
    it('should validate responsive touchControlMode modes: auto, always, never', () => {
      const validModes = ['auto', 'always', 'never'];

      const testModes = (mode: string) => {
        if (!validModes.includes(mode)) throw new Error(`Invalid mode: ${mode}`);
        return true;
      };

      assert.strictEqual(testModes('auto'), true);
      assert.strictEqual(testModes('always'), true);
      assert.strictEqual(testModes('never'), true);
      assert.throws(() => testModes('invalid'));
    });

    it('should accurately detect touch device capability', () => {
      function evaluateTouchControlsVisibility(mode: string, isTouchDevice: boolean) {
        if (mode === 'always') return true;
        if (mode === 'never') return false;
        return isTouchDevice; // 'auto'
      }

      // On mobile (touch device)
      assert.strictEqual(evaluateTouchControlsVisibility('auto', true), true);
      // On desktop (non-touch)
      assert.strictEqual(evaluateTouchControlsVisibility('auto', false), false);
      // Forced always
      assert.strictEqual(evaluateTouchControlsVisibility('always', false), true);
      // Forced never
      assert.strictEqual(evaluateTouchControlsVisibility('never', true), false);
    });
  });

});
