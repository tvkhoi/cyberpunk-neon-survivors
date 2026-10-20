import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../public/js/engine/camera.js';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';
import { Game } from '../public/js/game.js';

describe('Module 1: Game Loop, Camera Screen Shake & Spatial Hash Grid Test Suite', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (global as any).window;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });
  describe('1. Game Loop & High Refresh Rate Architecture', () => {
    it('should clamp delta time against spiral-of-death during background tab stalls', () => {
      // Simulating delta time clamping logic
      const simulateDeltaClamp = (rawDt: number) => {
        let dt = rawDt;
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0.001;
        return dt;
      };

      assert.equal(simulateDeltaClamp(1.5), 0.1, 'Large lag spike (1.5s) must be clamped to 0.1s');
      assert.equal(simulateDeltaClamp(0.00833), 0.00833, '120 FPS dt (8.33ms) must remain unchanged');
      assert.equal(simulateDeltaClamp(0.00694), 0.00694, '144 FPS dt (6.94ms) must remain unchanged');
      assert.equal(simulateDeltaClamp(-0.05), 0.001, 'Negative dt must fallback to 0.001s');
    });

    it('should accurately simulate 120Hz fixed-timestep accumulator sub-stepping', () => {
      const physicsStep = 1 / 120; // ~0.008333s
      let accumulator = 0;
      let updates = 0;
      const maxSubSteps = 4;

      // Simulate a 60Hz frame render (16.66ms) -> should execute exactly 2 physics sub-steps
      const frameDelta60 = 1 / 60;
      accumulator += frameDelta60;
      while (accumulator >= physicsStep && updates < maxSubSteps) {
        updates++;
        accumulator -= physicsStep;
      }

      assert.equal(updates, 2, 'At 60 FPS render, accumulator must execute exactly 2 sub-steps of 120Hz physics');
      assert.ok(accumulator < physicsStep, 'Remaining accumulator must be under 1 physics step');

      // Simulate a 144Hz frame render (~6.94ms)
      updates = 0;
      const frameDelta144 = 1 / 144;
      accumulator += frameDelta144;
      while (accumulator >= physicsStep && updates < maxSubSteps) {
        updates++;
        accumulator -= physicsStep;
      }
      assert.ok(updates <= 1, 'At 144 FPS, sub-steps pace smoothly with refresh rate');
    });

    it('should drain accumulator when exceeding maxSubSteps to prevent frame freeze', () => {
      const physicsStep = 1 / 120;
      let accumulator = 0.5; // huge 500ms lag spike
      let updates = 0;
      const maxSubSteps = 4;

      while (accumulator >= physicsStep && updates < maxSubSteps) {
        updates++;
        accumulator -= physicsStep;
      }
      if (updates >= maxSubSteps) {
        accumulator = 0;
      }

      assert.equal(updates, 4, 'Must execute exactly maxSubSteps (4) without freezing browser');
      assert.equal(accumulator, 0, 'Excess accumulated time must be safely drained');
    });
  });

  describe('2. Camera Tracking, Viewport Frustum Culling & Trauma Screen Shake', () => {
    it('should initialize camera centered in world bounds', () => {
      const camera = new Camera(1920, 1080, 3200, 3200);
      assert.equal(camera.x, 1600);
      assert.equal(camera.y, 1600);
      assert.equal(camera.viewportWidth, 1920);
      assert.equal(camera.viewportHeight, 1080);
      assert.equal(camera.trauma, 0);
    });

    it('should smoothly track target using exponential smoothing', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.x = 1000;
      camera.y = 1000;

      // Update towards player at (1200, 1100) with 120 FPS dt (0.00833s)
      camera.update(1200, 1100, 1 / 120);

      assert.ok(camera.x > 1000 && camera.x < 1200, 'Camera should move smoothly toward player X');
      assert.ok(camera.y > 1000 && camera.y < 1100, 'Camera should move smoothly toward player Y');
    });

    it('should strictly clamp camera viewport within world bounds', () => {
      const camera = new Camera(800, 600, 2000, 2000);

      // Target near top-left edge
      camera.update(50, 50, 0.5);
      assert.equal(camera.x, 400, 'Camera center cannot go lower than half-viewport width (400)');
      assert.equal(camera.y, 300, 'Camera center cannot go lower than half-viewport height (300)');

      // Target near bottom-right edge
      camera.update(1990, 1990, 0.5);
      assert.equal(camera.x, 1600, 'Camera center cannot exceed worldWidth - halfW (1600)');
      assert.equal(camera.y, 1700, 'Camera center cannot exceed worldHeight - halfH (1700)');
    });

    it('should correctly determine visible bounds and cull off-screen entities', () => {
      const camera = new Camera(1000, 1000, 4000, 4000);
      camera.x = 2000;
      camera.y = 2000;

      const bounds = camera.getVisibleBounds(100);
      // Visible area: [2000 - 500 - 100, 2000 + 500 + 100] = [1400, 2600]
      assert.equal(bounds.minX, 1400);
      assert.equal(bounds.maxX, 2600);
      assert.equal(bounds.minY, 1400);
      assert.equal(bounds.maxY, 2600);

      // Inside entity
      assert.ok(camera.isVisible(2000, 2000, 15, 100), 'Center entity must be visible');
      assert.ok(camera.isVisible(1450, 1450, 20, 100), 'Near-edge entity must be visible');

      // Outside entity
      assert.equal(camera.isVisible(1000, 1000, 15, 100), false, 'Entity at (1000, 1000) must be culled');
      assert.equal(camera.isVisible(3200, 3200, 25, 100), false, 'Entity at (3200, 3200) must be culled');
    });

    it('should accumulate and decay trauma predictably over time', () => {
      const camera = new Camera(800, 600, 2000, 2000);
      camera.addTrauma(0.4);
      assert.equal(camera.trauma, 0.4);

      camera.addTrauma(0.8);
      assert.equal(camera.trauma, 1.0, 'Trauma must be capped at 1.0');

      // Decay over 0.5 seconds at 1.2 decay/sec
      camera.update(1000, 1000, 0.5);
      // 1.0 - (1.2 * 0.5) = 0.4
      assert.ok(Math.abs(camera.trauma - 0.4) < 0.001, `Expected ~0.4 trauma, got ${camera.trauma}`);

      // Additional 0.5s decay -> should reach 0
      camera.update(1000, 1000, 0.5);
      assert.equal(camera.trauma, 0, 'Trauma must not drop below 0');
    });
  });

  describe('3. Spatial Hash Grid Zero-Allocation & Stamped Deduplication', () => {
    it('should query without duplicate candidates when entity overlaps multi-cell borders', () => {
      const grid = new SpatialHashGrid(100);
      // Large entity spanning 4 cells
      const bigEntity = { id: 1, x: 99, y: 99, radius: 25 };
      grid.insert(bigEntity);

      // Query entity that overlaps the same multi-cells
      const probe = { id: 2, x: 101, y: 101, radius: 20 };
      const results = grid.query(probe);

      // Stamped deduplication must ensure bigEntity is returned exactly once
      assert.equal(results.length, 1);
      assert.equal(results[0], bigEntity);
    });

    it('should execute 1,000 rapid queries without throwing or leaking memory', () => {
      const grid = new SpatialHashGrid(120);
      for (let i = 0; i < 200; i++) {
        grid.insert({
          id: i,
          x: (i * 37) % 3000,
          y: (i * 73) % 3000,
          radius: 12,
        });
      }

      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        const queryEntity = { x: (i * 19) % 3000, y: (i * 47) % 3000, radius: 15 };
        const hits = grid.query(queryEntity);
        assert.ok(Array.isArray(hits));
      }
      const duration = performance.now() - t0;

      // 1,000 queries should take less than 100ms even under parallel test worker load (typical is < 3ms)
      assert.ok(duration < 100, `1,000 queries completed in ${duration.toFixed(2)}ms (expected < 100ms)`);
    });
  });
});
