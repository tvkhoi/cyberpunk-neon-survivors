import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MobileScreenManager } from '../public/js/engine/mobileScreen.js';

describe('Module 2: Cyberpunk Portrait Overlay, UX Guard & PWA Manifest Landscape Test Suite', () => {
  const rootDir = process.cwd();
  let originalWindow: any;
  let originalDocument: any;
  let originalScreen: any;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    originalWindow = (global as any).window;
    originalDocument = (global as any).document;
    originalScreen = (global as any).screen;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    (global as any).document = originalDocument;
    (global as any).screen = originalScreen;
    try {
      delete (globalThis as any).navigator;
    } catch (_) {}
    if (originalNavigatorDescriptor) {
      try {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      } catch (_) {}
    }
  });

  function setMockNavigator(mockNav: any) {
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNav,
      configurable: true,
      writable: true,
    });
  }

  // =========================================================================
  // SECTION 1: PWA Web App Manifest Landscape Configuration
  // =========================================================================
  describe('1. PWA Manifest Landscape Settings', () => {
    it('1.1 should have manifest.json with orientation strictly set to landscape', () => {
      const manifestPath = path.resolve(rootDir, 'public/manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public directory');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      assert.equal(manifest.orientation, 'landscape', 'PWA orientation must be locked to landscape');
      assert.ok(
        manifest.display === 'fullscreen' || manifest.display === 'standalone',
        'PWA display mode must be fullscreen or standalone'
      );
      assert.equal(manifest.name, 'Cyberpunk Neon Survivors');
      assert.equal(manifest.short_name, 'NeonSurvivors');
      assert.equal(manifest.theme_color, '#05070f');
      assert.equal(manifest.background_color, '#05070f');
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
    });

    it('1.2 should have index.html referencing manifest.json and landscape meta tags', () => {
      const htmlPath = path.resolve(rootDir, 'public/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.match(html, /<link\s+rel="manifest"\s+href="\.\/manifest\.json"/i);
      assert.match(html, /name="screen-orientation"\s+content="landscape"/i);
      assert.match(html, /name="x5-orientation"\s+content="landscape"/i);
      assert.match(html, /name="mobile-web-app-capable"\s+content="yes"/i);
      assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/i);
      assert.match(html, /viewport-fit=cover/i);
    });
  });

  // =========================================================================
  // SECTION 2: Cyberpunk Portrait Overlay DOM Structure & Visual Elements
  // =========================================================================
  describe('2. Cyberpunk Portrait Overlay DOM & Visual Elements', () => {
    it('2.1 should contain the portraitAdvisoryOverlay container with high-z-index and cyberpunk styling', () => {
      const htmlPath = path.resolve(rootDir, 'public/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.ok(html.includes('id="portraitAdvisoryOverlay"'), 'Must contain portraitAdvisoryOverlay');
      assert.ok(html.includes('hologram-glass'), 'Must use hologram-glass styling');
      assert.ok(html.includes('neon-border-cyan'), 'Must feature neon-border-cyan glow');
      assert.ok(html.includes('backdrop-blur-xl') || html.includes('backdrop-blur-md'), 'Must have backdrop blur');
    });

    it('2.2 should include animated rotating phone hologram graphic', () => {
      const htmlPath = path.resolve(rootDir, 'public/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.ok(html.includes('animate-cyber-phone-rotate'), 'Must include rotating phone CSS animation');
      assert.ok(html.includes('fa-arrows-rotate'), 'Must include rotational indicators');
      assert.ok(html.includes('@keyframes cyberPhoneRotate'), 'Must define cyberPhoneRotate keyframes');
    });

    it('2.3 should display clear bilingual tactical instructions and UX Guard safety status', () => {
      const htmlPath = path.resolve(rootDir, 'public/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.ok(html.includes('VUI LÒNG XOAY NGANG THIẾT BỊ'), 'Must contain Vietnamese rotation prompt');
      assert.ok(html.includes('ROTATE DEVICE TO LANDSCAPE'), 'Must contain English tactical subtitle');
      assert.ok(html.includes('UX GUARD'), 'Must display UX GUARD badge');
      assert.ok(html.includes('TỰ ĐỘNG TẠM DỪNG'), 'Must notify player that game is safely paused');
    });

    it('2.4 should contain interactive action buttons (Force Fullscreen & Bypass Override)', () => {
      const htmlPath = path.resolve(rootDir, 'public/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.ok(html.includes('id="btnForceFullscreenRotate"'), 'Must contain primary action button');
      assert.ok(html.includes('id="btnBypassOrientationPrompt"'), 'Must contain secondary bypass button');
      assert.ok(html.includes('id="btnToggleFullscreen"'), 'Must contain HUD fullscreen button');
    });
  });

  // =========================================================================
  // SECTION 3: MobileScreenManager & UX Guard Engine Functionality
  // =========================================================================
  describe('3. MobileScreenManager & UX Guard Engine Logic', { concurrency: 1 }, () => {
    it('3.1 should correctly detect orientation from window dimensions', () => {
      const mockGame = { resizeCanvas: () => {} };
      const manager = new MobileScreenManager(mockGame as any);

      // Landscape: 844 x 390
      (global as any).window = {
        innerWidth: 844,
        innerHeight: 390,
        screen: {},
      };
      assert.equal(manager.isLandscape(), true);
      assert.equal(manager.isPortrait(), false);

      // Portrait: 390 x 844
      (global as any).window = {
        innerWidth: 390,
        innerHeight: 844,
        screen: {},
      };
      assert.equal(manager.isLandscape(), false);
      assert.equal(manager.isPortrait(), true);
    });

    it('3.2 should distinguish mobile touch devices from desktop mouse environments', () => {
      const mockGame = { resizeCanvas: () => {} };
      const manager = new MobileScreenManager(mockGame as any);

      // Desktop non-touch
      (global as any).window = { innerWidth: 1920, innerHeight: 1080 };
      setMockNavigator({ maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
      assert.equal(manager.isMobileDevice(), false);

      // Mobile touch (iPhone)
      (global as any).window = { innerWidth: 390, innerHeight: 844, ontouchstart: {} };
      setMockNavigator({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
      assert.equal(manager.isMobileDevice(), true);
    });

    it('3.3 UX Guard: should AUTO-PAUSE game when mobile device enters Portrait mode', () => {
      const mockGame = {
        isPaused: false,
        isGameOver: false,
        lastTime: 1000,
        resizeCanvas: () => {},
      };

      const manager = new MobileScreenManager(mockGame as any);
      let overlayVisible = false;
      manager.overlay = {
        classList: {
          add: (cls: string) => { if (cls === 'hidden') overlayVisible = false; },
          remove: (cls: string) => { if (cls === 'hidden') overlayVisible = true; },
        },
      } as any;

      // Set environment: Mobile in Portrait
      (global as any).window = {
        innerWidth: 390,
        innerHeight: 844,
        ontouchstart: {},
        screen: {},
      };
      setMockNavigator({ maxTouchPoints: 5, userAgent: 'iPhone' });

      manager.checkOrientationState();

      assert.equal(overlayVisible, true, 'Overlay must be visible in portrait');
      assert.equal(mockGame.isPaused, true, 'Game MUST be auto-paused by UX Guard');
      assert.equal(manager.wasAutoPausedByOrientation, true, 'Flag must record auto-pause by orientation');
    });

    it('3.4 UX Guard: should AUTO-RESUME game when mobile device returns to Landscape mode', () => {
      let clockResynced = false;
      const mockGame = {
        isPaused: true,
        isGameOver: false,
        lastTime: 1000,
        resizeCanvas: () => {},
      };

      const manager = new MobileScreenManager(mockGame as any);
      manager.wasAutoPausedByOrientation = true; // previously paused by UX Guard

      let overlayVisible = true;
      manager.overlay = {
        classList: {
          add: (cls: string) => { if (cls === 'hidden') overlayVisible = false; },
          remove: (cls: string) => { if (cls === 'hidden') overlayVisible = true; },
        },
      } as any;

      // Rotate to Landscape: 844 x 390
      (global as any).window = {
        innerWidth: 844,
        innerHeight: 390,
        ontouchstart: {},
        screen: {},
        performance: {
          now: () => {
            clockResynced = true;
            return 2500;
          },
        },
      };
      setMockNavigator({ maxTouchPoints: 5, userAgent: 'iPhone' });

      manager.checkOrientationState();

      assert.equal(overlayVisible, false, 'Overlay must be hidden in landscape');
      assert.equal(mockGame.isPaused, false, 'Game MUST be resumed automatically');
      assert.equal(manager.wasAutoPausedByOrientation, false, 'Auto-pause flag must be cleared');
      assert.equal(clockResynced, true, 'Game loop clock performance.now() must be resynced');
      assert.equal(mockGame.lastTime, 2500, 'Game lastTime must be updated to avoid time accumulator jump');
    });

    it('3.5 UX Guard: should NOT unpause if player was manually paused prior to portrait rotation', () => {
      const mockGame = {
        isPaused: true, // Manually paused by player (e.g. Esc menu)
        isGameOver: false,
        lastTime: 1000,
        resizeCanvas: () => {},
      };

      const manager = new MobileScreenManager(mockGame as any);
      manager.wasAutoPausedByOrientation = false; // Not paused by orientation guard!

      let overlayVisible = true;
      manager.overlay = {
        classList: {
          add: () => { overlayVisible = false; },
          remove: () => { overlayVisible = true; },
        },
      } as any;

      // Rotate to Landscape
      (global as any).window = {
        innerWidth: 844,
        innerHeight: 390,
        ontouchstart: {},
        screen: {},
      };
      setMockNavigator({ maxTouchPoints: 5, userAgent: 'iPhone' });

      manager.checkOrientationState();

      assert.equal(overlayVisible, false);
      assert.equal(mockGame.isPaused, true, 'Must preserve manual pause state');
    });

    it('3.6 UX Guard: should allow player to bypass orientation prompt and resume gameplay', () => {
      const mockGame = {
        isPaused: true,
        isGameOver: false,
        lastTime: 1000,
        resizeCanvas: () => {},
      };

      const manager = new MobileScreenManager(mockGame as any);
      manager.wasAutoPausedByOrientation = true;

      let overlayVisible = true;
      manager.overlay = {
        classList: {
          add: () => { overlayVisible = false; },
          remove: () => { overlayVisible = true; },
        },
      } as any;

      // Currently still in portrait
      (global as any).window = {
        innerWidth: 390,
        innerHeight: 844,
        ontouchstart: {},
        screen: {},
        performance: { now: () => 3000 },
      };
      setMockNavigator({ maxTouchPoints: 5, userAgent: 'iPhone' });

      // User clicks bypass button
      manager.bypassPrompt = true;
      manager.checkOrientationState();

      assert.equal(overlayVisible, false, 'Overlay must be dismissed when bypassed');
      assert.equal(mockGame.isPaused, false, 'Game should resume upon user override');
      assert.equal(manager.wasAutoPausedByOrientation, false);
    });

    it('3.7 Fullscreen & Screen Orientation Lock: requests landscape lock and fullscreen properly', async () => {
      let fullscreenRequested = false;
      let orientationLocked: string | null = null;
      let canvasResized = false;

      const mockGame = {
        resizeCanvas: () => { canvasResized = true; },
      };
      const manager = new MobileScreenManager(mockGame as any);

      (global as any).document = {
        fullscreenElement: null,
        documentElement: {
          requestFullscreen: async () => {
            fullscreenRequested = true;
            (global as any).document.fullscreenElement = {};
          },
        },
      };

      (global as any).window = {
        innerWidth: 800,
        innerHeight: 400,
        screen: {
          orientation: {
            lock: async (mode: string) => { orientationLocked = mode; },
            unlock: () => {},
          },
        },
      };

      await manager.requestFullscreenAndLandscape();

      assert.equal(fullscreenRequested, true);
      assert.equal(orientationLocked, 'landscape');
      assert.equal(manager.isFullscreen(), true);
    });
  });
});
