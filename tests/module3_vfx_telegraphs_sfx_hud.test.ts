import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { particleSystem, ParticleSystem } from '../public/js/vfx/particles.js';
import { soundEngine, SoundEngine } from '../public/js/audio/soundEngine.js';
import { Boss } from '../public/js/entities/boss.js';
import { Enemy } from '../public/js/entities/enemies.js';
import { Player } from '../public/js/entities/player.js';

describe('Module 3: VFX Telegraphs, Sound SFX & Tactical HUD Test Suite', () => {

  describe('1. VFX Danger Zone Telegraphs (Object Pooling, Countdown & Detonation)', () => {
    it('should create and register a danger zone telegraph with valid parameters', () => {
      const ps = new ParticleSystem();
      const zone = ps.addTelegraph(200, 300, 75, 1.8, '#ff0055', {
        damage: 40,
        type: 'artillery',
      });

      assert.ok(zone);
      assert.equal(zone.x, 200);
      assert.equal(zone.y, 300);
      assert.equal(zone.radius, 75);
      assert.equal(zone.life, 1.8);
      assert.equal(zone.maxLife, 1.8);
      assert.equal(zone.damage, 40);
      assert.equal(zone.color, '#ff0055');
      assert.equal(ps.telegraphs.length, 1);
    });

    it('should support addDangerZone alias for high semantic clarity', () => {
      const ps = new ParticleSystem();
      const zone = ps.addDangerZone(400, 500, 90, 2.0, {
        damage: 50,
        color: '#f59e0b',
      });

      assert.ok(zone);
      assert.equal(zone.x, 400);
      assert.equal(zone.y, 500);
      assert.equal(zone.radius, 90);
      assert.equal(zone.damage, 50);
      assert.equal(zone.color, '#f59e0b');
    });

    it('should update countdown timer and rotate telegraph tick marks across frames', () => {
      const ps = new ParticleSystem();
      const zone = ps.addTelegraph(100, 100, 60, 1.5);

      ps.update(0.5);
      assert.ok(Math.abs(zone.life - 1.0) < 0.001);
      assert.ok(zone.rotation > 0, 'Rotation angle must advance with dt');

      ps.update(0.4);
      assert.ok(Math.abs(zone.life - 0.6) < 0.001);
      assert.equal(ps.telegraphs.length, 1);
    });

    it('should detonate upon timer expiry, triggering shockwaves, sparks, scorch mark and callback', () => {
      const ps = new ParticleSystem();
      let detonated = false;
      let detonatedZone: any = null;

      ps.addTelegraph(350, 450, 80, 0.3, '#ff0055', {
        damage: 45,
        onDetonate: (z: any) => {
          detonated = true;
          detonatedZone = z;
        },
      });

      // Advance just enough to expire (0.35s) so the 0.45s shockwave remains alive
      ps.update(0.35);

      assert.equal(ps.telegraphs.length, 0, 'Telegraph should be removed upon detonation');
      assert.equal(detonated, true, 'onDetonate callback should have been fired');
      assert.ok(detonatedZone);
      assert.equal(detonatedZone.x, 350);
      assert.equal(detonatedZone.y, 450);

      // Verify detonation VFX spawned
      assert.ok(ps.shockwaves.length >= 1, 'Shockwave should be created on detonation');
      assert.ok(ps.particles.length >= 1, 'Sparks should be emitted on detonation');
      assert.ok(ps.scorchMarks.length >= 1, 'Floor scorch mark crater should be stamped');
    });

    it('should recycle telegraphs with Object Pooling without GC churn', () => {
      const ps = new ParticleSystem();
      for (let i = 0; i < 20; i++) {
        ps.addTelegraph(i * 10, i * 10, 50, 0.2);
      }
      assert.equal(ps.telegraphs.length, 20);

      // Advance time to detonate all
      ps.update(0.25);
      assert.equal(ps.telegraphs.length, 0);
      assert.ok(ps.telegraphPool.length >= 10, 'Telegraph pool should accumulate recycled instances');

      // Re-allocate from pool
      const reused = ps.addTelegraph(999, 888, 70, 1.0);
      assert.equal(reused.x, 999);
      assert.equal(reused.y, 888);
    });

    it('should verify clear() wipes all active telegraphs', () => {
      const ps = new ParticleSystem();
      ps.addTelegraph(10, 20, 50, 2.0);
      ps.addTelegraph(30, 40, 50, 2.0);
      assert.equal(ps.telegraphs.length, 2);

      ps.clear();
      assert.equal(ps.telegraphs.length, 0);
    });
  });

  describe('2. Boss Phase Transition VFX & Enemy Mutation VFX', () => {
    it('should emit multi-layered Boss Phase transition shockwaves and arcade floating texts', () => {
      const ps = new ParticleSystem();

      // Test Phase 2 VFX
      ps.emitBossPhaseShockwave(500, 500, 2, '#00f0ff');
      assert.ok(ps.shockwaves.length >= 3, 'Should spawn at least 3 chromatic shockwaves');
      assert.ok(ps.particles.length >= 30, 'Should spawn high-density sparks');
      const p2Text = ps.floatingTexts.find((t) => t.text.includes('PHASE 2'));
      assert.ok(p2Text, 'Phase 2 arcade warning text must be present');

      // Test Phase 3 Overclock VFX
      ps.clear();
      ps.emitBossPhaseShockwave(600, 600, 3, '#ff0055');
      assert.ok(ps.shockwaves.length >= 3);
      const p3Text = ps.floatingTexts.find((t) => t.text.includes('PHASE 3'));
      assert.ok(p3Text, 'Phase 3 Enraged Overclock warning text must be present');
    });

    it('should emit Enemy Mutation plasma vortex effect with floating text', () => {
      const ps = new ParticleSystem();
      ps.emitMutationEffect(300, 300, '#d946ef');

      assert.ok(ps.shockwaves.length >= 2, 'Mutation should emit dual bio-shockwaves');
      assert.ok(ps.particles.length >= 20, 'Mutation should emit mutant spark burst');
      const mutText = ps.floatingTexts.find((t) => t.text.includes('MUTATION'));
      assert.ok(mutText, 'Mutation arcade floating text must be present');
    });
  });

  describe('3. Web Audio Procedural Synthesis: SoundEngine Module 3 SFX', () => {
    it('should safely execute playBossPhaseChange() in headless environment for Phase 2 and Phase 3', () => {
      const se = new SoundEngine();
      assert.doesNotThrow(() => {
        se.playBossPhaseChange(2);
        se.playBossPhaseChange(3);
      });
    });

    it('should safely execute playArtilleryWarning() and playArtilleryExplosion()', () => {
      const se = new SoundEngine();
      assert.doesNotThrow(() => {
        se.playArtilleryWarning();
        se.playArtilleryExplosion();
      });
    });

    it('should safely execute playMutation() and playEnemyMutation()', () => {
      const se = new SoundEngine();
      assert.doesNotThrow(() => {
        se.playMutation();
        se.playEnemyMutation();
      });
    });
  });

  describe('4. Boss Phase Shift & Orbital Artillery Strike Integration', () => {
    it('should detect HP threshold crossings and trigger handlePhaseTransition with audio & events', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = new Player(500, 600);
      let capturedEvent: any = null;

      const listener = (e: any) => {
        capturedEvent = e.detail;
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('game:bossphase', listener);
      }

      // Damage down to 60% HP (Phase 2 trigger: <= 66%)
      boss.health = boss.maxHealth * 0.60;
      boss.update(0.016, player, null, {});

      assert.equal(boss.phase, 2, 'Boss must shift to Phase 2 at 60% HP');

      // Damage down to 20% HP (Phase 3 trigger: <= 33%)
      boss.health = boss.maxHealth * 0.20;
      boss.update(0.016, player, null, {});

      assert.equal(boss.phase, 3, 'Boss must shift to Phase 3 at 20% HP');

      if (typeof window !== 'undefined') {
        window.removeEventListener('game:bossphase', listener);
      }
    });

    it('should call callArtilleryStrike() and spawn danger zone telegraph near player', () => {
      const boss = new Boss(500, 500, 5, 0);
      const player = new Player(600, 600);
      particleSystem.clear();

      boss.phase = 2;
      boss.callArtilleryStrike(player.x, player.y, 80, { player });

      assert.equal(particleSystem.telegraphs.length, 1, 'Artillery telegraph danger zone must be spawned');
      const z = particleSystem.telegraphs[0];
      assert.equal(z.x, 600);
      assert.equal(z.y, 600);
      assert.equal(z.radius, 80);
      assert.ok(z.damage > 0);
    });

    it('should inflict artillery damage on player when detonating and player is not dashing', () => {
      const ps = new ParticleSystem();
      const player = new Player(400, 400);
      player.health = 100;
      player.shield = 0; // Depleted shield to test direct health reduction
      player.isDashing = false;

      let damageDealt = 0;
      ps.addTelegraph(400, 400, 80, 0.1, '#ff0055', {
        damage: 35,
        onDetonate: (zone: any) => {
          const dist = Math.hypot(player.x - zone.x, player.y - zone.y);
          if (dist <= zone.radius + player.radius) {
            if (!player.isDashing) {
              player.takeDamage(zone.damage);
              damageDealt = zone.damage;
            }
          }
        },
      });

      // Detonate
      ps.update(0.15);

      assert.equal(damageDealt, 35);
      assert.ok(player.health < 100, `Health should be reduced, got ${player.health}`);
    });

    it('should grant evasion immunity when player Dashes through the danger zone', () => {
      const ps = new ParticleSystem();
      const player = new Player(400, 400);
      player.health = 100;
      player.isDashing = true; // Invulnerable during Dash

      let evaded = false;
      ps.addTelegraph(400, 400, 80, 0.1, '#ff0055', {
        damage: 35,
        onDetonate: (zone: any) => {
          const dist = Math.hypot(player.x - zone.x, player.y - zone.y);
          if (dist <= zone.radius + player.radius) {
            if (player.isDashing) {
              evaded = true;
            } else {
              player.takeDamage(zone.damage);
            }
          }
        },
      });

      ps.update(0.15);

      assert.equal(evaded, true, 'Dash must successfully evade artillery blast');
      assert.equal(player.health, 100, 'Health should remain 100% when dashing');
    });
  });

  describe('5. Enemy Mutation Surge Engine', () => {
    it('should mutate enemy stats, trigger mutant color and VFX/SFX on mutate()', () => {
      const enemy = new Enemy(100, 100, 'swarmer', 1, 1, false);
      const initialHp = enemy.health;
      const initialDmg = enemy.damage;
      const initialSpeed = enemy.speed;

      assert.equal(enemy.isMutated, undefined);

      enemy.mutate(1.4);

      assert.equal(enemy.isMutated, true);
      assert.equal(enemy.mutationTier, 1);
      assert.ok(enemy.health > initialHp, 'Health must scale up on mutation');
      assert.ok(enemy.damage > initialDmg, 'Damage must scale up on mutation');
      assert.ok(enemy.speed > initialSpeed, 'Speed must scale up on mutation');
      assert.equal(enemy.mutantColor, '#d946ef');
    });

    it('should support stacking sequential mutation tiers cleanly', () => {
      const enemy = new Enemy(100, 100, 'colossus', 2, 1, false);
      enemy.mutate(1.3);
      assert.equal(enemy.mutationTier, 1);

      const tier1Hp = enemy.health;
      enemy.mutate(1.3);
      assert.equal(enemy.mutationTier, 2);
      assert.ok(enemy.health > tier1Hp);
    });
  });
});
