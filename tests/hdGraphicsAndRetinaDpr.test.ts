import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { Game } from '../public/js/game.js';

describe('HD Ultra-Sharp Graphics & Retina 3x DPR System Tests', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (global as any).window;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  it('1. HTML5 Configuration: disables CRT scanline blur overlay by default', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(
      html.includes('id="crtOverlay" class="hidden absolute inset-0 crt-overlay'),
      'crtOverlay must have "hidden" class by default to eliminate scanline blur'
    );
    assert.ok(
      !html.includes('id="checkCrtScanlines" type="checkbox" checked'),
      'checkCrtScanlines checkbox must not be checked by default'
    );
  });

  it('2. Canvas CSS: includes image-rendering and text-rendering anti-blur optimization', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('#gameCanvas {'), 'must contain dedicated canvas CSS rules');
    assert.ok(html.includes('image-rendering: -webkit-optimize-contrast;'), 'must optimize contrast');
    assert.ok(html.includes('text-rendering: optimizeLegibility;'), 'must optimize text legibility');
  });

  it('3. Game DPR Scaling: allocates native 3x buffer resolution for 3x Retina/OLED mobile screens', () => {
    const mockCanvas = {
      getContext: () => ({
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      }),
      width: 0,
      height: 0,
      style: { width: '', height: '' },
    };

    const game = new Game(mockCanvas as any);

    // Mock 3x Retina mobile screen (e.g. iPhone 15 Pro, 844x390)
    (global as any).window = {
      innerWidth: 844,
      innerHeight: 390,
      devicePixelRatio: 3,
    };
    game.dpr = 0 as any; // clear previous

    (game as any).resizeCanvas();

    assert.equal(game.dpr, 3, 'dpr should unlock 3 on 3x screens');
    assert.equal(mockCanvas.width, 844 * 3, 'physical buffer width should scale to 2532px');
    assert.equal(mockCanvas.height, 390 * 3, 'physical buffer height should scale to 1170px');
    assert.equal(mockCanvas.style.width, '844px', 'CSS logical width should remain 844px');
    assert.equal(mockCanvas.style.height, '390px', 'CSS logical height should remain 390px');
  });

  it('4. Game Context Quality: configures imageSmoothingQuality to high', () => {
    let smoothingEnabled = false;
    let smoothingQuality = '';

    const mockCtx: any = {
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
    };

    Object.defineProperty(mockCtx, 'imageSmoothingEnabled', {
      set: (val: boolean) => { smoothingEnabled = val; },
      get: () => smoothingEnabled,
    });
    Object.defineProperty(mockCtx, 'imageSmoothingQuality', {
      set: (val: string) => { smoothingQuality = val; },
      get: () => smoothingQuality,
    });

    const mockCanvas = {
      getContext: () => mockCtx,
      width: 1280,
      height: 720,
      style: { width: '', height: '' },
    };

    const game = new Game(mockCanvas as any);
    (game as any).resizeCanvas();

    assert.equal(smoothingEnabled, true, 'imageSmoothingEnabled should be true');
    assert.equal(smoothingQuality, 'high', 'imageSmoothingQuality should be set to "high" for crisp subpixel filtering');
  });
});
