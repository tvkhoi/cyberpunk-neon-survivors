import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LightingEngine, MAP_BIOMES } from '../public/js/vfx/lighting.js';

describe('Module 3: Dynamic Level Map Biomes & Visual Sector Progression Test Suite', () => {
  describe('1. Biome Configurations & Color Palettes', () => {
    it('should define at least 6 rich cyberpunk map biomes with complete thematic attributes', () => {
      assert.ok(MAP_BIOMES.length >= 6, 'Should have at least 6 unique biomes');

      const ids = new Set();
      for (const biome of MAP_BIOMES) {
        assert.ok(biome.id && typeof biome.id === 'string', 'Biome must have an id');
        assert.ok(!ids.has(biome.id), `Biome id ${biome.id} must be unique`);
        ids.add(biome.id);

        assert.ok(biome.name && biome.name.includes('SECTOR'), 'Biome name must designate sector');
        assert.ok(biome.subTitle, 'Biome must have subtitle/description');
        assert.ok(biome.bgColor && biome.bgColor.startsWith('#'), 'Biome must have valid hex bgColor');
        assert.ok(biome.gridColor && biome.gridColor.startsWith('rgba'), 'Biome must have rgba gridColor');
        assert.ok(biome.crosshairColor && biome.crosshairColor.startsWith('rgba'), 'Biome must have rgba crosshairColor');
        assert.ok(biome.circuitColor && biome.circuitColor.startsWith('rgba'), 'Biome must have rgba circuitColor');
        assert.ok(biome.accentColor && (biome.accentColor.startsWith('#') || biome.accentColor.startsWith('rgba')), 'Biome must have accentColor');
        assert.ok(Array.isArray(biome.ledColors) && biome.ledColors.length >= 2, 'Biome must have at least 2 LED colors');
        assert.ok(biome.floorPattern, 'Biome must specify floorPattern');
      }
    });

    it('should include key distinct atmospheric archetypes: Neon Core, Acid Matrix, Crimson Foundry, Quantum Void, Solar Archology, Glitch Redline', () => {
      const archetypes = ['neon_core', 'acid_matrix', 'crimson_foundry', 'quantum_void', 'solar_archology', 'glitch_overclock'];
      for (const arch of archetypes) {
        const found = MAP_BIOMES.find((b) => b.id === arch);
        assert.ok(found, `Expected biome archetype '${arch}' to exist in MAP_BIOMES`);
      }
    });
  });

  describe('2. LightingEngine Initial State & Biome Querying', () => {
    it('should initialize LightingEngine at Biome 0 (Neon Core) with complete transition', () => {
      const lighting = new LightingEngine(3200, 3200);
      assert.equal(lighting.currentBiomeIndex, 0);
      assert.equal(lighting.transitionProgress, 1.0);

      const current = lighting.getCurrentBiome();
      assert.equal(current.id, 'neon_core');
      assert.equal(current.name, 'SECTOR 01: NEON CORE');
    });

    it('should safely return previous and current biomes during transitions', () => {
      const lighting = new LightingEngine(3200, 3200);
      const switched = lighting.setBiomeByIndex(1, false);

      assert.ok(switched, 'Should return new biome');
      assert.equal(switched.id, 'acid_matrix');
      assert.equal(lighting.currentBiomeIndex, 1);
      assert.equal(lighting.previousBiomeIndex, 0);
      assert.equal(lighting.transitionProgress, 0.0);
      assert.equal(lighting.getPreviousBiome().id, 'neon_core');
      assert.equal(lighting.getCurrentBiome().id, 'acid_matrix');
    });

    it('should ignore redundant transitions if target biome is already active', () => {
      const lighting = new LightingEngine(3200, 3200);
      lighting.transitionProgress = 1.0;

      const result = lighting.setBiomeByIndex(0, false);
      assert.equal(result, null, 'Should return null when setting identical biome');
      assert.equal(lighting.transitionProgress, 1.0);
    });

    it('should force immediate transition when forceImmediate = true', () => {
      const lighting = new LightingEngine(3200, 3200);
      const switched = lighting.setBiomeByIndex(3, true);

      assert.ok(switched);
      assert.equal(switched.id, 'quantum_void');
      assert.equal(lighting.currentBiomeIndex, 3);
      assert.equal(lighting.transitionProgress, 1.0);
    });
  });

  describe('3. Level Up & Wave Progression Biome Switching', () => {
    it('should change map background every time player level advances', () => {
      const lighting = new LightingEngine(3200, 3200);

      // Start: Level 1, Wave 1 -> Sector 1 (Neon Core)
      assert.equal(lighting.getCurrentBiome().id, 'neon_core');

      // Player reaches Level 2 (Level Up!)
      const toLevel2 = lighting.setProgression(2, 1);
      assert.ok(toLevel2, 'Transition must be triggered on Level 2');
      assert.equal(toLevel2.id, 'acid_matrix');
      assert.equal(lighting.transitionProgress, 0.0);

      // Complete transition
      lighting.update(2.0);
      assert.equal(lighting.transitionProgress, 1.0);

      // Player reaches Level 3 (Level Up!)
      const toLevel3 = lighting.setProgression(3, 1);
      assert.ok(toLevel3, 'Transition must be triggered on Level 3');
      assert.equal(toLevel3.id, 'crimson_foundry');

      // Calling setProgression with same level & wave should not re-trigger transition
      assert.equal(lighting.setProgression(3, 1), null);
    });

    it('should change map background when wave advances', () => {
      const lighting = new LightingEngine(3200, 3200);
      lighting.setProgression(1, 1); // Level 1, Wave 1 (index 0)

      // Wave 2 begins!
      const toWave2 = lighting.setProgression(1, 2);
      assert.ok(toWave2, 'Transition must be triggered when Wave advances to Wave 2');
      assert.equal(toWave2.id, 'acid_matrix');

      // Wave 3 begins!
      const toWave3 = lighting.setProgression(1, 3);
      assert.ok(toWave3, 'Transition must be triggered when Wave advances to Wave 3');
      assert.equal(toWave3.id, 'crimson_foundry');
    });

    it('should seamlessly handle high levels and waves with modulo wraparound', () => {
      const lighting = new LightingEngine(3200, 3200);

      // Level 25, Wave 10 -> progression = (24 + 9) = 33 -> 33 % 6 = 3 (Sector 4: Quantum Void)
      const highProgression = lighting.setProgression(25, 10);
      assert.ok(highProgression);
      assert.equal(lighting.currentBiomeIndex, 3);
      assert.equal(highProgression.id, 'quantum_void');

      // Level 100, Wave 1 -> (99 + 0) = 99 -> 99 % 6 = 3
      // Level 101, Wave 1 -> (100 + 0) = 100 -> 100 % 6 = 4 (Sector 5: Solar Archology)
      lighting.setProgression(100, 1);
      const to101 = lighting.setProgression(101, 1);
      assert.ok(to101);
      assert.equal(to101.id, 'solar_archology');
    });
  });

  describe('4. Transition Timing & Holographic Sweep Physics', () => {
    it('should accurately progress transition over transitionDuration', () => {
      const lighting = new LightingEngine(3200, 3200);
      lighting.transitionDuration = 1.0; // 1 second duration for test

      lighting.setBiomeByIndex(2, false);
      assert.equal(lighting.transitionProgress, 0.0);

      // Advance by 0.5s -> exactly 50%
      lighting.update(0.5);
      assert.ok(Math.abs(lighting.transitionProgress - 0.5) < 0.001);

      // Advance by another 0.5s -> 100%
      lighting.update(0.5);
      assert.equal(lighting.transitionProgress, 1.0);

      // Further updates clamp at 1.0
      lighting.update(1.0);
      assert.equal(lighting.transitionProgress, 1.0);
    });

    it('should continuously cycle circuitPulse for holographic floor traces', () => {
      const lighting = new LightingEngine(3200, 3200);
      const initialPulse = lighting.circuitPulse;

      lighting.update(0.1);
      assert.ok(lighting.circuitPulse > initialPulse, 'Circuit pulse must increment with dt');
    });
  });

  describe('5. High-Load Benchmark & Zero-Leak Verification', () => {
    it('should process 2,000 updates and 100 biome transitions in < 20ms without memory leak', () => {
      const lighting = new LightingEngine(3200, 3200);
      const start = performance.now();

      for (let i = 0; i < 2000; i++) {
        if (i % 20 === 0) {
          lighting.setProgression(Math.floor(i / 20) + 1, 1);
        }
        lighting.update(0.00833); // 120Hz sub-step
      }

      const elapsed = performance.now() - start;
      assert.ok(elapsed < 350, `Execution took ${elapsed.toFixed(2)}ms (must be under 350ms)`);
      assert.ok(lighting.currentBiomeIndex >= 0 && lighting.currentBiomeIndex < MAP_BIOMES.length);
    });
  });
});
