import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../public/js/entities/player.js';
import { Enemy } from '../public/js/entities/enemies.js';

import { calculateDamage } from '../src/combat.js';

describe('Module 5: Combat & Critical Damage Calculation Tests', () => {
  it('should accurately calculate normal (non-crit) damage', () => {
    // roll >= critChance -> non-crit
    const result = calculateDamage(28, 1.0, 0.15, 2.0, 0.5);
    assert.equal(result.isCrit, false);
    assert.equal(result.finalDamage, 28);
  });

  it('should accurately calculate critical hit damage with multiplier', () => {
    // roll < critChance -> crit
    const result = calculateDamage(28, 1.0, 0.15, 2.0, 0.1);
    assert.equal(result.isCrit, true);
    assert.equal(result.finalDamage, 56); // 28 * 2.0
  });

  it('should compound damage multipliers and crit multipliers correctly', () => {
    // Base 45 (Reflective Laser), with 1.5x damage buff and 2.5x crit multiplier
    const nonCrit = calculateDamage(45, 1.5, 0.2, 2.5, 0.8);
    assert.equal(nonCrit.isCrit, false);
    assert.equal(nonCrit.finalDamage, Math.round(45 * 1.5)); // 68

    const crit = calculateDamage(45, 1.5, 0.2, 2.5, 0.05);
    assert.equal(crit.isCrit, true);
    assert.equal(crit.finalDamage, Math.round(45 * 1.5 * 2.5)); // 169
  });

  it('should match theoretical crit chance in statistical trial (Monte Carlo 5,000 rolls)', () => {
    const trials = 5000;
    const critChance = 0.15;
    let critCount = 0;

    for (let i = 0; i < trials; i++) {
      const { isCrit } = calculateDamage(20, 1.0, critChance, 2.0);
      if (isCrit) {
        critCount++;
      }
    }

    const empiricalRate = critCount / trials;
    // For 5,000 samples with p=0.15, standard error is sqrt(0.15 * 0.85 / 5000) ~ 0.005
    // Margin of 0.02 covers > 99.99% confidence interval
    assert.ok(
      Math.abs(empiricalRate - critChance) < 0.025,
      `Empirical crit rate ${empiricalRate.toFixed(4)} outside expected range [0.125, 0.175]`
    );
  });

  it('should apply damage to Enemy and detect lethal hits', () => {
    const swarmer = new Enemy(100, 100, 'swarmer', 1);
    const initialHealth = swarmer.health; // 25 + 6 = 31

    // Non-lethal hit
    const lethal1 = swarmer.takeDamage(15);
    assert.equal(lethal1, false);
    assert.equal(swarmer.health, initialHealth - 15);

    // Lethal crit hit
    const lethal2 = swarmer.takeDamage(50);
    assert.equal(lethal2, true);
    assert.ok(swarmer.health <= 0);
  });

  it('should absorb damage via Player shield before touching health', () => {
    const player = new Player(200, 200);
    player.health = 100;
    player.shield = 50;

    // Hit for 30 (fully absorbed by shield)
    const overflow1 = player.takeDamage(30);
    assert.equal(overflow1, 0, 'No overflow damage to health');
    assert.equal(player.shield, 20);
    assert.equal(player.health, 100);
    assert.equal(player.shieldCooldown, 3.0);

    // Hit for 35 (20 shield + 15 to health)
    const overflow2 = player.takeDamage(35);
    assert.equal(overflow2, 15, '15 overflow damage applied to health');
    assert.equal(player.shield, 0);
    assert.equal(player.health, 85);
  });

  it('should grant 100% damage invulnerability to Player during Dash', () => {
    const player = new Player(200, 200);
    player.health = 100;
    player.shield = 50;
    player.isDashing = true; // dashing active

    const damageTaken = player.takeDamage(999);
    assert.equal(damageTaken, 0, 'Invulnerable while dashing');
    assert.equal(player.shield, 50, 'Shield intact');
    assert.equal(player.health, 100, 'Health intact');
  });
});
