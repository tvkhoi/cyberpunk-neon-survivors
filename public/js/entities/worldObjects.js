import { particleSystem } from '../vfx/particles.js';
import { soundEngine } from '../audio/soundEngine.js';

/**
 * Interactive POIs & Destructibles for Procedural Infinite Cyberpunk Arena
 * - Terminals: Stand to hack -> Orbital EMP Strike & high-value loot
 * - Barrels: Shoot to detonate -> Massive AOE plasma fire
 * - Shrines: Touch to consume temporary Overcharge buffs
 */
export class WorldObject {
  constructor(x, y, type = 'terminal', options = {}) {
    this.id = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.x = x;
    this.y = y;
    this.type = type;
    this.active = true;
    this.animTimer = Math.random() * 10;

    if (type === 'terminal') {
      this.radius = 28;
      this.hackRadius = 80;
      this.hackProgress = 0;
      this.hackMax = 3.5; // seconds inside radius to complete hack
      this.isHacked = false;
      this.color = '#00f0ff';
      this.hackSoundTimer = 0;
    } else if (type === 'barrel') {
      this.radius = 22;
      this.health = 30;
      this.maxHealth = 30;
      this.isExploded = false;
      this.color = '#ff3366';
      this.explosionRadius = 150;
      this.explosionDamage = 135;
    } else if (type === 'shrine') {
      this.radius = 24;
      this.buffType = options.buffType || (Math.random() < 0.34 ? 'overcharge' : (Math.random() < 0.5 ? 'haste' : 'shield'));
      this.isConsumed = false;
      this.color = this.buffType === 'overcharge' ? '#ffe600' : (this.buffType === 'haste' ? '#00f0ff' : '#39ff14');
    }
  }

  takeDamage(amount, gameContext = null) {
    if (this.type !== 'barrel' || this.isExploded) return false;
    this.health -= amount;
    particleSystem.emitSparks(this.x, this.y, this.color, 4, 120);

    if (this.health <= 0) {
      this.detonateBarrel(gameContext);
      return true;
    }
    return false;
  }

