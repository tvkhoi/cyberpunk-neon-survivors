import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ParticleSystem } from '../public/js/vfx/particles.js';
import { SoundEngine } from '../public/js/audio/soundEngine.js';
import { Game } from '../public/js/game.js';

function createMockCanvas(width = 1280, height = 720) {
  const dummyFn = () => {};
  const mockCtx = new Proxy(
    {
      measureText: () => ({ width: 50 }),
      createRadialGradient: () => ({ addColorStop: dummyFn }),
      createLinearGradient: () => ({ addColorStop: dummyFn }),
    },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return dummyFn;
      },
    }
  );

  return {
    getContext: () => mockCtx,
    width,
    height,
    style: { width: `${width}px`, height: `${height}px` },
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    addEventListener: dummyFn,
  };
}

describe('Web Game Audit & Optimizations: Canvas, Input, Display & Audio', () => {

  describe('1. Canvas Performance & Timestep Guarding', () => {
    it('should clamp raw deltaTime to max 0.1s in game loop to prevent teleporting', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const game = new Game(mockCanvas as any);

      // Simulate a long lag spike or inactive tab resume of 15 seconds
      game.lastTime = 1000;
      const longLagTime = 16000; // 15 seconds jump

      // Execute loop
      game.loop(longLagTime);

      // Frame time should be clamped to max 100ms (0.1s)
      assert.ok(game.frameTimeMs <= 100.001, `frameTimeMs was ${game.frameTimeMs}, expected <= 100ms`);
      assert.equal(game.lastTime, longLagTime);
    });

    it('should auto-pause when tab is hidden and resume clock cleanly on return without accumulator overflow', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const game = new Game(mockCanvas as any);
      assert.equal(game.isPaused, false);

      // Tab switches to background
      game.handleVisibilityHidden();
      assert.equal(game.isPaused, true);
      assert.equal(game.wasAutoPausedByVisibility, true);

      // Simulate time passing in background
      game.accumulator = 5.0; // Stale accumulator

      // Tab becomes visible again
      game.handleVisibilityVisible();
      assert.equal(game.isPaused, false);
      assert.equal(game.wasAutoPausedByVisibility, false);
      assert.equal(game.accumulator, 0); // Accumulator must reset to 0 to prevent physics warp
    });

    it('should utilize Object Pooling for particles to eliminate memory churn during intense combat', () => {
      const ps = new ParticleSystem(100);

      // Emit 24 sparks
      ps.emitSparks(0, 0, '#00f0ff', 24, 200);
      assert.equal(ps.particles.length, 24);
      assert.equal(ps.particlePool.length, 0);

      // Store a reference to the active particles
      const firstParticle = ps.particles[0];

      // Age particles beyond their max life (life < 0.6)
      ps.update(1.0);

      // All particles should be expired and recycled into pool
      assert.equal(ps.particles.length, 0);
      assert.equal(ps.particlePool.length, 24);
      assert.ok(ps.particlePool.includes(firstParticle), 'Expired particle was returned to object pool');

      // Emit new sparks: should reuse instances from pool instead of allocating new objects
      ps.emitSparks(10, 10, '#ff007f', 12, 180);
      assert.equal(ps.particles.length, 12);
      assert.equal(ps.particlePool.length, 12);
    });

    it('should utilize Object Pooling for Floating Damage Numbers', () => {
      const ps = new ParticleSystem(100);

      ps.addFloatingText(50, 50, '150', '#ffffff', false);
      ps.addFloatingText(60, 60, 'CRIT 300!', '#ffff00', true);
      assert.equal(ps.floatingTexts.length, 2);

      const firstText = ps.floatingTexts[0];

      // Age out text (life is ~0.65s to 0.9s)
      ps.update(1.2);

      assert.equal(ps.floatingTexts.length, 0);
      assert.equal(ps.floatingTextPool.length, 2);
      assert.ok(ps.floatingTextPool.includes(firstText));

      // Re-add floating text: takes from pool
      ps.addFloatingText(100, 100, '500', '#ffffff', false);
      assert.equal(ps.floatingTexts.length, 1);
      assert.equal(ps.floatingTextPool.length, 1);
    });
  });

  describe('2. Controls & Input Anti-Drift / Anti-Stuck-Keys', () => {
    it('should instantly clear held keys, mouse state, and player velocity on blur / resetInput()', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const game = new Game(mockCanvas as any);

      // Simulate player holding WASD and firing
      game.keys['KeyW'] = true;
      game.keys['KeyD'] = true;
      game.keys['Space'] = true;
      game.isMouseDown = true;
      game.player.vx = 240;
      game.player.vy = -240;
      game.player.isManualAiming = true;

      // Window loses focus or tab changes
      game.resetInput();

      assert.deepEqual(game.keys, {});
      assert.equal(game.isMouseDown, false);
      assert.equal(game.player.vx, 0);
      assert.equal(game.player.vy, 0);
      assert.equal(game.player.isManualAiming, false);
    });
  });

  describe('3. Display & Audio: HiDPI DPR and Dynamics Compressor', () => {
    it('should scale canvas buffer according to devicePixelRatio while maintaining CSS display bounds', () => {
      const mockCanvas = createMockCanvas(1280, 720);
      const game = new Game(mockCanvas as any);

      // Test with DPR = 2 (Retina display)
      game.dpr = 2;
      (game as any).resizeCanvas();

      const logicalW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const logicalH = typeof window !== 'undefined' ? window.innerHeight : 720;

      assert.equal(mockCanvas.width, Math.round(logicalW * 2));
      assert.equal(mockCanvas.height, Math.round(logicalH * 2));
      assert.equal(mockCanvas.style.width, `${logicalW}px`);
      assert.equal(mockCanvas.style.height, `${logicalH}px`);
      assert.equal(game.camera.viewportWidth, logicalW);
      assert.equal(game.camera.viewportHeight, logicalH);
    });

    it('should instantiate and configure DynamicsCompressorNode in SoundEngine to eliminate clipping', () => {
      const se = new SoundEngine();

      let compressorCreated = false;
      const mockCompressor = {
        threshold: { setValueAtTime: (val: number) => { (mockCompressor as any)._thresh = val; } },
        knee: { setValueAtTime: (val: number) => { (mockCompressor as any)._knee = val; } },
        ratio: { setValueAtTime: (val: number) => { (mockCompressor as any)._ratio = val; } },
        attack: { setValueAtTime: (val: number) => { (mockCompressor as any)._attack = val; } },
        release: { setValueAtTime: (val: number) => { (mockCompressor as any)._release = val; } },
        connect: (dest: any) => { (mockCompressor as any)._connectedTo = dest; },
      };

      const mockCtx: any = {
        currentTime: 0,
        state: 'running',
        createGain: () => ({
          gain: { setValueAtTime: () => {} },
          connect: () => {},
        }),
        createBiquadFilter: () => ({
          frequency: { setValueAtTime: () => {} },
          connect: () => {},
        }),
        createDynamicsCompressor: () => {
          compressorCreated = true;
          return mockCompressor;
        },
        destination: { id: 'ctx_destination' },
      };

      se.ctx = mockCtx;

      // Mock window AudioContext and run init()
      se.masterGain = mockCtx.createGain();
      se.filterNode = mockCtx.createBiquadFilter();
      se.musicGain = mockCtx.createGain();
      se.sfxGain = mockCtx.createGain();

      // Test routing with compressor
      se.compressor = mockCtx.createDynamicsCompressor();
      se.compressor.threshold.setValueAtTime(-12, mockCtx.currentTime);
      se.compressor.knee.setValueAtTime(12, mockCtx.currentTime);
      se.compressor.ratio.setValueAtTime(12, mockCtx.currentTime);
      se.compressor.attack.setValueAtTime(0.003, mockCtx.currentTime);
      se.compressor.release.setValueAtTime(0.25, mockCtx.currentTime);
      se.masterGain.connect(se.compressor);
      se.compressor.connect(mockCtx.destination);

      assert.ok(compressorCreated, 'DynamicsCompressorNode should be instantiated');
      assert.equal((mockCompressor as any)._thresh, -12);
      assert.equal((mockCompressor as any)._knee, 12);
      assert.equal((mockCompressor as any)._ratio, 12);
      assert.equal((mockCompressor as any)._attack, 0.003);
      assert.equal((mockCompressor as any)._release, 0.25);
      assert.equal((mockCompressor as any)._connectedTo, mockCtx.destination);
    });
  });

  describe('4. FontAwesome 6 Vector Icons Integration', () => {
    it('should verify all player avatar archetypes provide FontAwesome 6 icons', async () => {
      const { AVATARS } = await import('../public/js/entities/player.js');
      const archetypes = Object.keys(AVATARS);
      assert.ok(archetypes.length >= 4);

      for (const key of archetypes) {
        const av = AVATARS[key];
        assert.ok(av.faIcon, `Avatar ${key} must have faIcon defined`);
        assert.ok(av.faIcon.includes('fa-solid'), `Avatar ${key} faIcon must use fa-solid class`);
      }
    });

    it('should verify all collectible drops provide FontAwesome 6 icons and radar directional arrows', async () => {
      const { DROP_CONFIGS, findNearestDrops } = await import('../public/js/entities/drops.js');
      const dropTypes = Object.keys(DROP_CONFIGS);
      assert.ok(dropTypes.length >= 5);

      for (const dt of dropTypes) {
        const cfg = DROP_CONFIGS[dt];
        assert.ok(cfg.faIcon, `Drop config ${dt} must have faIcon defined`);
        assert.ok(cfg.faIcon.includes('fa-solid'), `Drop config ${dt} faIcon must use fa-solid class`);
      }

      // Test radar nearest drop directional arrow
      const mockPlayer = { x: 0, y: 0 };
      const mockDrops = [
        { x: 0, y: -100, config: DROP_CONFIGS.health },
        { x: 100, y: 0, config: DROP_CONFIGS.ammo_homing },
      ];

      const res = findNearestDrops(mockPlayer as any, mockDrops as any);
      assert.ok(res.nearestMedkit);
      assert.ok(res.nearestMedkit.faArrow.includes('fa-solid'));
      assert.ok(res.nearestAmmo);
      assert.ok(res.nearestAmmo.faArrow.includes('fa-solid'));
    });
  });

});
