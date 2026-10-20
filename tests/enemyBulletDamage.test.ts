import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../public/js/entities/player.js';
import { Enemy } from '../public/js/entities/enemies.js';

describe('Module 5: Enemy Bullet Damage & Player Health Deduction Verification', () => {
  it('1. Shield Absorption: Enemy bullet first damages Shield while Health remains 100%', () => {
    const player = new Player(200, 200);
    assert.equal(player.health, 100, 'Initial health must be 100');
    assert.equal(player.shield, 50, 'Initial shield must be 50');

    // Bullet hit 1: Swarmer plasma dart (10 damage)
    const bulletDmg1 = 10;
    const overflow1 = player.takeDamage(bulletDmg1);

    assert.equal(overflow1, 0, 'Damage was fully absorbed by shield, 0 overflow');
    assert.equal(player.shield, 40, 'Shield reduced from 50 to 40');
    assert.equal(player.health, 100, 'Health remains untouched at 100%');

    // Bullet hit 2: Sniper laser bolt (25 damage)
    const bulletDmg2 = 25;
    const overflow2 = player.takeDamage(bulletDmg2);

    assert.equal(overflow2, 0, 'Damage was fully absorbed by shield');
    assert.equal(player.shield, 15, 'Shield reduced from 40 to 15');
    assert.equal(player.health, 100, 'Health STILL remains untouched at 100%');
  });

  it('2. Health Deduction: When Shield is depleted, subsequent Enemy bullets deduct Health directly', () => {
    const player = new Player(200, 200);
    player.shield = 10; // low shield left
    player.health = 100;

    // Bullet hit with 25 damage (10 absorbed by shield, 15 hits health)
    const overflow = player.takeDamage(25);

    assert.equal(overflow, 15, '15 damage broke through shield to health');
    assert.equal(player.shield, 0, 'Shield is now 0');
    assert.equal(player.health, 85, 'Health reduced from 100 to 85!');

    // Another bullet hit (20 damage with 0 shield)
    const directHit = player.takeDamage(20);
    assert.equal(directHit, 20);
    assert.equal(player.shield, 0);
    assert.equal(player.health, 65, 'Health reduced from 85 to 65!');
  });

  it('3. Lethal Damage & Game Over: Player dies when Health reaches 0', () => {
    const player = new Player(200, 200);
    player.shield = 0;
    player.health = 30;

    // Fatal hit
    player.takeDamage(50);
    assert.equal(player.health, 0, 'Health clamped to 0');
  });

  it('4. Dash Invulnerability: Bullets deal 0 damage if Player is dashing', () => {
    const player = new Player(200, 200);
    player.isDashing = true; // dashing active

    const damageTaken = player.takeDamage(999);
    assert.equal(damageTaken, 0, 'Player is invulnerable during dash');
    assert.equal(player.shield, 50, 'Shield intact');
    assert.equal(player.health, 100, 'Health intact');
  });

  it('5. Enemy Bullet Firing Verification: Enemies successfully spawn bullets with positive damage', () => {
    const swarmer = new Enemy(300, 300, 'swarmer', 1);
    const player = new Player(200, 200);

    // Simulate swarmer firing cooldown elapse
    swarmer.shootTimer = 5.0; // ready to shoot
    swarmer.update(0.016, player, [swarmer]);

    assert.ok(swarmer.enemyBullets.length > 0, 'Swarmer should fire a plasma dart');
    const bullet = swarmer.enemyBullets[0];
    assert.ok(bullet.damage > 0, 'Bullet must have positive damage property');
    assert.equal(bullet.damage, swarmer.damage);
  });
});
