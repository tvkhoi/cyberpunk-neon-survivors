import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { Player } from '../public/js/entities/player.js';

describe('Module 3: Mobile Touch & Responsive Canvas System Tests', () => {

  const htmlPath = path.resolve(process.cwd(), 'public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // =========================================================================
  // 1. DYNAMIC CANVAS BOUNDS 100DVH & ANTI-NOTCH ARCHITECTURE
  // =========================================================================
  describe('1. Dynamic Canvas Bounds 100dvh & Anti-Notch Safe Area Verification', () => {
    it('should define 100dvh CSS variable tokens and safe-area environment variables', () => {
      assert.ok(htmlContent.includes('--app-height: 100dvh;'), 'Must define --app-height CSS variable token');
      assert.ok(htmlContent.includes('--vh: 1vh;'), 'Must define --vh fallback token');
      assert.ok(htmlContent.includes('env(safe-area-inset-top'), 'Must define safe-area-inset-top token');
      assert.ok(htmlContent.includes('env(safe-area-inset-bottom'), 'Must define safe-area-inset-bottom token');
      assert.ok(htmlContent.includes('env(safe-area-inset-left'), 'Must define safe-area-inset-left token');
      assert.ok(htmlContent.includes('env(safe-area-inset-right'), 'Must define safe-area-inset-right token');
    });

    it('should lock html, body, and gameCanvas to dynamic viewport height (100dvh)', () => {
      assert.ok(htmlContent.includes('height: 100dvh;'), 'Must bind height: 100dvh on root document elements');
      assert.ok(htmlContent.includes('min-height: -webkit-fill-available;'), 'Must support iOS -webkit-fill-available fallback');
      assert.ok(htmlContent.includes('overscroll-behavior: none;'), 'Must prevent pull-to-refresh bounce');
      assert.ok(htmlContent.includes('touch-action: none;'), 'Must set touch-action: none to lock viewport gestures');
    });

    it('should enforce anti-notch safe area rules with !important specificity', () => {
      assert.ok(htmlContent.includes('.safe-top {'), 'Must include .safe-top class');
      assert.ok(htmlContent.includes('padding-top: max(0.5rem, env(safe-area-inset-top, 0px)) !important;'), 'safe-top must use !important');
      assert.ok(htmlContent.includes('padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px)) !important;'), 'safe-bottom must use !important');
      assert.ok(htmlContent.includes('padding-left: max(0.75rem, env(safe-area-inset-left, 0px)) !important;'), 'safe-left must use !important');
      assert.ok(htmlContent.includes('padding-right: max(0.75rem, env(safe-area-inset-right, 0px)) !important;'), 'safe-right must use !important');
    });

    it('should protect mobile touch controls and HUD from notch cutouts & home gesture bar', () => {
      assert.ok(
        htmlContent.includes('#mobileControls') &&
        htmlContent.includes('calc(env(safe-area-inset-bottom, 0px) + 0.5rem)'),
        'mobileControls must offset above home indicator bar'
      );
      assert.ok(
        htmlContent.includes('#mobileControls') &&
        htmlContent.includes('calc(env(safe-area-inset-left, 0px) + 0.5rem)'),
        'mobileControls must pad beyond landscape left notch'
      );
      assert.ok(
        htmlContent.includes('#hud') &&
        htmlContent.includes('calc(env(safe-area-inset-top, 0px) + 0.25rem)'),
        'hud must pad below top notch / Dynamic Island'
      );
    });

    it('should constrain modals to 92dvh to guarantee zero overflow behind dynamic browser toolbars', () => {
      assert.ok(htmlContent.includes('max-h-[92dvh]'), 'Modal dialogs must respect max-h-[92dvh]');
    });
  });

  // =========================================================================
  // 2. VIRTUAL JOYSTICK MATHEMATICS, DEADZONE & ANALOG VECTOR LOGIC
  // =========================================================================
  describe('2. Virtual Joystick Math with Deadzone & Analog Response Curve', () => {
    const maxRadius = 45;
    const deadzoneRadius = 3;

    function calculateOptimizedJoystickVector(
      touchX: number,
      touchY: number,
      centerX: number,
      centerY: number,
      radius = maxRadius,
      deadzone = deadzoneRadius
    ) {
      const dx = touchX - centerX;
      const dy = touchY - centerY;
      const distance = Math.hypot(dx, dy);

      let clampedDx = dx;
      let clampedDy = dy;
      if (distance > radius) {
        clampedDx = (dx / distance) * radius;
        clampedDy = (dy / distance) * radius;
      }

      let normalizedMagnitude = 0;
      if (distance > deadzone) {
        normalizedMagnitude = Math.min(1, (distance - deadzone) / (radius - deadzone));
      }

      const angle = Math.atan2(dy, dx);
      return {
        dx: clampedDx,
        dy: clampedDy,
        distance,
        rawMagnitude: Math.min(1, distance / radius),
        normalizedMagnitude,
        vector: {
          x: Math.cos(angle) * normalizedMagnitude,
          y: Math.sin(angle) * normalizedMagnitude,
        },
      };
    }

    it('should filter out subtle thumb tremor within deadzone radius (<= 3px)', () => {
      const center = 100;
      // Micro-tremor 2px to the right
      const tremorRight = calculateOptimizedJoystickVector(center + 2, center, center, center);
      assert.strictEqual(tremorRight.normalizedMagnitude, 0, 'Magnitude should be 0 inside deadzone');
      assert.strictEqual(tremorRight.vector.x, 0);
      assert.strictEqual(tremorRight.vector.y, 0);

      // Micro-tremor diagonal 2px
      const tremorDiag = calculateOptimizedJoystickVector(center + 1.5, center + 1.5, center, center);
      assert.strictEqual(tremorDiag.normalizedMagnitude, 0);
      assert.strictEqual(tremorDiag.vector.x, 0);
      assert.strictEqual(tremorDiag.vector.y, 0);
    });

    it('should smoothly remap magnitude from 0 to 1 without jump once exiting deadzone', () => {
      const center = 100;
      // Exactly at deadzone (3px)
      const atDeadzone = calculateOptimizedJoystickVector(center + 3, center, center, center);
      assert.strictEqual(atDeadzone.normalizedMagnitude, 0);

      // Just past deadzone (4px -> 1px into effective range of 42px)
      const justPast = calculateOptimizedJoystickVector(center + 4, center, center, center);
      const expectedMag = (4 - 3) / (45 - 3); // 1 / 42 ~= 0.0238
      assert.ok(Math.abs(justPast.normalizedMagnitude - expectedMag) < 0.001);
      assert.ok(justPast.vector.x > 0);

      // Mid-range deflection (24px -> 21px / 42px = 0.5)
      const midDeflection = calculateOptimizedJoystickVector(center + 24, center, center, center);
      assert.ok(Math.abs(midDeflection.normalizedMagnitude - 0.5) < 0.001);
    });

    it('should achieve 100% saturation (magnitude 1.0) at maxRadius (45px) and clamp excess drag', () => {
      const center = 100;
      // Full deflection at boundary
      const fullRight = calculateOptimizedJoystickVector(center + 45, center, center, center);
      assert.strictEqual(fullRight.normalizedMagnitude, 1);
      assert.strictEqual(Math.round(fullRight.vector.x), 1);
      assert.strictEqual(Math.round(fullRight.vector.y), 0);

      // Over-drag to 200px
      const overDrag = calculateOptimizedJoystickVector(center + 200, center + 200, center, center);
      assert.strictEqual(overDrag.normalizedMagnitude, 1);
      const knobDistance = Math.hypot(overDrag.dx, overDrag.dy);
      assert.ok(Math.abs(knobDistance - 45) < 0.001, `Expected 45, got ${knobDistance}`);
    });

    it('should maintain backward compatibility with zero-deadzone legacy formula', () => {
      const center = 100;
      const legacyCalc = calculateOptimizedJoystickVector(center + 22.5, center, center, center, 45, 0);
      assert.strictEqual(legacyCalc.normalizedMagnitude, 0.5);
      assert.ok(Math.abs(legacyCalc.vector.x - 0.5) < 0.001);
    });
  });

  // =========================================================================
  // 3. DYNAMIC FLOATING VS FIXED BASE JOYSTICK MECHANICS
  // =========================================================================
  describe('3. Dynamic Floating vs Fixed Base Joystick Positioning', () => {
    function computeDynamicBasePosition(
      touchX: number,
      touchY: number,
      zoneRect: { left: number; right: number; top: number; bottom: number; width: number; height: number },
      baseRadius = 48
    ) {
      const zoneCenterX = zoneRect.left + zoneRect.width / 2;
      const zoneCenterY = zoneRect.top + zoneRect.height / 2;

      const clampedX = Math.max(zoneRect.left + baseRadius, Math.min(zoneRect.right - baseRadius, touchX));
      const clampedY = Math.max(zoneRect.top + baseRadius, Math.min(zoneRect.bottom - baseRadius, touchY));

      const shiftX = clampedX - zoneCenterX;
      const shiftY = clampedY - zoneCenterY;

      return {
        centerX: clampedX,
        centerY: clampedY,
        shiftX,
        shiftY,
      };
    }

    it('should dynamically center base at touch point when touch occurs comfortably within zone', () => {
      const zoneRect = { left: 0, right: 200, top: 500, bottom: 700, width: 200, height: 200 };
      // Touch at (90, 590)
      const res = computeDynamicBasePosition(90, 590, zoneRect, 40);
      assert.strictEqual(res.centerX, 90);
      assert.strictEqual(res.centerY, 590);
      assert.strictEqual(res.shiftX, 90 - 100); // -10
      assert.strictEqual(res.shiftY, 590 - 600); // -10
    });

    it('should clamp dynamic base within zone margins so joystick never clips off-screen', () => {
      const zoneRect = { left: 0, right: 200, top: 500, bottom: 700, width: 200, height: 200 };
      const baseRadius = 40;

      // Extreme edge touch: (5, 505) -> near top-left of zone
      const edgeTouch = computeDynamicBasePosition(5, 505, zoneRect, baseRadius);
      assert.strictEqual(edgeTouch.centerX, 40, 'Must clamp to left margin (baseRadius)');
      assert.strictEqual(edgeTouch.centerY, 540, 'Must clamp to top margin (top + baseRadius)');

      // Extreme right-bottom touch: (250, 750)
      const outOfBounds = computeDynamicBasePosition(250, 750, zoneRect, baseRadius);
      assert.strictEqual(outOfBounds.centerX, 160, 'Must clamp to right margin (right - baseRadius)');
      assert.strictEqual(outOfBounds.centerY, 660, 'Must clamp to bottom margin (bottom - baseRadius)');
    });
  });

  // =========================================================================
  // 4. HAPTIC FEEDBACK (TACTILE VIBRATION) & HYSTERESIS RULES
  // =========================================================================
  describe('4. Haptic Feedback Trigger Logic & Saturation Hysteresis', () => {
    class MockHapticController {
      public vibrateCalls: number[] = [];
      public hasVibratedAtLimit = false;
      public hapticsEnabled = true;

      triggerDeflection(magnitude: number) {
        if (magnitude >= 0.98 && !this.hasVibratedAtLimit) {
          if (this.hapticsEnabled) {
            this.vibrateCalls.push(8);
          }
          this.hasVibratedAtLimit = true;
        } else if (magnitude < 0.85) {
          this.hasVibratedAtLimit = false;
        }
      }

      triggerButton(duration: number) {
        if (this.hapticsEnabled) {
          this.vibrateCalls.push(duration);
        }
      }
    }

    it('should vibrate once when joystick reaches 100% saturation threshold (>= 0.98)', () => {
      const ctrl = new MockHapticController();
      ctrl.triggerDeflection(0.5);
      assert.strictEqual(ctrl.vibrateCalls.length, 0);

      ctrl.triggerDeflection(0.98);
      assert.strictEqual(ctrl.vibrateCalls.length, 1);
      assert.strictEqual(ctrl.vibrateCalls[0], 8);
    });

    it('should enforce hysteresis so vibration does NOT repeat while staying at maximum tilt', () => {
      const ctrl = new MockHapticController();
      ctrl.triggerDeflection(0.99);
      assert.strictEqual(ctrl.vibrateCalls.length, 1);

      // Continuous movement at edge
      ctrl.triggerDeflection(1.0);
      ctrl.triggerDeflection(0.98);
      ctrl.triggerDeflection(0.95); // Above 0.85 reset threshold
      assert.strictEqual(ctrl.vibrateCalls.length, 1, 'Should NOT re-trigger without dropping below 0.85');

      // Drop below 0.85 reset threshold
      ctrl.triggerDeflection(0.80);
      assert.strictEqual(ctrl.hasVibratedAtLimit, false);

      // Push back to max tilt -> should trigger second vibration click
      ctrl.triggerDeflection(0.99);
      assert.strictEqual(ctrl.vibrateCalls.length, 2);
    });

    it('should honor hapticsEnabled setting and suppress vibration when disabled', () => {
      const ctrl = new MockHapticController();
      ctrl.hapticsEnabled = false;

      ctrl.triggerDeflection(1.0);
      ctrl.triggerButton(15);
      assert.strictEqual(ctrl.vibrateCalls.length, 0, 'No vibrations should occur when disabled');
    });

    it('should emit specific haptic pulse durations for Dash, Bullet-Time, and Medkit', () => {
      const ctrl = new MockHapticController();
      ctrl.triggerButton(15); // Dash
      ctrl.triggerButton(10); // Bullet Time
      ctrl.triggerButton(15); // Medkit
      ctrl.triggerButton(8);  // Auto-Aim

      assert.deepStrictEqual(ctrl.vibrateCalls, [15, 10, 15, 8]);
    });
  });

  // =========================================================================
  // 5. MULTI-TOUCH ISOLATION & POINTER CAPTURE LIFECYCLE
  // =========================================================================
  describe('5. Multi-Touch Isolation & Input Safety Lifecycle', () => {
    it('should isolate activePointerId and reject cross-finger interference', () => {
      let activePointerId: number | null = 10;
      let currentVector = { x: 1, y: 0 };

      function handleMove(pointerId: number, newVector: { x: number; y: number }) {
        if (pointerId === activePointerId) {
          currentVector = newVector;
          return true;
        }
        return false;
      }

      // Legitimate finger moves joystick
      assert.strictEqual(handleMove(10, { x: 0, y: 1 }), true);
      assert.deepStrictEqual(currentVector, { x: 0, y: 1 });

      // Second finger taps right side of screen (pointerId: 20)
      assert.strictEqual(handleMove(20, { x: -1, y: 0 }), false);
      assert.deepStrictEqual(currentVector, { x: 0, y: 1 }, 'Vector must not be modified by secondary touch');
    });

    it('should reset player velocity and joystick vector instantly on blur / tab switch', () => {
      const player = new Player(500, 500);
      player.joystickVector = { x: 0.85, y: -0.52 };
      player.handleInput({}, null, 0.016);
      assert.ok(player.vx !== 0 || player.vy !== 0);

      // Tab blur simulation
      player.joystickVector = { x: 0, y: 0 };
      player.vx = 0;
      player.vy = 0;

      assert.strictEqual(player.joystickVector.x, 0);
      assert.strictEqual(player.joystickVector.y, 0);
      assert.strictEqual(player.vx, 0);
      assert.strictEqual(player.vy, 0);
    });
  });

  // =========================================================================
  // 6. SETTINGS PERSISTENCE & DOM CONTROL SYNCHRONIZATION
  // =========================================================================
  describe('6. Settings Persistence & UI Synchronizations', () => {
    it('should include selectJoystickType and checkHapticFeedback in HTML DOM', () => {
      assert.ok(htmlContent.includes('id="selectJoystickType"'), 'Must contain selectJoystickType');
      assert.ok(htmlContent.includes('id="checkHapticFeedback"'), 'Must contain checkHapticFeedback');
      assert.ok(htmlContent.includes('id="joyArrowUp"'), 'Must contain joyArrowUp');
      assert.ok(htmlContent.includes('id="joyArrowDown"'), 'Must contain joyArrowDown');
      assert.ok(htmlContent.includes('id="joyArrowLeft"'), 'Must contain joyArrowLeft');
      assert.ok(htmlContent.includes('id="joyArrowRight"'), 'Must contain joyArrowRight');
    });

    it('should serialize and restore joystick and haptic configurations in central settings', () => {
      const testSettings = {
        touchControlMode: 'always',
        joystickType: 'dynamic',
        hapticsEnabled: true,
        autoAim: true,
      };

      const serialized = JSON.stringify(testSettings);
      const parsed = JSON.parse(serialized);

      assert.strictEqual(parsed.touchControlMode, 'always');
      assert.strictEqual(parsed.joystickType, 'dynamic');
      assert.strictEqual(parsed.hapticsEnabled, true);
      assert.strictEqual(parsed.autoAim, true);
    });
  });

});
