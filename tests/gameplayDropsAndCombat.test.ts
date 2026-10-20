import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../public/js/entities/player.js';
import { WeaponManager } from '../public/js/entities/weapons.js';
import { Enemy } from '../public/js/entities/enemies.js';
import { CollectibleDrop, DROP_CONFIGS } from '../public/js/entities/drops.js';

describe('Module 4: Collectible Drops, Bullet Upgrades & Enemy Damage Tests', () => {
  it('1. Player Heal Mechanics: restores health and cyber shield accurately without exceeding maximums', () => {
    const player = new Player(100, 100);
    player.health = 40;
    player.shield = 10;

    // Heal 35 HP
    const res = player.heal(35);
    assert.equal(player.health, 75);
    assert.equal(player.shield, 10 + Math.round(35 * 0.5));
    assert.equal(res.restored, 35);

    // Over-healing clamps to maxHealth (100) and maxShield (50)
    player.heal(100);
    assert.equal(player.health, player.maxHealth);
    assert.equal(player.shield, player.maxShield);
  });

  it('2. Player Bullet Impact & Damage: absorbs damage via shield first then health, immune during Dash', () => {
    const player = new Player(100, 100);
    player.health = 100;
    player.shield = 50;

    // Bullet deals 30 damage -> shield takes all 30
    const dmg1 = player.takeDamage(30);
    assert.equal(dmg1, 0, 'No direct health damage when shield absorbs');
    assert.equal(player.shield, 20);
    assert.equal(player.health, 100);

    // Bullet deals 35 damage -> shield takes 20, health takes 15
    const dmg2 = player.takeDamage(35);
    assert.equal(dmg2, 15, '15 damage pierced shield to health');
    assert.equal(player.shield, 0);
    assert.equal(player.health, 85);

    // Dashing gives 100% invulnerability
    player.isDashing = true;
    const dashDmg = player.takeDamage(50);
    assert.equal(dashDmg, 0);
    assert.equal(player.health, 85, 'Health must not decrease during dash');
  });

  it('3. Weapon Upgrades via Ammo Crates: unlocks weapons and scales damage & fire rate', () => {
    const weapons = new WeaponManager();
    const player = new Player(100, 100);

    // Initially, Laser is locked (level 0)
    assert.equal(weapons.weapons.laser.level, 0);

    // Pick up Laser Ammo
    const up1 = weapons.upgradeWithAmmo('laser', player);
    assert.equal(up1?.isUnlocked, true);
    assert.equal(weapons.weapons.laser.level, 1);
    const lvl1Damage = weapons.weapons.laser.damage;

    // Pick up Laser Ammo again -> level 2, damage increases
    const up2 = weapons.upgradeWithAmmo('laser', player);
    assert.equal(up2?.isUnlocked, false);
    assert.equal(weapons.weapons.laser.level, 2);
    assert.ok(weapons.weapons.laser.damage > lvl1Damage);

    // EMP Shotgun upgrade
    assert.equal(weapons.weapons.shotgun.level, 0);
    weapons.upgradeWithAmmo('shotgun', player);
    assert.equal(weapons.weapons.shotgun.level, 1);

    // Orbit Shield upgrade
    assert.equal(weapons.weapons.orbit.level, 0);
    weapons.upgradeWithAmmo('orbit', player);
    assert.equal(weapons.weapons.orbit.level, 1);
  });

  it('4. Collectible Drops: magnet pull pulls drop toward player within magnet radius', () => {
    const player = new Player(500, 500);
    const drop = new CollectibleDrop(550, 500, 'health');

    const initialDist = Math.hypot(player.x - drop.x, player.y - drop.y);
    assert.equal(initialDist, 50);

    // Update with dt -> magnet pulls drop closer to player
    drop.update(0.1, player);
    const newDist = Math.hypot(player.x - drop.x, player.y - drop.y);
    assert.ok(newDist < initialDist, 'Drop must be pulled toward player');
  });

  it('5. Enemy Ranged Projectiles: Swarmer and Sniper generate bullets with correct damage and velocity', () => {
    const player = new Player(200, 200);
    const swarmer = new Enemy(350, 200, 'swarmer', 1);

    // Force swarmer shoot cooldown trigger
    swarmer.shootTimer = swarmer.shootCooldown;
    swarmer.update(0.016, player, []);

    assert.ok(swarmer.enemyBullets.length > 0, 'Swarmer should fire plasma dart');
    const bullet = swarmer.enemyBullets[0];
    assert.equal(bullet.damage, swarmer.damage);
    assert.ok(bullet.life > 0);

    // Sniper charging & shooting
    const sniper = new Enemy(600, 200, 'sniper', 2);
    sniper.aimTimer = sniper.aimCooldown + sniper.chargeTime;
    sniper.update(0.016, player, []);

    assert.ok(sniper.enemyBullets.length > 0, 'Sniper should fire laser bolt');
    const sniperBullet = sniper.enemyBullets[0];
    assert.equal(sniperBullet.color, '#a855f7');
    assert.equal(sniperBullet.damage, sniper.damage);
  });
});
