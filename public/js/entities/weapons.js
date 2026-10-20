import { particleSystem } from '../vfx/particles.js';
import { soundEngine } from '../audio/soundEngine.js';

export class WeaponManager {
  constructor() {
    this.weapons = {
      homing: {
        id: 'homing',
        name: 'Plasma Homing Missiles',
        level: 1,
        fireRate: 0.65, // seconds between shots
        baseFireRate: 0.65,
        timer: 0,
        damage: 28,
        baseDamage: 28,
        color: '#00f0ff',
      },
      laser: {
        id: 'laser',
        name: 'Reflective Laser',
        level: 0, // unlockable
        fireRate: 1.1,
        baseFireRate: 1.1,
        timer: 0,
        damage: 45,
        baseDamage: 45,
        color: '#ff007f',
      },
      shotgun: {
        id: 'shotgun',
        name: 'EMP Shotgun',
        level: 0,
        fireRate: 0.85,
        baseFireRate: 0.85,
        timer: 0,
        damage: 18,
        baseDamage: 18,
        pellets: 6,
        color: '#ffff00',
      },
      orbit: {
        id: 'orbit',
        name: 'Orbit Shield',
        level: 0,
        orbs: 3,
        radius: 65,
        angle: 0,
        damage: 22,
        baseDamage: 22,
        color: '#39ff14',
      },
    };

    this.projectiles = [];
  }