  detonateBarrel(gameContext = null) {
    if (this.isExploded) return;
    this.isExploded = true;
    this.active = false;

    // Detonation VFX
    particleSystem.emitShockwave(this.x, this.y, '#ff0055', this.explosionRadius * 1.5, 0.55);
    particleSystem.emitShockwave(this.x, this.y, '#ffaa00', this.explosionRadius, 0.4);
    particleSystem.emitSparks(this.x, this.y, '#ff3300', 35, 300);
    particleSystem.addFloatingText(this.x, this.y - 30, 'BOOM! PLASMA DETONATION!', '#ff3366', true);

    if (soundEngine.playExplosion) soundEngine.playExplosion();

    if (gameContext) {
      if (gameContext.camera && gameContext.camera.addTrauma) {
        gameContext.camera.addTrauma(0.45);
      }

      // Damage nearby enemies
      if (gameContext.enemies) {
        for (const e of gameContext.enemies) {
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d <= this.explosionRadius + e.radius) {
            e.takeDamage(this.explosionDamage);
            particleSystem.emitSparks(e.x, e.y, '#ffaa00', 8, 180);
          }
        }
      }

      // Damage player if caught in blast radius (reduced friendly fire)
      if (gameContext.player) {
        const pd = Math.hypot(gameContext.player.x - this.x, gameContext.player.y - this.y);
        if (pd <= this.explosionRadius + gameContext.player.radius) {
          gameContext.player.takeDamage(22);
          particleSystem.addFloatingText(gameContext.player.x, gameContext.player.y - 20, '-22 THÙNG NỔ!', '#ff0055', true);
        }
      }
    }
  }

  update(dt, player, gameContext) {
    if (!this.active) return;
    this.animTimer += dt;

    if (this.type === 'terminal' && !this.isHacked) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist <= this.hackRadius) {
        // Player is within terminal hacking zone
        this.hackProgress += dt;
        this.hackSoundTimer += dt;

        if (this.hackSoundTimer >= 0.35) {
          this.hackSoundTimer = 0;
          if (soundEngine.playLaser) soundEngine.playLaser();
          particleSystem.emitSparks(this.x, this.y, '#00f0ff', 3, 90);
        }

        if (this.hackProgress >= this.hackMax) {
          this.completeTerminalHack(player, gameContext);
        }
      } else {
        // Slowly decay hack progress if player leaves area
        this.hackProgress = Math.max(0, this.hackProgress - dt * 0.5);
      }
    } else if (this.type === 'shrine' && !this.isConsumed) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist <= this.radius + player.radius) {
        this.consumeShrine(player, gameContext);
      }
    }
  }

  completeTerminalHack(player, gameContext) {
    this.isHacked = true;
    this.color = '#39ff14';

    // Massive Orbital EMP Strike VFX
    particleSystem.emitShockwave(this.x, this.y, '#00f0ff', 380, 0.7);
    particleSystem.emitShockwave(player.x, player.y, '#39ff14', 280, 0.6);
    particleSystem.emitSparks(this.x, this.y, '#39ff14', 40, 320);
    particleSystem.addFloatingText(this.x, this.y - 45, 'HACK THÀNH CÔNG: ORBITAL EMP!', '#39ff14', true);

    if (soundEngine.playLevelUp) soundEngine.playLevelUp();
    if (soundEngine.announce) soundEngine.announce('Orbital EMP strike authorized');

    if (gameContext) {
      if (gameContext.camera && gameContext.camera.addTrauma) {
        gameContext.camera.addTrauma(0.5);
      }

      // Orbital EMP wipes or heavily damages all regular enemies on screen
      if (gameContext.enemies) {
        for (const e of gameContext.enemies) {
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d <= 950) {
            e.takeDamage(e.isElite ? 180 : 350);
            particleSystem.emitSparks(e.x, e.y, '#00f0ff', 10, 220);
          }
        }
      }

      // Grant player XP & score bonus
      if (typeof gameContext.score === 'number') {
        gameContext.score += 2500;
      }
      if (typeof player.addXP === 'function') {
        player.addXP(120);
      } else if (typeof player.gainXp === 'function') {
        player.gainXp(120);
      }

      // Charge Overclock gauge by +35%
      if (typeof player.chargeOverclock === 'function') {
        player.chargeOverclock(35);
      }
    }
  }

  consumeShrine(player, gameContext) {
    this.isConsumed = true;
    this.active = false;

    particleSystem.emitShockwave(player.x, player.y, this.color, 180, 0.5);
    particleSystem.emitSparks(player.x, player.y, this.color, 25, 240);

    if (soundEngine.playLevelUp) soundEngine.playLevelUp();

    if (this.buffType === 'overcharge') {
      if (gameContext && gameContext.weapons) {
        gameContext.applyWeaponOvercharge(8.0);
      }
      particleSystem.addFloatingText(player.x, player.y - 30, '⚡ OVERCHARGE: 2X FIRE RATE!', '#ffe600', true);
      if (soundEngine.announce) soundEngine.announce('Weapon overcharge activated');
    } else if (this.buffType === 'haste') {
      player.triggerHyperBoost(8.0);
      particleSystem.addFloatingText(player.x, player.y - 30, '⚡ HASTE: TỐC ĐỘ +50%!', '#00f0ff', true);
      if (soundEngine.announce) soundEngine.announce('Haste overdrive engaged');
    } else if (this.buffType === 'shield') {
      player.shield = Math.min(player.maxShield * 1.5, player.shield + player.maxShield);
      particleSystem.addFloatingText(player.x, player.y - 30, '🛡️ CYBER OVERSHIELD +100%!', '#39ff14', true);
      if (soundEngine.announce) soundEngine.announce('Cyber overshield online');
    }
  }

  render(ctx) {
    if (!this.active && !this.isHacked) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'terminal') {
      // 1. Hack Range Ring (if not yet hacked)
      if (!this.isHacked) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, this.hackRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Hack Progress Circular Fill
        if (this.hackProgress > 0) {
          const pct = this.hackProgress / this.hackMax;
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(0, 0, this.hackRadius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Terminal Pedestal
      ctx.fillStyle = '#060a17';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * this.radius;
        const py = Math.sin(a) * this.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3. Rotating Hologram Rings
      ctx.save();
      ctx.rotate(this.animTimer * 1.5);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4. Central Terminal Core
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7 + Math.sin(this.animTimer * 4) * 2, 0, Math.PI * 2);
      ctx.fill();

      // 5. Overhead Label
      ctx.font = 'bold 9px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      const label = this.isHacked
        ? '[HACKED: EMP ONLINE]'
        : (this.hackProgress > 0 ? `HACKING: ${Math.round((this.hackProgress / this.hackMax) * 100)}%` : '[DATA TERMINAL]');
      ctx.fillText(label, 0, -this.radius - 8);

    } else if (this.type === 'barrel') {
      // 1. Red Warning Aura
      ctx.fillStyle = 'rgba(255, 51, 102, 0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // 2. Heavy Armored Drum Base
      ctx.fillStyle = '#1a050f';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. Hazard Stripes
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffaa00';
      for (let s = -30; s < 30; s += 8) {
        ctx.fillRect(s + Math.sin(this.animTimer * 2) * 2, -25, 4, 50);
      }
      ctx.restore();

      // 4. Glowing Plasma Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // 5. HP Bar
      const hpPct = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = '#330011';
      ctx.fillRect(-18, -this.radius - 8, 36, 4);
      ctx.fillStyle = '#ff3366';
      ctx.fillRect(-18, -this.radius - 8, 36 * hpPct, 4);

    } else if (this.type === 'shrine') {
      // 1. Pulsing Energy Beacon
      const pulse = Math.sin(this.animTimer * 3) * 4;
      ctx.fillStyle = this.color + '22';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // 2. Levitating Crystal Diamond
      ctx.save();
      ctx.rotate(this.animTimer * 0.8);
      ctx.strokeStyle = this.color;
      ctx.fillStyle = '#0a1020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 3. Central Luminous Core
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // 4. Overhead Label
      ctx.font = 'bold 9px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      const buffLabel = this.buffType === 'overcharge' ? '[OVERCHARGE POD]' : (this.buffType === 'haste' ? '[HASTE POD]' : '[OVERSHIELD POD]');
      ctx.fillText(buffLabel, 0, -this.radius - 8);
    }

    ctx.restore();
  }
}

