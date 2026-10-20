import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../public/js/engine/camera.js';
import { LightingEngine, ArenaHazard, ArenaHazardSystem, HAZARD_TYPES, distToSegment } from '../public/js/vfx/lighting.js';
import { ParticleSystem } from '../public/js/vfx/particles.js';

describe('Module 3: Arena Hazards & Screen FX Test Suite', () => {
  describe('1. Hazard Archetypes & Biome Configurations', () => {
    it('should define all 5 core hazard archetypes with valid biome IDs and parameters', () => {
      const types = ['ACID_POOL', 'EMP_CONDUIT', 'MAGMA_VENT', 'QUANTUM_SINGULARITY', 'SOLAR_LASER'];
      for (const t of types) {
        const h = HAZARD_TYPES[t as keyof typeof HAZARD_TYPES];
        assert.ok(h, `Hazard type ${t} must exist`);
        assert.ok(h.id, `${t} must have an id`);
        assert.ok(h.name, `${t} must have a descriptive name`);
        assert.ok(h.biomeId, `${t} must specify associated biomeId`);
        assert.ok(h.color, `${t} must specify neon color`);
        assert.ok(h.glowColor, `${t} must specify glowColor`);
      }
    });

    it('should correctly calculate point-to-segment distance with distToSegment', () => {
      // Line from (0, 0) to (100, 0)
      assert.equal(distToSegment(50, 20, 0, 0, 100, 0), 20);
      assert.equal(distToSegment(50, -35, 0, 0, 100, 0), 35);
      // Beyond end points (clamps to endpoints)
      assert.equal(distToSegment(-10, 0, 0, 0, 100, 0), 10);
      assert.equal(distToSegment(120, 0, 0, 0, 100, 0), 20);
    });
  });

  describe('2. Acid Pool Hazard (Biome: Acid Matrix)', () => {
    it('should apply 35% movement slow to player standing in acid pool', () => {
      const hazard = new ArenaHazard({
        type: 'acid_pool',
        x: 500,
        y: 500,
        radius: 80,
      });

      const player = {
        x: 520,
        y: 500,
        radius: 16,
        isDashing: false,
        speedMultiplier: 1.0,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.016, player);
      assert.equal(player.speedMultiplier, 0.65, 'Player should be slowed by 35% (speedMultiplier = 0.65)');
    });

    it('should NOT slow player outside acid pool radius', () => {
      const hazard = new ArenaHazard({
        type: 'acid_pool',
        x: 500,
        y: 500,
        radius: 80,
      });

      const player = {
        x: 800,
        y: 800,
        radius: 16,
        isDashing: false,
        speedMultiplier: 1.0,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.016, player);
      assert.equal(player.speedMultiplier, 1.0, 'Player outside radius should remain at full speed (1.0)');
    });

    it('should deal periodic DoT acid damage to player, but respect Dash invulnerability', () => {
      const hazard = new ArenaHazard({
        type: 'acid_pool',
        x: 300,
        y: 300,
        radius: 70,
      });

      const player = {
        x: 300,
        y: 300,
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      // Initial damage tick
      hazard.update(0.016, player);
      assert.ok(player.health < 100, 'Player should take damage from acid pool');
      const hpAfterFirstHit = player.health;

      // Dash invulnerability check
      player.isDashing = true;
      hazard.damageCooldowns.clear(); // force damage tick
      hazard.update(0.016, player);
      assert.equal(player.health, hpAfterFirstHit, 'Dashing player must be 100% immune to acid damage');
    });

    it('should slow and damage enemies trapped in acid pool', () => {
      const hazard = new ArenaHazard({
        type: 'acid_pool',
        x: 400,
        y: 400,
        radius: 80,
      });

      const enemy = {
        x: 420,
        y: 400,
        radius: 15,
        baseSpeed: 100,
        speed: 100,
        hp: 50,
        takeDamage(dmg: number) { this.hp -= dmg; return dmg; },
      };

      hazard.update(0.016, null, [enemy]);
      assert.equal(enemy.speed, 65, 'Enemy speed must be reduced to 65%');
      assert.ok(enemy.hp < 50, 'Enemy must receive acid DoT damage');
    });
  });

  describe('3. EMP Arc Conduit Hazard (Biome: Neon Core)', () => {
    it('should transition through state machine: cooldown -> charging -> active -> cooldown', () => {
      const hazard = new ArenaHazard({
        type: 'emp_conduit',
        x: 200,
        y: 200,
        x2: 400,
        y2: 200,
        cooldownDuration: 1.0,
        chargeDuration: 0.5,
        activeDuration: 0.5,
      });

      assert.equal(hazard.state, 'cooldown');

      // Advance by 1.0s -> transitions to charging
      hazard.update(1.0);
      assert.equal(hazard.state, 'charging');

      // Advance by 0.5s -> transitions to active
      hazard.update(0.5);
      assert.equal(hazard.state, 'active');

      // Advance by 0.5s -> transitions back to cooldown
      hazard.update(0.5);
      assert.equal(hazard.state, 'cooldown');
    });

    it('should deal shock damage only when active, not during cooldown or charging', () => {
      const hazard = new ArenaHazard({
        type: 'emp_conduit',
        x: 200,
        y: 200,
        x2: 400,
        y2: 200,
      });

      const player = {
        x: 300,
        y: 205, // Right on the beam line
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      // During cooldown: no damage
      hazard.state = 'cooldown';
      hazard.update(0.016, player);
      assert.equal(player.health, 100);

      // During charging: no damage
      hazard.state = 'charging';
      hazard.update(0.016, player);
      assert.equal(player.health, 100);

      // When active: takes shock damage!
      hazard.state = 'active';
      hazard.update(0.016, player);
      assert.equal(player.health, 100 - (hazard.config.damage || 32));
    });
  });

  describe('4. Thermal Magma Vent Hazard (Biome: Crimson Foundry)', () => {
    it('should cycle dormant -> warning -> erupting -> dormant', () => {
      const hazard = new ArenaHazard({
        type: 'magma_vent',
        x: 300,
        y: 300,
        dormantDuration: 1.0,
        warningDuration: 0.5,
        eruptDuration: 0.5,
      });

      assert.equal(hazard.state, 'dormant');

      hazard.update(1.0);
      assert.equal(hazard.state, 'warning');

      hazard.update(0.5);
      assert.equal(hazard.state, 'erupting');

      hazard.update(0.5);
      assert.equal(hazard.state, 'dormant');
    });

    it('should deal burst damage during eruption and trigger camera trauma', () => {
      const hazard = new ArenaHazard({
        type: 'magma_vent',
        x: 600,
        y: 600,
        radius: 80,
      });
      hazard.state = 'erupting';

      const player = {
        x: 620,
        y: 600,
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      const camera = new Camera(1000, 800, 3200, 3200);

      hazard.update(0.016, player, null, null, null, null, camera);
      assert.equal(player.health, 100 - (hazard.config.damage || 48));
      assert.ok(camera.trauma > 0, 'Camera trauma must be added on magma blast');
    });
  });

  describe('5. Quantum Singularity Hazard (Biome: Quantum Void)', () => {
    it('should pull player toward singularity center when inside pullRadius', () => {
      const hazard = new ArenaHazard({
        type: 'quantum_singularity',
        x: 500,
        y: 500,
        pullRadius: 240,
        pullForce: 150,
        coreRadius: 40,
      });

      const player = {
        x: 650, // 150px away on X-axis
        y: 500,
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.1, player);
      assert.ok(player.x < 650, 'Player should be pulled left toward X=500');
      assert.equal(player.y, 500, 'Y position should stay aligned with center');
    });

    it('should NOT pull entities outside pullRadius', () => {
      const hazard = new ArenaHazard({
        type: 'quantum_singularity',
        x: 500,
        y: 500,
        pullRadius: 200,
      });

      const player = {
        x: 900,
        y: 500,
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.1, player);
      assert.equal(player.x, 900, 'Player outside pull radius should not move');
    });

    it('should deal void crush damage to entities inside coreRadius', () => {
      const hazard = new ArenaHazard({
        type: 'quantum_singularity',
        x: 500,
        y: 500,
        coreRadius: 40,
        pullRadius: 200,
      });

      const player = {
        x: 510,
        y: 500,
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.016, player);
      assert.ok(player.health < 100, 'Player in core radius should take crush damage');
    });
  });

  describe('6. Solar Laser Death Beam (Biome: Solar Archology)', () => {
    it('should rotate laser beam over time', () => {
      const hazard = new ArenaHazard({
        type: 'solar_laser',
        x: 500,
        y: 500,
        rotSpeed: 1.0,
        beamLength: 300,
      });

      const initialAngle = hazard.angle;
      hazard.update(0.5);
      assert.ok(Math.abs(hazard.angle - (initialAngle + 0.5)) < 0.001);
    });

    it('should deal laser burn damage to entities intersecting beam ray', () => {
      const hazard = new ArenaHazard({
        type: 'solar_laser',
        x: 500,
        y: 500,
        angle: 0, // Points strictly along +X axis
        rotSpeed: 0,
        beamLength: 300,
      });

      const playerOnBeam = {
        x: 650,
        y: 502, // 2px from line
        radius: 16,
        isDashing: false,
        health: 100,
        takeDamage(dmg: number) { this.health -= dmg; return dmg; },
      };

      hazard.update(0.016, playerOnBeam);
      assert.ok(playerOnBeam.health < 100, 'Player intersecting laser ray must take damage');
    });
  });

  describe('7. ArenaHazardSystem & Dynamic Lighting Synergy', () => {
    it('should initialize appropriate hazards on sector switch and clear previous', () => {
      const sys = new ArenaHazardSystem(3200, 3200, false);

      // Acid Matrix
      sys.initBiomeHazards('acid_matrix');
      assert.ok(sys.hazards.length >= 4);
      assert.ok(sys.hazards.every((h) => h.type === 'acid_pool'));

      // Crimson Foundry
      sys.initBiomeHazards('crimson_foundry');
      assert.ok(sys.hazards.length >= 4);
      assert.ok(sys.hazards.every((h) => h.type === 'magma_vent'));

      // Quantum Void
      sys.initBiomeHazards('quantum_void');
      assert.ok(sys.hazards.length >= 2);
      assert.ok(sys.hazards.every((h) => h.type === 'quantum_singularity'));
    });

    it('should extract dynamic lights for lighting engine from active hazards', () => {
      const sys = new ArenaHazardSystem(3200, 3200, false);
      sys.initBiomeHazards('acid_matrix');

      const lights = sys.getLights();
      assert.ok(lights.length >= 4);
      for (const l of lights) {
        assert.ok(typeof l.x === 'number');
        assert.ok(typeof l.y === 'number');
        assert.ok(typeof l.radius === 'number' && l.radius > 0);
        assert.ok(l.color && typeof l.color === 'string');
      }
    });

    it('should seamlessly integrate ArenaHazardSystem into LightingEngine', () => {
      const lighting = new LightingEngine(3200, 3200);
      assert.ok(lighting.hazardSystem, 'LightingEngine must possess hazardSystem instance');
      assert.ok(lighting.hazardSystem.hazards.length > 0, 'Default Sector 1 hazards should be initialized');

      // Switch biome to acid_matrix
      lighting.setBiomeByIndex(1, true);
      assert.ok(lighting.hazardSystem.hazards.every((h) => h.type === 'acid_pool'));
    });
  });

  describe('8. Camera Zoom Punch, Kickback & Screen FX', () => {
    it('should apply punchZoom and smoothly spring back to targetZoom', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      assert.equal(camera.zoom, 1.0);

      camera.punchZoom(0.1, 10.0);
      assert.ok(Math.abs(camera.zoom - 1.1) < 0.001, 'Zoom should immediately jump by +0.1');

      // Update 0.5s -> should lerp back close to 1.0
      camera.update(1600, 1600, 0.5);
      assert.ok(camera.zoom < 1.05, 'Zoom should decay toward 1.0');
    });

    it('should accurately transform screen to world and world to screen with zoom', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.x = 1000;
      camera.y = 1000;
      camera.zoom = 1.25;

      // Center point (viewportWidth / 2, viewportHeight / 2) -> should map exactly to camera (x, y)
      const worldCenter = camera.screenToWorld(500, 400);
      assert.ok(Math.abs(worldCenter.x - 1000) < 0.001);
      assert.ok(Math.abs(worldCenter.y - 1000) < 0.001);

      // Invert back to screen
      const screenCenter = camera.worldToScreen(1000, 1000);
      assert.ok(Math.abs(screenCenter.x - 500) < 0.001);
      assert.ok(Math.abs(screenCenter.y - 400) < 0.001);
    });

    it('should factor zoom into getVisibleBounds calculation', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.x = 1600;
      camera.y = 1600;

      // Base bounds at zoom = 1.0
      camera.zoom = 1.0;
      const b1 = camera.getVisibleBounds(0);
      assert.equal(b1.maxX - b1.minX, 1000);
      assert.equal(b1.maxY - b1.minY, 800);

      // Zoomed in (zoom = 2.0) -> visible world area halves
      camera.zoom = 2.0;
      const b2 = camera.getVisibleBounds(0);
      assert.equal(b2.maxX - b2.minX, 500);
      assert.equal(b2.maxY - b2.minY, 400);
    });

    it('should apply addKickback and decay exponentially', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.addKickback(0, 20); // 20px push to the right along X
      assert.ok(camera.kickX > 18);

      camera.update(1600, 1600, 0.5);
      assert.ok(camera.kickX < 2, 'Kickback should spring back near 0 after 0.5s');
    });

    it('should trigger screen glitch distortion and decay intensity', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.triggerGlitch(0.8, 0.3);
      assert.equal(camera.glitchIntensity, 0.8);
      assert.equal(camera.glitchTimer, 0.3);

      camera.update(1600, 1600, 0.35);
      assert.equal(camera.glitchIntensity, 0);
      assert.equal(camera.glitchTimer, 0);
    });

    it('should trigger fullscreen flash and fade alpha', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.triggerFlash('#00f0ff', 0.2);
      assert.equal(camera.flashAlpha, 1.0);
      assert.equal(camera.flashColor, '#00f0ff');

      camera.update(1600, 1600, 0.25);
      assert.equal(camera.flashAlpha, 0);
    });

    it('should render post-processing Screen FX without throwing on canvas mock', () => {
      const camera = new Camera(1000, 800, 3200, 3200);
      camera.triggerGlitch(0.5, 0.2);
      camera.triggerFlash('#ff0055', 0.3);

      const mockCtx: any = {
        save() {},
        restore() {},
        fillRect() {},
        strokeRect() {},
        createRadialGradient() {
          return { addColorStop() {} };
        },
      };

      assert.doesNotThrow(() => {
        camera.renderScreenFX(mockCtx, 1000, 800, {
          player: { health: 20, maxHealth: 100 },
          isBulletTime: true,
        });
      });
    });
  });

  describe('9. ParticleSystem Hazard VFX Pools & Emitters', () => {
    it('should emit acid bubbles, fire eruption, and vortex swirl from object pools with zero leak', () => {
      const ps = new ParticleSystem(500);

      ps.emitAcidBubbles(100, 100, 50, '#34d399', 5);
      assert.equal(ps.particles.length, 5);

      ps.emitFireEruption(200, 200, '#f97316', 15);
      assert.equal(ps.particles.length, 20);

      ps.emitVortexSwirl(300, 300, 80, '#c084fc', 8);
      assert.equal(ps.particles.length, 28);

      // Advance particles to expire
      ps.update(1.0);
      assert.equal(ps.particles.length, 0, 'All expired hazard particles should be recycled to pool');
      assert.equal(ps.particlePool.length, 28, 'Pool should contain 28 recycled particle instances');
    });
  });

  describe('10. High-Load Concurrency & Stress Verification', () => {
    it('should update 50 concurrent hazards across 200 moving enemies in < 20ms', () => {
      const sys = new ArenaHazardSystem(3200, 3200, false);
      for (let i = 0; i < 50; i++) {
        const types = ['acid_pool', 'emp_conduit', 'magma_vent', 'quantum_singularity', 'solar_laser'];
        sys.spawnHazard(types[i % types.length], (i * 60) % 3000, (i * 80) % 3000);
      }

      const enemies = [];
      for (let i = 0; i < 200; i++) {
        enemies.push({
          x: (i * 15) % 3000,
          y: (i * 25) % 3000,
          radius: 15,
          speed: 120,
          baseSpeed: 120,
          hp: 100,
          takeDamage(d: number) { this.hp -= d; return d; },
        });
      }

      const player = {
        x: 1600,
        y: 1600,
        radius: 16,
        isDashing: false,
        speedMultiplier: 1.0,
        health: 100,
        takeDamage(d: number) { this.health -= d; return d; },
      };

      const start = performance.now();
      for (let step = 0; step < 60; step++) {
        sys.update(0.016, player, enemies);
      }
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 500, `60 steps of 50 hazards x 200 enemies executed in ${elapsed.toFixed(2)}ms (must be < 500ms)`);
    });
  });

  describe('11. Centralized Management & Code Customization (vfxConfig)', () => {
    it('should read config values using dot notation and fallback gracefully', async () => {
      const { vfxConfig } = await import('../public/js/config/vfxConfig.js');
      assert.equal(vfxConfig.get('hazards.acid_pool.dps'), 18);
      assert.equal(vfxConfig.get('camera.maxShakeAngle'), 0.05);
      assert.equal(vfxConfig.get('non_existent.path', 'fallback_val'), 'fallback_val');
    });

    it('should allow modifying hazard parameters in code and affect newly spawned hazards', async () => {
      const { vfxConfig } = await import('../public/js/config/vfxConfig.js');

      // Customize in code
      vfxConfig.set('hazards.acid_pool.dps', 55);
      vfxConfig.set('hazards.acid_pool.slowFactor', 0.4);

      const customHazard = new ArenaHazard({ type: 'acid_pool', x: 100, y: 100 });
      assert.equal(customHazard.config.dps, 55);
      assert.equal(customHazard.config.slowFactor, 0.4);

      // Clean up reset
      vfxConfig.reset();
      assert.equal(vfxConfig.get('hazards.acid_pool.dps'), 18);
    });

    it('should batch update configurations using vfxConfig.update()', async () => {
      const { vfxConfig } = await import('../public/js/config/vfxConfig.js');

      vfxConfig.update({
        hazards: {
          magma_vent: { damage: 120, warningDuration: 0.6 },
        },
        camera: {
          maxShakeOffset: 45,
          zoom: { dashPunchAmount: 0.15 },
        },
        screenFx: {
          lowHealthVignette: { threshold: 0.5 },
        },
      });

      assert.equal(vfxConfig.get('hazards.magma_vent.damage'), 120);
      assert.equal(vfxConfig.get('hazards.magma_vent.warningDuration'), 0.6);
      assert.equal(vfxConfig.get('camera.maxShakeOffset'), 45);
      assert.equal(vfxConfig.get('camera.zoom.dashPunchAmount'), 0.15);
      assert.equal(vfxConfig.get('screenFx.lowHealthVignette.threshold'), 0.5);

      // Reset back to defaults
      vfxConfig.reset();
      assert.equal(vfxConfig.get('hazards.magma_vent.damage'), 48);
      assert.equal(vfxConfig.get('camera.maxShakeOffset'), 25);
    });

    it('should register custom new hazard types dynamically in code', async () => {
      const { vfxConfig } = await import('../public/js/config/vfxConfig.js');

      const customType = vfxConfig.registerHazardType('cryo_spire', {
        name: 'Cryogenic Freeze Spire',
        biomeId: 'quantum_void',
        defaultRadius: 90,
        slowFactor: 0.25, // 75% heavy freeze slow
        dps: 15,
        color: '#67e8f9',
        glowColor: 'rgba(103, 232, 249, 0.5)',
      });

      assert.ok(customType);
      assert.equal(customType.id, 'cryo_spire');

      const sys = new ArenaHazardSystem(3200, 3200, false);
      const spawned = sys.spawnHazard('cryo_spire', 500, 500);
      assert.equal(spawned.type, 'cryo_spire');
      assert.equal(spawned.config.slowFactor, 0.25);
      assert.equal(spawned.radius, 90);

      // Reset
      vfxConfig.reset();
    });

    it('should respect screenFx toggles when disabled in code', async () => {
      const { vfxConfig } = await import('../public/js/config/vfxConfig.js');
      const camera = new Camera(1000, 800, 3200, 3200);

      // Disable glitch slicing in code
      vfxConfig.set('screenFx.glitchSlicing.enabled', false);
      camera.triggerGlitch(0.8, 0.5);

      let fillRectCalls = 0;
      const mockCtx: any = {
        save() {},
        restore() {},
        fillRect() { fillRectCalls++; },
        strokeRect() {},
      };

      camera.renderScreenFX(mockCtx, 1000, 800, { player: { health: 100, maxHealth: 100 } });
      assert.equal(fillRectCalls, 0, 'No glitch slices should be rendered when glitchSlicing.enabled = false');

      // Reset
      vfxConfig.reset();
    });
  });
});
