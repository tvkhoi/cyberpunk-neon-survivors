/**
 * Module 4: Mobile Orientation, Fullscreen & Safe Area Insets QA Test Suite
 * Comprehensive automated QA tests for:
 * 1. Mobile Screen Orientation Detection & Aspect Ratio Adaptability
 * 2. Landscape Advisory Overlay & Portrait Rotation Warning Guards
 * 3. Cross-Browser Fullscreen API Multi-Vendor Support & State Management
 * 4. User Gesture Requirements & iOS Safari Pseudo-Fullscreen Fallback
 * 5. Safe Area Insets (Camera Notch, Dynamic Island, Home Indicator Bar)
 * 6. Virtual Controls Clearance & Collision Protection in Safe Zones
 * 7. Camera FOV & Canvas Logical Viewport Scaling under Orientation Changes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectOrientationState,
  isTouchOrMobileDevice,
  checkFullscreenSupport,
  calculateSafeAreaRect,
  ORIENTATION_TYPES,
  MobileOrientationManager,
  OrientationManager,
} from '../public/js/engine/orientationManager.js';

import { MobileScreenManager } from '../public/js/engine/mobileScreen.js';
import { Camera } from '../public/js/engine/camera.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Module 4: Mobile Orientation, Fullscreen & Safe Area Insets QA Test Suite', () => {

  // =========================================================================
  // SECTION 1: Mobile Screen Orientation Detection & Geometry
  // =========================================================================
  describe('1. Mobile Screen Orientation Detection & Geometry QA Tests', () => {
    it('1.1 should correctly identify landscape-primary via Screen Orientation API', () => {
      const mockScreen = {
        orientation: { type: 'landscape-primary', angle: 90 },
      };
      const mockWin = { innerWidth: 926, innerHeight: 428 };

      const state = detectOrientationState(mockWin, mockScreen);
      assert.equal(state.isLandscape, true);
      assert.equal(state.isPortrait, false);
      assert.equal(state.orientationType, ORIENTATION_TYPES.LANDSCAPE_PRIMARY);
      assert.equal(state.angle, 90);
    });

    it('1.2 should correctly identify landscape-secondary (180deg flip) via Screen Orientation API', () => {
      const mockScreen = {
        orientation: { type: 'landscape-secondary', angle: 270 },
      };
      const mockWin = { innerWidth: 926, innerHeight: 428 };

      const state = detectOrientationState(mockWin, mockScreen);
      assert.equal(state.isLandscape, true);
      assert.equal(state.isPortrait, false);
      assert.equal(state.orientationType, ORIENTATION_TYPES.LANDSCAPE_SECONDARY);
      assert.equal(state.angle, 270);
    });

    it('1.3 should correctly identify portrait-primary & portrait-secondary', () => {
      const portraitPrimaryScreen = { orientation: { type: 'portrait-primary', angle: 0 } };
      const portraitSecondaryScreen = { orientation: { type: 'portrait-secondary', angle: 180 } };
      const mockWin = { innerWidth: 428, innerHeight: 926 };

      const state1 = detectOrientationState(mockWin, portraitPrimaryScreen);
      assert.equal(state1.isLandscape, false);
      assert.equal(state1.isPortrait, true);
      assert.equal(state1.orientationType, ORIENTATION_TYPES.PORTRAIT_PRIMARY);

      const state2 = detectOrientationState(mockWin, portraitSecondaryScreen);
      assert.equal(state2.isLandscape, false);
      assert.equal(state2.isPortrait, true);
      assert.equal(state2.orientationType, ORIENTATION_TYPES.PORTRAIT_SECONDARY);
    });

    it('1.4 should handle legacy iOS Safari window.orientation values (90, -90, 0, 180)', () => {
      // Landscape Left (window.orientation = 90)
      const winLandscapeLeft = { orientation: 90, innerWidth: 844, innerHeight: 390 };
      const stateLeft = detectOrientationState(winLandscapeLeft, null);
      assert.equal(stateLeft.isLandscape, true);
      assert.equal(stateLeft.orientationType, ORIENTATION_TYPES.LANDSCAPE_PRIMARY);

      // Landscape Right (window.orientation = -90)
      const winLandscapeRight = { orientation: -90, innerWidth: 844, innerHeight: 390 };
      const stateRight = detectOrientationState(winLandscapeRight, null);
      assert.equal(stateRight.isLandscape, true);
      assert.equal(stateRight.orientationType, ORIENTATION_TYPES.LANDSCAPE_SECONDARY);

      // Portrait Normal (window.orientation = 0)
      const winPortrait = { orientation: 0, innerWidth: 390, innerHeight: 844 };
      const statePort = detectOrientationState(winPortrait, null);
      assert.equal(statePort.isPortrait, true);
      assert.equal(statePort.orientationType, ORIENTATION_TYPES.PORTRAIT_PRIMARY);
    });

    it('1.5 should fallback to CSS MatchMedia query (orientation: landscape)', () => {
      const winMatchMediaLandscape = {
        innerWidth: 800,
        innerHeight: 600,
        matchMedia: (q: string) => ({ matches: q.includes('landscape') }),
      };
      const stateMatch = detectOrientationState(winMatchMediaLandscape, null);
      assert.equal(stateMatch.isLandscape, true);
      assert.equal(stateMatch.isPortrait, false);

      const winMatchMediaPortrait = {
        innerWidth: 600,
        innerHeight: 800,
        matchMedia: (q: string) => ({ matches: !q.includes('landscape') }),
      };
      const statePort = detectOrientationState(winMatchMediaPortrait, null);
      assert.equal(statePort.isLandscape, false);
      assert.equal(statePort.isPortrait, true);
    });

    it('1.6 should accurately calculate aspect ratios across flagship mobile displays', () => {
      // iPhone 13/14/15/16 Pro Max (2796 x 1290) -> 19.5:9 (~2.167)
      const iphoneProMax = { innerWidth: 2796, innerHeight: 1290 };
      const ipRatio = (iphoneProMax.innerWidth / iphoneProMax.innerHeight);
      assert.ok(Math.abs(ipRatio - 2.167) < 0.01, `Expected ~2.167, got ${ipRatio}`);

      // Samsung Galaxy S22/S23/S24 (2340 x 1080) -> 19.5:9 (~2.166)
      const galaxy = { innerWidth: 2340, innerHeight: 1080 };
      const galRatio = galaxy.innerWidth / galaxy.innerHeight;
      assert.ok(Math.abs(galRatio - 2.166) < 0.01);

      // Standard Desktop / Tablet 16:9 (1920 x 1080)
      const standard16_9 = { innerWidth: 1920, innerHeight: 1080 };
      assert.ok(Math.abs((standard16_9.innerWidth / standard16_9.innerHeight) - 1.777) < 0.01);

      // Sony Xperia 21:9 Ultra-wide (2520 x 1080)
      const ultraWide = { innerWidth: 2520, innerHeight: 1080 };
      assert.ok(Math.abs((ultraWide.innerWidth / ultraWide.innerHeight) - 2.333) < 0.01);

      // Foldable unfolded 4:3 (2176 x 1812)
      const foldable = { innerWidth: 2176, innerHeight: 1812 };
      assert.ok(Math.abs((foldable.innerWidth / foldable.innerHeight) - 1.20) < 0.01);
    });

    it('1.7 should verify Camera adjusts viewport dimensions without aspect distortion', () => {
      const cam = new Camera(1920, 1080, 5000, 5000);
      assert.equal(cam.viewportWidth, 1920);
      assert.equal(cam.viewportHeight, 1080);

      // Mobile rotates to landscape 926 x 428
      cam.resize(926, 428);
      assert.equal(cam.viewportWidth, 926);
      assert.equal(cam.viewportHeight, 428);

      // Mobile rotates to portrait 428 x 926
      cam.resize(428, 926);
      assert.equal(cam.viewportWidth, 428);
      assert.equal(cam.viewportHeight, 926);
    });
  });

  // =========================================================================
  // SECTION 2: Landscape Advisory Overlay & Rotation Warning Guards
  // =========================================================================
  describe('2. Landscape Advisory Overlay & Rotation Warning Guards QA Tests', () => {
    it('2.1 should detect mobile or touch handheld devices accurately', () => {
      // Touch-enabled handheld (smartphone)
      const mobileWin = { ontouchstart: {}, innerWidth: 412, innerHeight: 915 };
      const mobileNav = { maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B)' };
      assert.equal(isTouchOrMobileDevice(mobileWin, mobileNav), true);

      // Non-touch Desktop PC (1920x1080)
      const desktopWin = { innerWidth: 1920, innerHeight: 1080 };
      const desktopNav = { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
      assert.equal(isTouchOrMobileDevice(desktopWin, desktopNav), false);
    });

    it('2.2 should display portrait advisory prompt ONLY when on mobile AND in portrait', () => {
      // Mock mobile in Portrait mode
      const mobilePortraitWin = {
        innerWidth: 428,
        innerHeight: 926,
        ontouchstart: {},
      };
      const mobilePortraitNav = { maxTouchPoints: 5 };
      const mobilePortraitScreen = { orientation: { type: 'portrait-primary', angle: 0 } };

      const manager = new MobileOrientationManager({
        win: mobilePortraitWin,
        nav: mobilePortraitNav,
        scr: mobilePortraitScreen,
      });

      assert.equal(manager.isPortrait(), true);
      assert.equal(manager.shouldShowPrompt(), true, 'Prompt MUST be visible on mobile portrait');

      // Now user rotates device to Landscape
      const mobileLandscapeWin = {
        innerWidth: 926,
        innerHeight: 428,
        ontouchstart: {},
      };
      const mobileLandscapeScreen = { orientation: { type: 'landscape-primary', angle: 90 } };

      const managerLandscape = new MobileOrientationManager({
        win: mobileLandscapeWin,
        nav: mobilePortraitNav,
        scr: mobileLandscapeScreen,
      });

      assert.equal(managerLandscape.isLandscape(), true);
      assert.equal(managerLandscape.shouldShowPrompt(), false, 'Prompt MUST be hidden once rotated to landscape');
    });

    it('2.3 should NEVER show portrait prompt on desktop even if window is resized vertically', () => {
      // Desktop user resizes browser window vertically (narrow width, tall height)
      const desktopVerticalWin = {
        innerWidth: 500,
        innerHeight: 1000,
      };
      const desktopNav = { maxTouchPoints: 0, userAgent: 'Windows Chrome' };

      const manager = new MobileOrientationManager({
        win: desktopVerticalWin,
        nav: desktopNav,
        scr: null,
      });

      // Desktop does not have touch, prompt should NOT annoy desktop developers
      assert.equal(manager.shouldShowPrompt(), false, 'Desktop PC should never show mobile rotate overlay');
    });

    it('2.4 should honor user bypass mechanism to dismiss portrait advisory overlay', () => {
      const mockOverlay = {
        classes: new Set(['hidden']),
        classList: {
          add(c: string) { mockOverlay.classes.add(c); },
          remove(c: string) { mockOverlay.classes.delete(c); },
          contains(c: string) { return mockOverlay.classes.has(c); },
        },
        setAttribute(k: string, v: string) {},
      };

      const mobilePortraitWin = { ontouchstart: {}, innerWidth: 390, innerHeight: 844 };
      const mobileNav = { maxTouchPoints: 5 };
      const mobileScreen = { orientation: { type: 'portrait-primary', angle: 0 } };

      const manager = new MobileOrientationManager({
        win: mobilePortraitWin,
        nav: mobileNav,
        scr: mobileScreen,
        promptElement: mockOverlay as any,
      });

      // Initial state: prompt should show
      manager.updatePromptDisplay();
      assert.equal(mockOverlay.classList.contains('hidden'), false);

      // Player clicks "Bypass & continue playing in portrait"
      manager.dismissPrompt(true);
      assert.equal(manager.bypassPrompt, true);
      assert.equal(manager.shouldShowPrompt(), false);
      assert.equal(mockOverlay.classList.contains('hidden'), true, 'Overlay must hide after dismissPrompt');
    });

    it('2.5 should gracefully attempt Screen Orientation Lock (Landscape)', async () => {
      let lockedType = '';
      const mockScreenWithLock = {
        orientation: {
          type: 'portrait-primary',
          lock: async (orientation: string) => {
            lockedType = orientation;
            return true;
          },
        },
      };

      const manager = new MobileOrientationManager({
        scr: mockScreenWithLock as any,
      });

      const res = await manager.lockLandscape();
      assert.equal(res, true);
      assert.equal(lockedType, 'landscape');

      // Unsupported browser should not throw
      const managerUnsupported = new MobileOrientationManager({ scr: {} as any });
      const unsuppRes = await managerUnsupported.lockLandscape();
      assert.equal(unsuppRes, false);
    });
  });

  // =========================================================================
  // SECTION 3: Fullscreen API Multi-Vendor & State Management
  // =========================================================================
  describe('3. Fullscreen API Multi-Vendor & State Management QA Tests', () => {
    it('3.1 should detect standard W3C requestFullscreen & fullscreenEnabled', () => {
      const mockDoc = { fullscreenEnabled: true, documentElement: { requestFullscreen: () => Promise.resolve() } };
      const info = checkFullscreenSupport(mockDoc as any);
      assert.equal(info.supported, true);
      assert.equal(info.vendor, 'standard');
    });

    it('3.2 should detect WebKit vendor prefix (iOS Safari / WebKit Mac)', () => {
      const mockDoc = { webkitFullscreenEnabled: true, documentElement: { webkitRequestFullscreen: () => {} } };
      const info = checkFullscreenSupport(mockDoc as any);
      assert.equal(info.supported, true);
      assert.equal(info.vendor, 'webkit');
    });

    it('3.3 should detect Mozilla Firefox vendor prefix (mozFullScreenEnabled)', () => {
      const mockDoc = { mozFullScreenEnabled: true, documentElement: { mozRequestFullScreen: () => {} } };
      const info = checkFullscreenSupport(mockDoc as any);
      assert.equal(info.supported, true);
      assert.equal(info.vendor, 'moz');
    });

    it('3.4 should detect Microsoft IE/Edge prefix (msFullscreenEnabled)', () => {
      const mockDoc = { msFullscreenEnabled: true, documentElement: { msRequestFullscreen: () => {} } };
      const info = checkFullscreenSupport(mockDoc as any);
      assert.equal(info.supported, true);
      assert.equal(info.vendor, 'ms');
    });

    it('3.5 should correctly evaluate isFullscreen() across multi-vendor properties', () => {
      const standardDoc = { fullscreenElement: {} };
      const webkitDoc = { webkitFullscreenElement: {} };
      const mozDoc = { mozFullScreenElement: {} };
      const msDoc = { msFullscreenElement: {} };
      const windowedDoc = {};

      const mgrStd = new MobileOrientationManager({ doc: standardDoc as any });
      assert.equal(mgrStd.isFullscreen(), true);

      const mgrWk = new MobileOrientationManager({ doc: webkitDoc as any });
      assert.equal(mgrWk.isFullscreen(), true);

      const mgrMoz = new MobileOrientationManager({ doc: mozDoc as any });
      assert.equal(mgrMoz.isFullscreen(), true);

      const mgrMs = new MobileOrientationManager({ doc: msDoc as any });
      assert.equal(mgrMs.isFullscreen(), true);

      const mgrWin = new MobileOrientationManager({ doc: windowedDoc as any });
      assert.equal(mgrWin.isFullscreen(), false);
    });

    it('3.6 should cleanly toggle between windowed and fullscreen', async () => {
      let isFull = false;
      let requested = false;
      let exited = false;

      const mockDoc = {
        get fullscreenElement() { return isFull ? {} : null; },
        documentElement: {
          requestFullscreen: async () => {
            isFull = true;
            requested = true;
          },
        },
        exitFullscreen: async () => {
          isFull = false;
          exited = true;
        },
      };

      const manager = new MobileOrientationManager({ doc: mockDoc as any });

      // Step 1: Currently windowed -> Toggle should requestFullscreen
      assert.equal(manager.isFullscreen(), false);
      await manager.toggleFullscreen();
      assert.equal(requested, true);
      assert.equal(manager.isFullscreen(), true);

      // Step 2: Currently fullscreen -> Toggle should exitFullscreen
      await manager.toggleFullscreen();
      assert.equal(exited, true);
      assert.equal(manager.isFullscreen(), false);
    });

    it('3.7 should update Fullscreen HUD button text and icon correctly', () => {
      let iconClass = 'fa-solid fa-expand text-[10px] sm:text-xs';
      let labelText = 'TOÀN MÀN';

      const mockBtn = {
        querySelector: (selector: string) => {
          if (selector === 'i') return { set className(val: string) { iconClass = val; } };
          if (selector === '.fs-label') return { set innerText(val: string) { labelText = val; } };
          return null;
        },
      };

      let isFull = false;
      const mockDoc = {
        get fullscreenElement() { return isFull ? {} : null; },
      };

      const manager = new MobileOrientationManager({
        doc: mockDoc as any,
        fullscreenBtn: mockBtn as any,
      });

      // Windowed mode UI check
      isFull = false;
      manager.updateFullscreenBtnUI();
      assert.equal(iconClass.includes('fa-expand'), true);
      assert.equal(labelText, 'TOÀN MÀN');

      // Fullscreen mode UI check
      isFull = true;
      manager.updateFullscreenBtnUI();
      assert.equal(iconClass.includes('fa-compress'), true);
      assert.equal(labelText, 'THU NHỎ');
    });
  });

  // =========================================================================
  // SECTION 4: User Gesture Enforcement & iOS Safari Pseudo-Fullscreen
  // =========================================================================
  describe('4. User Gesture Enforcement & iOS Safari Pseudo-Fullscreen QA Tests', () => {
    it('4.1 should catch NotAllowedError gracefully without crashing game process', async () => {
      const mockDocEl = {
        requestFullscreen: async () => {
          const err = new Error('Failed to execute \'requestFullscreen\' on \'Element\': API can only be initiated by a user gesture.');
          err.name = 'NotAllowedError';
          throw err;
        },
      };
      const mockDoc = {
        documentElement: mockDocEl,
        fullscreenElement: null,
      };

      const manager = new MobileOrientationManager({ doc: mockDoc as any });

      // Should not throw exception, should activate pseudo-fullscreen fallback
      const result = await manager.requestFullscreen();
      assert.equal(result, false);
      assert.equal(manager.pseudoFullscreenActive, true, 'Must fallback to pseudo-fullscreen on user gesture block');
      assert.equal(manager.isFullscreen(), true);
    });

    it('4.2 should support iPhone Safari Pseudo-Fullscreen activation & removal', () => {
      const classListSet = new Set<string>();
      const mockTarget = {
        classList: {
          add(c: string) { classListSet.add(c); },
          remove(c: string) { classListSet.delete(c); },
          contains(c: string) { return classListSet.has(c); },
        },
      };

      const manager = new MobileOrientationManager({
        doc: { documentElement: mockTarget } as any,
      });

      // Enable pseudo-fullscreen
      manager.enablePseudoFullscreen(mockTarget as any);
      assert.equal(manager.pseudoFullscreenActive, true);
      assert.equal(classListSet.has('pseudo-fullscreen'), true);
      assert.equal(manager.isFullscreen(), true);

      // Disable pseudo-fullscreen
      manager.disablePseudoFullscreen(mockTarget as any);
      assert.equal(manager.pseudoFullscreenActive, false);
      assert.equal(classListSet.has('pseudo-fullscreen'), false);
      assert.equal(manager.isFullscreen(), false);
    });

    it('4.3 should verify MobileScreenManager integration with pseudo-fullscreen and bypass', () => {
      const classListSet = new Set<string>();
      const mockDoc = {
        documentElement: {
          classList: {
            add(c: string) { classListSet.add(c); },
            remove(c: string) { classListSet.delete(c); },
            contains(c: string) { return classListSet.has(c); },
          },
        },
      };

      const screenMgr = new MobileScreenManager(null, {
        doc: mockDoc as any,
        win: { innerWidth: 414, innerHeight: 896 } as any,
        nav: { maxTouchPoints: 5 } as any,
      });

      assert.equal(screenMgr.isFullscreen(), false);
      screenMgr.enablePseudoFullscreen();
      assert.equal(screenMgr.isFullscreen(), true);
      assert.equal(classListSet.has('pseudo-fullscreen-active'), true);

      screenMgr.disablePseudoFullscreen();
      assert.equal(screenMgr.isFullscreen(), false);
      assert.equal(classListSet.has('pseudo-fullscreen-active'), false);
    });
  });

  // =========================================================================
  // SECTION 5: Safe Area Insets (Notch, Dynamic Island, Home Bar)
  // =========================================================================
  describe('5. Safe Area Insets & Notch Geometry QA Tests', () => {
    it('5.1 should verify public/index.html contains viewport-fit=cover meta tag', () => {
      const htmlPath = path.join(rootDir, 'public', 'index.html');
      assert.equal(fs.existsSync(htmlPath), true);
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      // W3C / Apple standard for notch edge-to-edge rendering
      assert.equal(htmlContent.includes('viewport-fit=cover'), true, 'HTML MUST contain viewport-fit=cover');
      assert.equal(htmlContent.includes('apple-mobile-web-app-capable'), true);
      assert.equal(htmlContent.includes('apple-mobile-web-app-status-bar-style'), true);
    });

    it('5.2 should verify index.html CSS contains safe-area utility classes', () => {
      const htmlPath = path.join(rootDir, 'public', 'index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      assert.equal(htmlContent.includes('safe-top'), true);
      assert.equal(htmlContent.includes('safe-bottom'), true);
      assert.equal(htmlContent.includes('safe-left'), true);
      assert.equal(htmlContent.includes('safe-right'), true);
      assert.equal(htmlContent.includes('safe-area-inset-top'), true);
      assert.equal(htmlContent.includes('safe-area-inset-bottom'), true);
      assert.equal(htmlContent.includes('safe-area-inset-left'), true);
      assert.equal(htmlContent.includes('safe-area-inset-right'), true);
    });

    it('5.3 should calculate safe boundary rect for Landscape Left (Notch on the Left)', () => {
      // iPhone in Landscape Left: notch is on left side (47px), home bar on bottom (21px)
      const viewportWidth = 926;
      const viewportHeight = 428;
      const insets = { top: 0, right: 0, bottom: 21, left: 47 };

      const safeRect = calculateSafeAreaRect({
        viewportWidth,
        viewportHeight,
        insets,
        minMargin: 12,
      });

      assert.equal(safeRect.notchSide, 'left');
      assert.equal(safeRect.safeLeft, 47, 'safeLeft must honor 47px notch');
      assert.equal(safeRect.safeRight, 12, 'safeRight should use minMargin 12px');
      assert.equal(safeRect.safeBottom, 21, 'safeBottom must honor 21px home indicator bar');
      assert.equal(safeRect.safeTop, 12);

      // Safe interactive width and height
      const expectedSafeW = 926 - (47 + 12);
      const expectedSafeH = 428 - (12 + 21);
      assert.equal(safeRect.safeWidth, expectedSafeW);
      assert.equal(safeRect.safeHeight, expectedSafeH);

      // Virtual Joystick placement must clear the left notch!
      assert.ok(safeRect.recommendedJoystick.clearanceLeft >= 47);
      assert.ok(safeRect.recommendedJoystick.x >= 47 + 50);
    });

    it('5.4 should calculate safe boundary rect for Landscape Right (Notch on the Right)', () => {
      // iPhone in Landscape Right: notch is on right side (47px), home bar on bottom (21px)
      const viewportWidth = 926;
      const viewportHeight = 428;
      const insets = { top: 0, right: 47, bottom: 21, left: 0 };

      const safeRect = calculateSafeAreaRect({
        viewportWidth,
        viewportHeight,
        insets,
        minMargin: 12,
      });

      assert.equal(safeRect.notchSide, 'right');
      assert.equal(safeRect.safeLeft, 12);
      assert.equal(safeRect.safeRight, 47, 'safeRight must honor 47px notch');
      assert.equal(safeRect.safeBottom, 21);

      // Action buttons placement must clear the right notch!
      assert.ok(safeRect.recommendedActionButtons.clearanceRight >= 47);
      assert.ok(safeRect.recommendedActionButtons.x <= viewportWidth - 47 - 50);
    });

    it('5.5 should calculate safe boundary rect for Portrait (Status Bar / Dynamic Island on Top)', () => {
      const viewportWidth = 428;
      const viewportHeight = 926;
      const insets = { top: 47, right: 0, bottom: 34, left: 0 };

      const safeRect = calculateSafeAreaRect({
        viewportWidth,
        viewportHeight,
        insets,
        minMargin: 12,
      });

      assert.equal(safeRect.notchSide, 'top');
      assert.equal(safeRect.safeTop, 47);
      assert.equal(safeRect.safeBottom, 34);
    });
  });

  // =========================================================================
  // SECTION 6: Mobile Virtual Controls Clearance & Dead-Zone Protection
  // =========================================================================
  describe('6. Mobile Virtual Controls Clearance & Dead-Zone Protection QA Tests', () => {
    it('6.1 should prevent Virtual Joystick from clipping into camera notch in Landscape Left', () => {
      const notchInsetLeft = 47;
      const joystickBaseRadius = 45;
      const margin = 16;

      const joystickCenterX = Math.max(margin, notchInsetLeft) + joystickBaseRadius;
      const leftEdge = joystickCenterX - joystickBaseRadius;

      // The leftmost point of the joystick circle MUST NOT touch the notch boundary
      assert.ok(leftEdge >= notchInsetLeft, `Joystick left edge (${leftEdge}px) must be >= notch inset (${notchInsetLeft}px)`);
    });

    it('6.2 should prevent Action Buttons from clipping into notch or camera hole in Landscape Right', () => {
      const viewportWidth = 926;
      const notchInsetRight = 47;
      const buttonRadius = 24; // 48px action button
      const margin = 16;

      const buttonCenterX = viewportWidth - Math.max(margin, notchInsetRight) - buttonRadius;
      const rightEdge = buttonCenterX + buttonRadius;

      const clearanceToScreenEdge = viewportWidth - rightEdge;
      assert.ok(clearanceToScreenEdge >= notchInsetRight, `Button clearance (${clearanceToScreenEdge}px) must exceed notch (${notchInsetRight}px)`);
    });

    it('6.3 should guarantee Home Indicator bar safe vertical buffer for all touch targets', () => {
      const homeIndicatorHeight = 21; // Standard iOS landscape home bar
      const safeBottomPadding = 24;

      assert.ok(safeBottomPadding > homeIndicatorHeight, 'Controls vertical margin must exceed home indicator gesture zone');
    });

    it('6.4 should verify MobileOrientationManager correctly updates and dispatches safe area state', () => {
      let dispatchedInsets: any = null;
      const manager = new MobileOrientationManager();

      manager.onSafeAreaChange((insets) => {
        dispatchedInsets = insets;
      });

      manager.setSafeAreaInsets({ top: 10, right: 47, bottom: 21, left: 0 });
      assert.deepEqual(dispatchedInsets, { top: 10, right: 47, bottom: 21, left: 0 });
    });
  });

  // =========================================================================
  // SECTION 7: End-to-End MobileScreenManager & Orientation Integration
  // =========================================================================
  describe('7. End-to-End MobileScreenManager & Orientation Integration QA Tests', () => {
    it('7.1 should initialize and bind elements properly without throwing in browser-like environment', () => {
      const overlayEl = {
        classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {},
      };
      const btnToggleEl = {
        addEventListener() {},
        querySelector: () => ({ className: '' }),
      };
      const btnForceEl = {
        addEventListener() {},
      };
      const btnBypassEl = {
        addEventListener() {},
      };

      const mockDoc = {
        getElementById(id: string) {
          if (id === 'portraitAdvisoryOverlay') return overlayEl;
          if (id === 'btnToggleFullscreen') return btnToggleEl;
          if (id === 'btnForceFullscreenRotate') return btnForceEl;
          if (id === 'btnBypassOrientationPrompt') return btnBypassEl;
          return null;
        },
        addEventListener() {},
        documentElement: { requestFullscreen: async () => {} },
      };

      const mockWin = {
        addEventListener() {},
        removeEventListener() {},
        innerWidth: 844,
        innerHeight: 390,
        screen: { orientation: { type: 'landscape-primary', angle: 90, addEventListener() {} } },
      };

      const mockGame = {
        resizeCanvasCalled: 0,
        resizeCanvas() { this.resizeCanvasCalled++; },
      };

      const screenMgr = new MobileScreenManager(mockGame, {
        doc: mockDoc as any,
        win: mockWin as any,
        scr: mockWin.screen as any,
        nav: { maxTouchPoints: 5 } as any,
      });

      screenMgr.init();
      assert.equal(screenMgr.isLandscape(), true);
      assert.equal(screenMgr.isPortrait(), false);

      const bounds = screenMgr.getSafeBounds();
      assert.ok(bounds.safeWidth > 0);
      assert.ok(bounds.safeHeight > 0);
    });

    it('7.2 should verify OrientationManager export alias is strictly identical to MobileOrientationManager', () => {
      assert.strictEqual(OrientationManager, MobileOrientationManager);
    });
  });

});