export class WorldObjectManager {
  constructor() {
    this.objects = [];
    this.spawnTimer = 0;
    this.spawnInterval = 7.0; // spawn check interval
  }

  update(dt, player, gameContext) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.maintainWorldPopulation(player);
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.update(dt, player, gameContext);

      // Cull far away objects in infinite arena (> 2600px from player)
      const dist = Math.hypot(obj.x - player.x, obj.y - player.y);
      if (!obj.active && obj.type !== 'terminal') {
        this.objects.splice(i, 1);
      } else if (dist > 2800) {
        this.objects.splice(i, 1);
      }
    }
  }

  maintainWorldPopulation(player) {
    if (this.objects.length >= 14) return;

    // Procedural distribution: spawn in ring around player (600 to 1400px away)
    const angle = Math.random() * Math.PI * 2;
    const dist = 650 + Math.random() * 750;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    const roll = Math.random();
    if (roll < 0.4) {
      this.objects.push(new WorldObject(x, y, 'barrel'));
    } else if (roll < 0.75) {
      this.objects.push(new WorldObject(x, y, 'shrine'));
    } else {
      this.objects.push(new WorldObject(x, y, 'terminal'));
    }
  }

  checkProjectileCollisions(projectiles, gameContext) {
    for (const p of projectiles) {
      if (p.life <= 0) continue;
      for (const obj of this.objects) {
        if (!obj.active || obj.type !== 'barrel') continue;
        const d = Math.hypot(p.x - obj.x, p.y - obj.y);
        if (d <= p.radius + obj.radius) {
          const destroyed = obj.takeDamage(p.damage || 25, gameContext);
          p.life = 0; // consume projectile
          if (destroyed) break;
        }
      }
    }
  }

  render(ctx) {
    for (const obj of this.objects) {
      obj.render(ctx);
    }
  }

  clear() {
    this.objects.length = 0;
  }
}
