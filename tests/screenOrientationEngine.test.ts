import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ScreenOrientationEngine } from '../public/js/engine/screenOrientationEngine.js';

describe('Module 1: Mobile Fullscreen & Orientation Lock Engine Test Suite', () => {
  let originalWindow: any;
  let originalDocument: any;

  beforeEach(() => {
    // Preserve any existing globals
    originalWindow = (global as any).window;
    originalDocument = (global as any).document;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    (global as any).document = originalDocument;
  });

  describe('1. Landscape & Orientation Detection Logic', () => {
    it('should detect landscape from screen.orientation.type', () => {
      (global as any).window = {
        screen: {
          orientation: {
            type: 'landscape-primary',
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isLandscape(), true);
      assert.strictEqual(engine.getOrientationType(), 'landscape-primary');
    });

    it('should detect portrait from screen.orientation.type', () => {
      (global as any).window = {
        screen: {
          orientation: {
            type: 'portrait-primary',
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isLandscape(), false);
      assert.strictEqual(engine.getOrientationType(), 'portrait-primary');
    });

    it('should fallback to window.matchMedia when screen.orientation is absent', () => {
      (global as any).window = {
        screen: {},
        matchMedia: (query: string) => ({
          matches: query.includes('landscape'),
        }),
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isLandscape(), true);
    });

    it('should fallback to viewport dimensions (innerWidth >= innerHeight)', () => {
      // Landscape: 844 x 390
      (global as any).window = {
        screen: {},
        innerWidth: 844,
        innerHeight: 390,
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isLandscape(), true);

      // Portrait: 390 x 844
      (global as any).window.innerWidth = 390;
      (global as any).window.innerHeight = 844;
      assert.strictEqual(engine.isLandscape(), false);
    });

    it('should fallback to legacy window.orientation (90 / -90 deg)', () => {
      (global as any).window = {
        screen: {},
        orientation: 90,
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isLandscape(), true);

      (global as any).window.orientation = 0; // Portrait
      assert.strictEqual(engine.isLandscape(), false);
    });
  });

  describe('2. Screen Orientation API & Lock / Unlock', () => {
    it('should report orientation lock support correctly', () => {
      // Modern supported
      (global as any).window = {
        screen: {
          orientation: {
            lock: async () => {},
          },
        },
      };
      let engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isOrientationLockSupported(), true);

      // Legacy vendor supported
      (global as any).window = {
        screen: {
          lockOrientation: () => true,
        },
      };
      engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isOrientationLockSupported(), true);

      // Not supported (iOS Safari)
      (global as any).window = {
        screen: {},
      };
      engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isOrientationLockSupported(), false);
    });

    it('should lock orientation using modern screen.orientation.lock', async () => {
      let lockedMode = '';
      (global as any).window = {
        screen: {
          orientation: {
            lock: async (mode: string) => {
              lockedMode = mode;
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = await engine.lockLandscape('landscape');

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'screen.orientation.lock');
      assert.strictEqual(lockedMode, 'landscape');
    });

    it('should fallback to landscape-primary if generic landscape is rejected', async () => {
      let attempts: string[] = [];
      (global as any).window = {
        screen: {
          orientation: {
            lock: async (mode: string) => {
              attempts.push(mode);
              if (mode === 'landscape') {
                throw new Error('NotSupportedError: generic landscape not supported');
              }
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = await engine.lockLandscape('landscape');

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'screen.orientation.lock(landscape-primary)');
      assert.deepStrictEqual(attempts, ['landscape', 'landscape-primary']);
    });

    it('should fallback to vendor prefixes (lockOrientation, mozLockOrientation, msLockOrientation)', async () => {
      let legacyMethodCalled = false;
      (global as any).window = {
        screen: {
          mozLockOrientation: (mode: string) => {
            legacyMethodCalled = true;
            return true;
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = await engine.lockLandscape();

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'screen.mozLockOrientation');
      assert.strictEqual(legacyMethodCalled, true);
    });

    it('should gracefully handle rejection without crashing when lock is unsupported', async () => {
      (global as any).window = {
        screen: {
          orientation: {
            lock: async () => {
              throw new Error('User gesture required or permission denied');
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = await engine.lockLandscape();

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.method, 'none');
      assert.ok(res.error?.includes('User gesture required'));
    });

    it('should unlock orientation properly', () => {
      let unlocked = false;
      (global as any).window = {
        screen: {
          orientation: {
            unlock: () => {
              unlocked = true;
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = engine.unlockOrientation();

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'screen.orientation.unlock');
      assert.strictEqual(unlocked, true);
    });
  });

  describe('3. Fullscreen API Integration & Vendor Prefixes', () => {
    it('should detect fullscreen state and element correctly', () => {
      const mockElement = { id: 'gameCanvas' };
      (global as any).document = {
        fullscreenElement: mockElement,
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isFullscreen(), true);
      assert.strictEqual(engine.getFullscreenElement(), mockElement);

      // When exiting fullscreen
      (global as any).document.fullscreenElement = null;
      assert.strictEqual(engine.isFullscreen(), false);
      assert.strictEqual(engine.getFullscreenElement(), null);
    });

    it('should detect webkitFullscreenElement for Safari/WebKit', () => {
      const mockElement = { id: 'safariDoc' };
      (global as any).document = {
        fullscreenElement: null,
        webkitFullscreenElement: mockElement,
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isFullscreen(), true);
      assert.strictEqual(engine.getFullscreenElement(), mockElement);
    });

    it('should request fullscreen with standard requestFullscreen', async () => {
      let requested = false;
      const mockEl = {
        requestFullscreen: async () => {
          requested = true;
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });
      const res = await engine.requestFullscreen();

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'requestFullscreen');
      assert.strictEqual(requested, true);
    });

    it('should fallback to webkitRequestFullscreen when standard is absent', async () => {
      let webkitRequested = false;
      const mockEl = {
        webkitRequestFullscreen: async () => {
          webkitRequested = true;
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });
      const res = await engine.requestFullscreen();

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, 'webkitRequestFullscreen');
      assert.strictEqual(webkitRequested, true);
    });

    it('should exit fullscreen cleanly with cross-browser prefixes', async () => {
      let exitCalled = false;
      (global as any).document = {
        fullscreenElement: { id: 'screen' },
        exitFullscreen: async () => {
          exitCalled = true;
          (global as any).document.fullscreenElement = null;
        },
      };

      const engine = new ScreenOrientationEngine();
      const res = await engine.exitFullscreen();

      assert.strictEqual(res.success, true);
      assert.strictEqual(exitCalled, true);
    });

    it('should toggle fullscreen on and off', async () => {
      let fsState = false;
      const mockEl = {
        requestFullscreen: async () => {
          fsState = true;
          (global as any).document.fullscreenElement = mockEl;
        },
      };
      (global as any).document = {
        fullscreenElement: null,
        exitFullscreen: async () => {
          fsState = false;
          (global as any).document.fullscreenElement = null;
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });

      // 1. Enter Fullscreen
      const toggle1 = await engine.toggleFullscreen();
      assert.strictEqual(toggle1.isFullscreen, true);
      assert.strictEqual(fsState, true);

      // 2. Exit Fullscreen
      const toggle2 = await engine.toggleFullscreen();
      assert.strictEqual(toggle2.isFullscreen, false);
      assert.strictEqual(fsState, false);
    });
  });

  describe('4. One-Touch Combat Mode Orchestration (Landscape + Fullscreen)', () => {
    it('should orchestrate Fullscreen then Orientation Lock in sequential order', async () => {
      const callOrder: string[] = [];
      const mockEl = {
        requestFullscreen: async () => {
          callOrder.push('fullscreen');
          (global as any).document.fullscreenElement = mockEl;
        },
      };

      (global as any).document = {
        fullscreenElement: null,
      };

      (global as any).window = {
        screen: {
          orientation: {
            lock: async (mode: string) => {
              callOrder.push(`lock:${mode}`);
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });
      const res = await engine.requestLandscapeAndFullscreen();

      assert.strictEqual(res.fullscreen, true);
      assert.strictEqual(res.orientationLocked, true);
      assert.deepStrictEqual(callOrder, ['fullscreen', 'lock:landscape']);
    });

    it('should gracefully handle orientation lock failure while preserving fullscreen success', async () => {
      const mockEl = {
        requestFullscreen: async () => {
          (global as any).document.fullscreenElement = mockEl;
        },
      };

      (global as any).document = {
        fullscreenElement: null,
      };

      // Simulated iOS Safari: supports fullscreen (on iPad) but rejects orientation lock
      (global as any).window = {
        screen: {
          orientation: {
            lock: async () => {
              throw new Error('NotSupportedError');
            },
          },
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });
      const res = await engine.requestLandscapeAndFullscreen();

      assert.strictEqual(res.fullscreen, true);
      assert.strictEqual(res.orientationLocked, false);
      assert.ok(res.error?.includes('NotSupportedError'));
    });

    it('should toggle combat mode between active and normal', async () => {
      let isFs = false;
      let isLocked = false;
      const mockEl = {
        requestFullscreen: async () => {
          isFs = true;
          (global as any).document.fullscreenElement = mockEl;
        },
      };
      (global as any).document = {
        fullscreenElement: null,
        exitFullscreen: async () => {
          isFs = false;
          (global as any).document.fullscreenElement = null;
        },
      };
      (global as any).window = {
        screen: {
          orientation: {
            lock: async () => { isLocked = true; },
            unlock: () => { isLocked = false; },
          },
        },
      };

      const engine = new ScreenOrientationEngine({ targetElement: mockEl as any });

      // First toggle: Turn ON
      const t1 = await engine.toggleLandscapeMode();
      assert.strictEqual(t1.active, true);
      assert.strictEqual(isFs, true);
      assert.strictEqual(isLocked, true);

      // Second toggle: Turn OFF
      const t2 = await engine.toggleLandscapeMode();
      assert.strictEqual(t2.active, false);
      assert.strictEqual(isFs, false);
      assert.strictEqual(isLocked, false);
    });
  });

  describe('5. Mobile Device Detection & Portrait Warning Prompt', () => {
    it('should detect mobile device by touch capability or mobile UserAgent', () => {
      // Mobile touch screen device
      (global as any).window = {
        navigator: {
          maxTouchPoints: 5,
          userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)',
        },
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.isMobileDevice(), true);

      // Desktop non-touch device
      (global as any).window = {
        navigator: {
          maxTouchPoints: 0,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      };
      assert.strictEqual(engine.isMobileDevice(), false);
    });

    it('should trigger shouldShowPortraitPrompt only on mobile in portrait mode', () => {
      // Mobile in portrait
      (global as any).window = {
        navigator: {
          maxTouchPoints: 5,
          userAgent: 'iPhone; CPU iPhone OS 16_5',
        },
        screen: {
          orientation: { type: 'portrait-primary' },
        },
      };

      const engine = new ScreenOrientationEngine();
      assert.strictEqual(engine.shouldShowPortraitPrompt(), true);

      // Mobile in landscape (rotated)
      (global as any).window.screen.orientation.type = 'landscape-primary';
      assert.strictEqual(engine.shouldShowPortraitPrompt(), false);

      // Desktop in portrait (e.g. vertical monitor) -> should NOT prompt rotation
      (global as any).window.navigator.maxTouchPoints = 0;
      (global as any).window.navigator.userAgent = 'Windows NT 10.0';
      (global as any).window.screen.orientation.type = 'portrait-primary';
      assert.strictEqual(engine.shouldShowPortraitPrompt(), false);
    });
  });

  describe('6. Event Callbacks & Lifecycle Management', () => {
    it('should register and execute orientation change callback', () => {
      let callbackFired = false;
      let lastResult: any = null;

      (global as any).window = {
        screen: {
          orientation: {
            type: 'landscape-primary',
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const engine = new ScreenOrientationEngine();
      const unsubscribe = engine.onOrientationChange((data) => {
        callbackFired = true;
        lastResult = data;
      });

      // Trigger change manually
      (engine as any)._handleOrientationChange(null);

      assert.strictEqual(callbackFired, true);
      assert.strictEqual(lastResult.orientation, 'landscape-primary');
      assert.strictEqual(lastResult.isLandscape, true);

      // Unsubscribe test
      callbackFired = false;
      unsubscribe();
      (engine as any)._handleOrientationChange(null);
      assert.strictEqual(callbackFired, false);
    });

    it('should clean up listeners on destroy()', () => {
      let listenerRemoved = false;
      (global as any).window = {
        screen: {
          orientation: {
            addEventListener: () => {},
            removeEventListener: (event: string) => {
              if (event === 'change') listenerRemoved = true;
            },
          },
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const engine = new ScreenOrientationEngine();
      engine.destroy();

      assert.strictEqual(listenerRemoved, true);
      assert.strictEqual(engine.orientationCallbacks.length, 0);
      assert.strictEqual(engine.fullscreenCallbacks.length, 0);
    });
  });
});
