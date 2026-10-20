import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { MobileScreenManager } from '../public/js/engine/mobileScreen.js';

describe('Mobile Fullscreen & Landscape Orientation System Tests', () => {

  it('1. PWA Web App Manifest: configures display=fullscreen and orientation=landscape', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.display, 'fullscreen', 'display mode should be fullscreen');
    assert.equal(manifest.orientation, 'landscape', 'default orientation should be locked to landscape');
  });

  it('2. HTML5 Meta Tags: specifies landscape orientation, mobile capability and viewport-fit=cover', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('name="viewport"'), 'must include viewport meta tag');
    assert.ok(html.includes('viewport-fit=cover'), 'must include viewport-fit=cover for edge-to-edge display');
    assert.ok(html.includes('name="screen-orientation" content="landscape"'), 'must specify screen-orientation=landscape');
    assert.ok(html.includes('name="mobile-web-app-capable" content="yes"'), 'must specify mobile-web-app-capable');
    assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'), 'must specify apple-mobile-web-app-capable');
    assert.ok(html.includes('100dvh'), 'must specify 100dvh for dynamic mobile viewport');
  });

  it('3. UI Elements: contains portraitAdvisoryOverlay and btnToggleFullscreen in DOM', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="portraitAdvisoryOverlay"'), 'must contain portraitAdvisoryOverlay element');
    assert.ok(html.includes('id="btnForceFullscreenRotate"'), 'must contain btnForceFullscreenRotate element');
    assert.ok(html.includes('id="btnToggleFullscreen"'), 'must contain btnToggleFullscreen in HUD');
  });

  it('4. MobileScreenManager: detects portrait vs landscape based on window dimensions', () => {
    const mockGame = { resizeCanvas: () => {} };
    const manager = new MobileScreenManager(mockGame as any);

    // Mock global window dimensions: Landscape
    (global as any).window = {
      innerWidth: 844,
      innerHeight: 390,
      screen: {},
    };
    assert.equal(manager.isPortrait(), false, 'should report false when width > height (landscape)');

    // Mock global window dimensions: Portrait
    (global as any).window.innerWidth = 390;
    (global as any).window.innerHeight = 844;
    assert.equal(manager.isPortrait(), true, 'should report true when height > width (portrait)');
  });

  it('5. MobileScreenManager: detects mobile touch devices accurately', () => {
    const mockGame = { resizeCanvas: () => {} };
    const manager = new MobileScreenManager(mockGame as any);

    // Mock Desktop without touch
    (global as any).window = {
      innerWidth: 1920,
      innerHeight: 1080,
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      configurable: true,
      writable: true,
    });
    assert.equal(manager.isMobileDevice(), false, 'desktop with mouse should not be flagged as mobile');

    // Mock Mobile touch device (iPhone)
    (global as any).window = {
      innerWidth: 390,
      innerHeight: 844,
      ontouchstart: {},
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
      configurable: true,
      writable: true,
    });
    assert.equal(manager.isMobileDevice(), true, 'mobile touch device should be flagged as mobile');
  });

  it('6. MobileScreenManager: invokes requestFullscreen and screen.orientation.lock("landscape")', async () => {
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
        requestFullscreen: async (options?: any) => {
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
          type: 'landscape-primary',
          lock: async (mode: string) => { orientationLocked = mode; },
          unlock: () => {},
        },
      },
    };

    await manager.requestFullscreenAndLandscape();

    assert.equal(fullscreenRequested, true, 'requestFullscreen should be called');
    assert.equal(orientationLocked, 'landscape', 'screen.orientation.lock should be called with "landscape"');
  });

  it('7. MobileScreenManager: handles exitFullscreen and orientation unlock cleanly', async () => {
    let exitFullscreenCalled = false;
    let orientationUnlocked = false;

    const mockGame = { resizeCanvas: () => {} };
    const manager = new MobileScreenManager(mockGame as any);

    (global as any).document = {
      fullscreenElement: {},
      exitFullscreen: async () => {
        exitFullscreenCalled = true;
        (global as any).document.fullscreenElement = null;
      },
    };

    (global as any).window = {
      screen: {
        orientation: {
          unlock: () => { orientationUnlocked = true; },
        },
      },
    };

    await manager.exitFullscreen();

    assert.equal(exitFullscreenCalled, true, 'document.exitFullscreen should be called');
    assert.equal(orientationUnlocked, true, 'screen.orientation.unlock should be called');
  });

  it('8. MobileScreenManager: toggles portrait advisory overlay based on device orientation', () => {
    const mockGame = { resizeCanvas: () => {} };
    const manager = new MobileScreenManager(mockGame as any);

    let overlayHidden = true;
    const mockOverlay = {
      classList: {
        add: (cls: string) => { if (cls === 'hidden') overlayHidden = true; },
        remove: (cls: string) => { if (cls === 'hidden') overlayHidden = false; },
      },
    };
    manager.overlay = mockOverlay as any;

    // Mobile + Portrait => show advisory overlay (hidden removed)
    (global as any).window = {
      innerWidth: 390,
      innerHeight: 844,
      ontouchstart: {},
      screen: {},
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { maxTouchPoints: 5, userAgent: 'iPhone' },
      configurable: true,
      writable: true,
    });

    manager.checkOrientationState();
    assert.equal(overlayHidden, false, 'overlay should be visible in mobile portrait mode');

    // Mobile + Landscape => hide advisory overlay (hidden added)
    (global as any).window.innerWidth = 844;
    (global as any).window.innerHeight = 390;

    manager.checkOrientationState();
    assert.equal(overlayHidden, true, 'overlay should be hidden in mobile landscape mode');
  });
});