  update(dt, player, enemies, worldWidth, worldHeight) {
    // 1. Update Cooldowns and Auto-Fire
    for (const key in this.weapons) {
      const w = this.weapons[key];
      if (w.level <= 0) continue;

      if (key !== 'orbit') {
        w.timer -= dt;
        if (w.timer <= 0) {
          this.fireWeapon(key, player, enemies);
          w.timer = w.fireRate;
        }
      }
    }

    // 2. Update Orbit Shield Rotation
    if (this.weapons.orbit.level > 0) {
      this.weapons.orbit.angle += 3.5 * dt;
    }

    // 3. Update Active Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Homing Steering Logic
      if (p.isHoming && enemies.length > 0) {
        let nearest = null;
        let minDist = 600;
        for (const e of enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const targetAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
          let diff = targetAngle - p.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          p.angle += Math.sign(diff) * Math.min(Math.abs(diff), 8.0 * dt);
          p.vx = Math.cos(p.angle) * p.speed;
          p.vy = Math.sin(p.angle) * p.speed;
        }
      }

      // Reflective Laser Bounce Logic
      if (p.isLaser && p.bouncesLeft > 0 && Number.isFinite(worldWidth) && Number.isFinite(worldHeight)) {
        let bounced = false;
        if (p.x <= p.radius || p.x >= worldWidth - p.radius) {
          p.vx = -p.vx;
          p.angle = Math.atan2(p.vy, p.vx);
          bounced = true;
        }
        if (p.y <= p.radius || p.y >= worldHeight - p.radius) {
          p.vy = -p.vy;
          p.angle = Math.atan2(p.vy, p.vx);
          bounced = true;
        }
        if (bounced) {
          p.bouncesLeft--;
          particleSystem.emitSparks(p.x, p.y, p.color, 6, 120);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Particle Trail
      if (p.isHoming && Math.random() < 0.6) {
        particleSystem.emitSparks(p.x, p.y, p.color, 1, 40);
      }

      // Check bounds or expiry (handles both finite world and infinite procedural arena)
      const isOutOfBounds = Number.isFinite(worldWidth) && Number.isFinite(worldHeight)
        ? (p.x < -100 || p.x > worldWidth + 100 || p.y < -100 || p.y > worldHeight + 100)
        : (Math.hypot(p.x - player.x, p.y - player.y) > 2200);

      if (p.life <= 0 || isOutOfBounds) {
        // Hyperion Swarm Overdrive: Spawns 2 Micro-Seekers on expiration
        if (p.isHyperion && !p.hasSpawnedMicro && !isOutOfBounds) {
          p.hasSpawnedMicro = true;
          for (let m = 0; m < 2; m++) {
            const ma = p.angle + (m === 0 ? 0.75 : -0.75);
            this.projectiles.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(ma) * 380,
              vy: Math.sin(ma) * 380,
              angle: ma,
              speed: 380,
              radius: 4,
              damage: Math.round(p.damage * 0.55),
              color: '#00f0ff',
              isHoming: true,
              life: 1.5,
            });
          }
          particleSystem.emitSparks(p.x, p.y, '#a855f7', 8, 140);
        }

        this.projectiles.splice(i, 1);
      }
    }
  }

  fireWeapon(type, player, enemies) {
    if (player && player.triggerRecoil) {
      player.triggerRecoil(type === 'shotgun' ? 5.5 : (type === 'laser' ? 4.0 : 2.8));
    }

    if (type === 'homing') {
      const w = this.weapons.homing;
      const count = w.isOverdrive ? 6 : Math.min(5, 1 + w.level);
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * (w.isOverdrive ? 0.18 : 0.22);
        const angle = player.angle + spread;
        const speed = w.isOverdrive ? 500 : 420;
        this.projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle,
          speed,
          radius: w.isOverdrive ? 7.5 : 6,
          damage: w.damage,
          color: w.isOverdrive ? '#a855f7' : w.color,
          isHoming: true,
          isHyperion: Boolean(w.isOverdrive),
          life: 2.2,
        });
      }
      soundEngine.playShoot(1.2);
    } else if (type === 'laser') {
      const w = this.weapons.laser;
      const speed = w.isOverdrive ? 880 : 750;
      this.projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(player.angle) * speed,
        vy: Math.sin(player.angle) * speed,
        angle: player.angle,
        speed,
        radius: w.isOverdrive ? 10 : 8,
        damage: w.damage,
        color: w.isOverdrive ? '#ff007f' : w.color,
        isLaser: true,
        isPrism: Boolean(w.isOverdrive),
        bouncesLeft: w.isOverdrive ? 6 : (3 + w.level),
        pierceCount: w.isOverdrive ? 7 : 4,
        life: 2.2,
      });
      soundEngine.playLaser();
    } else if (type === 'shotgun') {
      const w = this.weapons.shotgun;
      const count = w.isOverdrive ? 15 : (w.pellets + w.level * 2);
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * (w.isOverdrive ? 0.85 : 0.75);
        const angle = player.angle + spread;
        const speed = (w.isOverdrive ? 520 : 480) + (Math.random() - 0.5) * 110;
        this.projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle,
          speed,
          radius: w.isOverdrive ? 5 : 4,
          damage: w.damage,
          color: w.isOverdrive ? '#00f0ff' : w.color,
          isSuperconductor: Boolean(w.isOverdrive),
          life: 0.55,
        });
      }
      // Eject dual brass shotgun shells
      if (particleSystem.addShellCasing) {
        particleSystem.addShellCasing(player.x, player.y, player.angle, 170);
        particleSystem.addShellCasing(player.x, player.y, player.angle, 140);
        if (w.isOverdrive) {
          particleSystem.addShellCasing(player.x, player.y, player.angle, 195);
        }
      }
      soundEngine.playShoot(0.8);
    }
  }

  getOrbitOrbs(player) {
    if (this.weapons.orbit.level <= 0) return [];
    const w = this.weapons.orbit;
    const orbCount = w.isOverdrive ? 6 : (w.orbs + w.level - 1);
    const orbs = [];
    const step = (Math.PI * 2) / orbCount;

    for (let i = 0; i < orbCount; i++) {
      const a = w.angle + i * step;
      orbs.push({
        x: player.x + Math.cos(a) * (w.isOverdrive ? w.radius * 1.15 : w.radius),
        y: player.y + Math.sin(a) * (w.isOverdrive ? w.radius * 1.15 : w.radius),
        radius: w.isOverdrive ? 12 : 10,
        damage: w.damage,
        color: w.isOverdrive ? '#ffe600' : w.color,
        isSingularity: Boolean(w.isOverdrive),
      });
    }

    return orbs;
  }

  recalculateStats(w) {
    if (w.level <= 0) {
      w.damage = w.baseDamage || w.damage;
      w.fireRate = w.baseFireRate || w.fireRate;
      w.isOverdrive = false;
      return;
    }
    const multiplier = Math.pow(1.15, w.level - 1);
    const fireRateFactor = Math.pow(0.92, w.level - 1);
    w.damage = Math.round((w.baseDamage || w.damage) * multiplier);
    if (w.baseFireRate) {
      w.fireRate = Math.max(0.18, Number((w.baseFireRate * fireRateFactor).toFixed(4)));
    }
    w.isOverdrive = w.level >= 8;
  }

  upgradeWithAmmo(type, player) {
    const w = this.weapons[type];
    if (!w) return null;

    if (!w.baseDamage) w.baseDamage = w.damage;
    if (!w.baseFireRate && w.fireRate) w.baseFireRate = w.fireRate;

    const prevLevel = w.level;
    w.level = Math.min(8, w.level + 1);
    this.recalculateStats(w);

    const isUnlocked = prevLevel === 0 && w.level === 1;
    const isOverdrive = prevLevel < 8 && w.level === 8;
    const msg = isOverdrive
      ? `⚡ [OVERDRIVE EVOLUTION] ${w.name.toUpperCase()} TỐI THƯỢNG! ⚡`
      : (isUnlocked
        ? `KHAI MỞ ${w.name.toUpperCase()} (LVL 1)!`
        : `NÂNG CẤP ${w.name.toUpperCase()} LVL ${w.level}!`);

    if (player) {
      const shockColor = isOverdrive ? '#ffd700' : w.color;
      particleSystem.emitShockwave(player.x, player.y, shockColor, isOverdrive ? 240 : 140, isOverdrive ? 0.65 : 0.45);
      particleSystem.emitSparks(player.x, player.y, shockColor, isOverdrive ? 30 : 18, isOverdrive ? 260 : 200);
      particleSystem.addFloatingText(player.x, player.y - 30, msg, shockColor, true);
    }
    soundEngine.playAmmoPickup();
    if (isOverdrive && soundEngine.announce) {
      soundEngine.announce('Weapon overdrive evolution achieved');
    }

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('game:weaponupgraded', {
          detail: { weapon: w, prevLevel, newLevel: w.level, isUnlocked, isOverdrive },
        })
      );
    }

    return { weapon: w, prevLevel, newLevel: w.level, isUnlocked, isOverdrive };
  }

  degradeWeapon(type, player = null) {
    const w = this.weapons[type];
    if (!w) return null;

    const minLevel = w.id === 'homing' ? 1 : 0;
    if (w.level <= minLevel) return null;

    const prevLevel = w.level;
    w.level = Math.max(minLevel, w.level - 1);
    this.recalculateStats(w);

    const isLocked = w.level === 0;
    const msg = isLocked
      ? `[HỎNG] ${w.name.toUpperCase()} BỊ KHÓA!`
      : `[TỤT CẤP] ${w.name.toUpperCase()} -> LVL ${w.level}!`;

    if (player) {
      particleSystem.emitShockwave(player.x, player.y, '#ff0055', 140, 0.45);
      particleSystem.emitSparks(player.x, player.y, '#ff0055', 16, 180);
      particleSystem.addFloatingText(player.x, player.y - 35, msg, '#ff0055', true);
    }
    soundEngine.playWeaponDegrade();

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('game:weapondegraded', {
          detail: { weapon: w, prevLevel, newLevel: w.level, isLocked },
        })
      );
    }

    return { weapon: w, prevLevel, newLevel: w.level, isLocked };
  }

  degradeOnHit(player = null) {
    // Find degradable weapons:
    // - Starting weapon 'homing' can only degrade if level > 1 (retains min level 1)
    // - Secondary weapons ('laser', 'shotgun', 'orbit') can degrade if level > 0 (can drop to level 0)
    const candidates = [];
    for (const key in this.weapons) {
      const w = this.weapons[key];
      const minLevel = w.id === 'homing' ? 1 : 0;
      if (w.level > minLevel) {
        candidates.push(w);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Degrade highest level weapon first; on tie, degrade secondary weapons before primary
    candidates.sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }
      if (a.id === 'homing') return 1;
      if (b.id === 'homing') return -1;
      return 0;
    });

    const targetWeapon = candidates[0];
    return this.degradeWeapon(targetWeapon.id, player);
  }

  render(ctx, player) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Render Artisanal Shmup Projectiles (Bespoke Itch.io Vector Sprites)
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.isHoming) {
        // --- AERODYNAMIC MICRO-MISSILE ---
        // Thrust flame & exhaust smoke
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(-14 - Math.random() * 5, 0);
        ctx.lineTo(-7, 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-7, -1);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-7, 1);
        ctx.closePath();
        ctx.fill();

        // 4 Canted Delta Fins
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-4, -2.5);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-7, -2.5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-4, 2.5);
        ctx.lineTo(-8, 6);
        ctx.lineTo(-7, 2.5);
        ctx.closePath();
        ctx.fill();

        // Missile Fuselage Body
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(-7, -3);
        ctx.lineTo(-7, 3);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing Guidance Seeker Nose
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(4, -2);
        ctx.lineTo(4, 2);
        ctx.closePath();
        ctx.fill();

      } else if (p.isLaser) {
        // --- COHERENT MULTI-LAYER REFLECTIVE LASER BOLT ---
        // Outer High-Intensity Plasma Corona
        ctx.fillStyle = p.color + '44';
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Intermediate Laser Envelope
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(10, -3.5);
        ctx.lineTo(-18, -2);
        ctx.lineTo(-18, 2);
        ctx.lineTo(10, 3.5);
        ctx.closePath();
        ctx.fill();

        // White-Hot Singularity Core Beam
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(6, -1.5);
        ctx.lineTo(-16, -1);
        ctx.lineTo(-16, 1);
        ctx.lineTo(6, 1.5);
        ctx.closePath();
        ctx.fill();

        // Refraction Rings at Beam Head
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(10, 0, 4, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

      } else {
        // --- HIGH-VELOCITY TUNGSTEN FLECHETTE / EMP PELLET ---
        // Motion Blur Tail
        ctx.fillStyle = p.color + '55';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(0, -p.radius * 0.8);
        ctx.lineTo(p.radius * 1.5, 0);
        ctx.lineTo(0, p.radius * 0.8);
        ctx.closePath();
        ctx.fill();

        // Luminous Projectile Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Render Handcrafted Orbit Satellites
    const orbs = this.getOrbitOrbs(player);
    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      ctx.save();
      ctx.translate(orb.x, orb.y);

      // Rotating Solar Wing Blades
      ctx.rotate(orb.x * 0.05 + orb.y * 0.05);

      // Outer Aegis Shield Aura
      ctx.fillStyle = orb.color + '33';
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius + 5, 0, Math.PI * 2);
      ctx.fill();

      // Satellite Core Body
      ctx.fillStyle = '#060a17';
      ctx.strokeStyle = orb.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Dual Solar Array Panels
      ctx.fillStyle = orb.color;
      ctx.fillRect(-orb.radius - 4, -2, 4, 4);
      ctx.fillRect(orb.radius, -2, 4, 4);

      // Central Quantum Emitter
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Connecting energetic tether beam to player with high-frequency jitter
      if (player) {
        ctx.save();
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        const midX = (player.x + orb.x) / 2 + (Math.random() - 0.5) * 4;
        const midY = (player.y + orb.y) / 2 + (Math.random() - 0.5) * 4;
        ctx.lineTo(midX, midY);
        ctx.lineTo(orb.x, orb.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
