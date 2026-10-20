import { particleSystem } from '../vfx/particles.js';
import { soundEngine } from '../audio/soundEngine.js';

export const ELITE_AFFIXES = {
  shielded: {
    id: 'shielded',
    tag: 'SHIELDED',
    name: 'Hex Energy Shield',
    description: 'Generates a heavy absorbing energy barrier that absorbs damage before health.',
    color: '#00f0ff',
    shieldRatio: 0.75,
  },
  teleporter: {
    id: 'teleporter',
    tag: 'BLINK',
    name: 'Quantum Phase Blink',
    description: 'Periodically warps space to blink into flanking range and blinks defensively on hit.',
    color: '#a855f7',
    cooldown: 4.2,
  },
  artillery: {
    id: 'artillery',
    tag: 'ARTILLERY',
    name: 'Orbital Strike Artillery',
    description: 'Calls down telegraphed mortar strikes creating hazardous EMP zones.',
    color: '#f59e0b',
    cooldown: 4.8,
  },
  overclocked: {
    id: 'overclocked',
    tag: 'OVERCLOCK',
    name: 'Adrenaline Overdrive',
    description: 'Moves with boosted speed and enters an enraged sprint below 50% health.',
    color: '#ff0055',
    speedMult: 1.35,
    enrageSpeedMult: 1.45,
  },
};

export class Enemy {
  constructor(x, y, type = 'swarmer', wave = 1, playerLevel = 1, isElite = false, affix = null) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.wave = wave;
    this.playerLevel = playerLevel;
    this.isElite = isElite;

    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.animTimer = Math.random() * 10;

    // Escalating Difficulty Scaling (Driven by BOTH Wave and Player Level)
    const levelScaling = Math.max(0, playerLevel - 1);
    const waveScaling = Math.max(0, wave - 1);
    const hpMult = 1 + waveScaling * 0.16 + levelScaling * 0.08;
    const dmgMult = 1 + waveScaling * 0.12 + levelScaling * 0.05;
    const spdMult = Math.min(1.65, 1 + waveScaling * 0.03 + levelScaling * 0.015);

    // Type Configurations with escalating difficulty scaling
    if (type === 'swarmer') {
      this.radius = 13;
      this.speed = Math.round((155 + wave * 6) * spdMult);
      this.health = Math.round((26 + wave * 7) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((12 + Math.floor(wave * 1.5)) * dmgMult);
      this.xpValue = 15;
      this.color = '#ff0055';
      this.shootTimer = Math.random() * 2.0;
      this.shootCooldown = Math.max(0.85, 2.6 - wave * 0.14 - levelScaling * 0.04);
    } else if (type === 'sniper') {
      this.radius = 16;
      this.speed = Math.round((100 + wave * 4) * spdMult);
      this.health = Math.round((55 + wave * 12) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((25 + Math.floor(wave * 2.5)) * dmgMult);
      this.xpValue = 35;
      this.color = '#a855f7';
      this.aimTimer = 0;
      this.aimCooldown = Math.max(1.1, 2.2 - wave * 0.1 - levelScaling * 0.03);
      this.chargeTime = 0.70;
      this.isCharging = false;
    } else if (type === 'kamikaze') {
      this.radius = 14;
      this.speed = Math.round((200 + wave * 7) * spdMult);
      this.health = Math.round((38 + wave * 8) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((45 + Math.floor(wave * 4)) * dmgMult);
      this.xpValue = 25;
      this.color = '#f97316';
      this.pulseTimer = 0;
    } else if (type === 'enforcer') {
      // Heavy Frontline Mech with Directional Shield
      this.radius = 20;
      this.speed = Math.round((90 + wave * 3) * spdMult);
      this.health = Math.round((110 + wave * 18) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((20 + Math.floor(wave * 2)) * dmgMult);
      this.xpValue = 50;
      this.color = '#00f0ff';
      this.shieldAngle = 0;
      this.shootTimer = 0;
      this.shootCooldown = Math.max(1.1, 1.7 - wave * 0.06);
    } else if (type === 'phantom') {
      // Stealth Cyber Assassin with Glitch Dash and EMP Fan
      this.radius = 15;
      this.speed = Math.round(180 * spdMult);
      this.health = Math.round((70 + wave * 14) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((22 + Math.floor(wave * 2.5)) * dmgMult);
      this.xpValue = 60;
      this.color = '#00ffcc';
      this.teleportTimer = 0;
      this.teleportCooldown = 2.8;
      this.shootTimer = 0;
      this.shootCooldown = 2.0;
    } else if (type === 'colossus') {
      // Massive Dreadnought Mech
      this.radius = 28;
      this.speed = Math.round(75 * spdMult);
      this.health = Math.round((260 + wave * 35) * hpMult);
      this.maxHealth = this.health;
      this.damage = Math.round((38 + Math.floor(wave * 4)) * dmgMult);
      this.xpValue = 120;
      this.color = '#ff0033';
      this.slamTimer = 0;
      this.slamCooldown = 3.2;
    }

    // Apply Elite Champion Modifiers & Mutation Affixes
    if (this.isElite) {
      this.health = Math.round(this.health * 2.6);
      this.maxHealth = this.health;
      this.speed = Math.round(this.speed * 1.22);
      this.baseSpeed = this.speed;
      this.radius = Math.round(this.radius * 1.35);
      this.damage = Math.round(this.damage * 1.5);
      this.xpValue *= 4;
      this.eliteColor = '#ffd700'; // Electric Gold

      // Elite Mutation Affixes
      const affixes = ['shielded', 'teleporter', 'artillery', 'overclocked'];
      this.affix = affix || affixes[Math.floor(Math.random() * affixes.length)];

      if (this.affix === 'shielded') {
        this.shield = Math.round(this.maxHealth * 0.75);
        this.maxShield = this.shield;
        this.affixTag = 'SHIELDED';
        this.affixColor = '#00f0ff';
      } else if (this.affix === 'teleporter') {
        this.teleportCooldown = 4.2;
        this.teleportTimer = 0.5;
        this.affixTag = 'BLINK';
        this.affixColor = '#a855f7';
      } else if (this.affix === 'artillery') {
        this.artilleryCooldown = 4.8;
        this.artilleryTimer = 1.0;
        this.affixTag = 'ARTILLERY';
        this.affixColor = '#f59e0b';
      } else if (this.affix === 'overclocked') {
        this.speed = Math.round(this.speed * 1.35);
        this.baseSpeed = this.speed;
        this.affixTag = 'OVERCLOCK';
        this.affixColor = '#ff0055';
      }
    }

    this.enemyBullets = [];
  }

  hasAffix(tagOrId) {
    if (!this.isElite || !this.affix) return false;
    const lower = String(tagOrId).toLowerCase();
    return this.affix.toLowerCase() === lower || (this.affixTag && this.affixTag.toLowerCase() === lower);
  }

  update(dt, player, allEnemies, gameContext) {
    this.animTimer += dt * 8;
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
    this.angle = angleToPlayer;

    // Elite Mutation Active Behaviors
    if (this.isElite) {
      if (this.affix === 'teleporter') {
        this.teleportTimer += dt;
        if (this.teleportTimer >= this.teleportCooldown) {
          this.teleportTimer = 0;
          soundEngine.playTeleport();
          particleSystem.emitShockwave(this.x, this.y, '#a855f7', 65, 0.3);
          // Strategic blink closer to player
          const warpOffsetAngle = angleToPlayer + (Math.random() - 0.5) * 1.4;
          this.x = player.x - Math.cos(warpOffsetAngle) * (130 + Math.random() * 50);
          this.y = player.y - Math.sin(warpOffsetAngle) * (130 + Math.random() * 50);
          particleSystem.emitShockwave(this.x, this.y, '#a855f7', 75, 0.35);
        }
      } else if (this.affix === 'artillery') {
        this.artilleryTimer += dt;
        if (this.artilleryTimer >= this.artilleryCooldown) {
          this.artilleryTimer = 0;
          const targetX = player.x;
          const targetY = player.y;
          const artDamage = Math.round(this.damage * 1.4);
          particleSystem.addTelegraph(targetX, targetY, 65, 1.3, '#f59e0b', {
            damage: artDamage,
            type: 'artillery',
            onDetonate: (zone) => {
              soundEngine?.playArtilleryExplosion?.();
              if (gameContext?.player) {
                const pDist = Math.hypot(gameContext.player.x - zone.x, gameContext.player.y - zone.y);
                if (pDist <= zone.radius + (gameContext.player.radius || 15)) {
                  if (gameContext.player.isDashing) {
                    particleSystem?.addFloatingText?.(gameContext.player.x, gameContext.player.y - 20, 'GRAZE!', '#00f0ff');
                  } else {
                    gameContext.player.takeDamage(zone.damage);
                    gameContext.camera?.addTrauma?.(0.4);
                  }
                }
              }
            },
          });
          soundEngine?.playArtilleryWarning?.();
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('game:artillery', {
                detail: { x: targetX, y: targetY, radius: 65, duration: 1.3, damage: artDamage },
              })
            );
          }
          if (gameContext && gameContext.hazards) {
            gameContext.hazards.push({
              x: targetX,
              y: targetY,
              radius: 65,
              timer: 1.3,
              maxTimer: 1.3,
              damage: artDamage,
              color: '#f59e0b',
            });
          }
        }
      } else if (this.affix === 'overclocked') {
        if (this.health <= this.maxHealth * 0.5) {
          this.isEnraged = true;
          this.speed = Math.round((this.baseSpeed || this.speed) * 1.45);
          if (Math.random() < 0.25) {
            particleSystem.emitSparks(this.x, this.y, '#ff0055', 2, 80);
          }
        }
      }
    }

    if (this.type === 'swarmer') {
      // Swarm Flocking & Surrounding Encirclement
      let sepX = 0;
      let sepY = 0;
      let neighbors = 0;

      for (let i = 0; i < Math.min(allEnemies.length, 14); i++) {
        const other = allEnemies[i];
        if (other !== this) {
          const d = Math.hypot(other.x - this.x, other.y - this.y);
          if (d < 40 && d > 0) {
            sepX += (this.x - other.x) / d;
            sepY += (this.y - other.y) / d;
            neighbors++;
          }
        }
      }

      if (neighbors > 0) {
        sepX /= neighbors;
        sepY /= neighbors;
      }

      const targetVx = Math.cos(angleToPlayer) * this.speed + sepX * 85;
      const targetVy = Math.sin(angleToPlayer) * this.speed + sepY * 85;

      this.vx += (targetVx - this.vx) * Math.min(1, 6 * dt);
      this.vy += (targetVy - this.vy) * Math.min(1, 6 * dt);

      // Swarmer Ranged Plasma Dart Shoot
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        if (distToPlayer < 720 && distToPlayer > 50) {
          const dartSpeed = 350 + this.wave * 10;
          this.enemyBullets.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angleToPlayer) * dartSpeed,
            vy: Math.sin(angleToPlayer) * dartSpeed,
            radius: 5,
            damage: this.damage,
            color: '#ff0055',
            life: 2.8,
          });
          soundEngine.playShoot(0.5);
        }
      }

    } else if (this.type === 'sniper') {
      // Kiting AI: Maintains sweet-spot sniping distance
      const idealDist = 340;
      let moveDir = 0;
      if (distToPlayer < idealDist - 60) {
        moveDir = -1; // retreat
      } else if (distToPlayer > idealDist + 60) {
        moveDir = 1; // advance
      }

      this.vx = Math.cos(angleToPlayer) * this.speed * moveDir;
      this.vy = Math.sin(angleToPlayer) * this.speed * moveDir;

      // Predictive Aiming at Wave 4+
      this.aimTimer += dt;
      if (this.aimTimer >= this.aimCooldown) {
        this.isCharging = true;

        if (this.aimTimer >= this.aimCooldown + this.chargeTime) {
          // Calculate intercept vector based on player velocity
          let fireAngle = this.angle;
          if (this.wave >= 4 && player.vx && player.vy) {
            const timeToHit = distToPlayer / 550;
            const predictX = player.x + player.vx * timeToHit * 0.7;
            const predictY = player.y + player.vy * timeToHit * 0.7;
            fireAngle = Math.atan2(predictY - this.y, predictX - this.x);
          }

          const bulletSpeed = 540 + this.wave * 12;
          this.enemyBullets.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(fireAngle) * bulletSpeed,
            vy: Math.sin(fireAngle) * bulletSpeed,
            radius: 5.5,
            damage: this.damage,
            color: '#a855f7',
            life: 2.8,
          });
          soundEngine.playLaser();
          this.aimTimer = 0;
          this.isCharging = false;
        }
      }

    } else if (this.type === 'kamikaze') {
      // Rush direct to player with pulsating core and afterburners
      this.pulseTimer += dt * 9;
      this.vx = Math.cos(angleToPlayer) * this.speed;
      this.vy = Math.sin(angleToPlayer) * this.speed;

    } else if (this.type === 'enforcer') {
      // Heavy slow advancement with frontline blaster
      this.vx = Math.cos(angleToPlayer) * this.speed;
      this.vy = Math.sin(angleToPlayer) * this.speed;

      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        if (distToPlayer < 500) {
          // Double parallel heavy shots
          const spread = 0.12;
          [-spread, spread].forEach((off) => {
            const bAngle = angleToPlayer + off;
            this.enemyBullets.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(bAngle) * 360,
              vy: Math.sin(bAngle) * 360,
              radius: 6,
              damage: this.damage,
              color: '#00f0ff',
              life: 3.2,
            });
          });
          soundEngine.playShoot(0.6);
        }
      }
    } else if (this.type === 'phantom') {
      // Stealth Assassin: Flanks and unpredictable dash pulses
      this.teleportTimer += dt;
      if (this.teleportTimer >= this.teleportCooldown) {
        this.teleportTimer = 0;
        const burstAngle = angleToPlayer + (Math.random() * 0.8 - 0.4);
        this.vx = Math.cos(burstAngle) * this.speed * 2.2;
        this.vy = Math.sin(burstAngle) * this.speed * 2.2;
        particleSystem.addGhost(this.x, this.y, this.angle, this.radius, this.color);
        particleSystem.emitSparks(this.x, this.y, '#00ffcc', 6, 130);
      } else {
        const targetVx = Math.cos(angleToPlayer) * this.speed;
        const targetVy = Math.sin(angleToPlayer) * this.speed;
        this.vx += (targetVx - this.vx) * Math.min(1, 4 * dt);
        this.vy += (targetVy - this.vy) * Math.min(1, 4 * dt);
      }

      // Triple EMP Fan Shot
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        if (distToPlayer < 650) {
          [-0.22, 0, 0.22].forEach((offset) => {
            const bAngle = angleToPlayer + offset;
            this.enemyBullets.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(bAngle) * 420,
              vy: Math.sin(bAngle) * 420,
              radius: 5.5,
              damage: this.damage,
              color: '#00ffcc',
              life: 2.8,
            });
          });
          soundEngine.playShoot(0.65);
        }
      }

    } else if (this.type === 'colossus') {
      // Heavy Juggernaut Advance
      this.vx = Math.cos(angleToPlayer) * this.speed;
      this.vy = Math.sin(angleToPlayer) * this.speed;

      this.slamTimer += dt;
      if (this.slamTimer >= this.slamCooldown) {
        this.slamTimer = 0;
        if (distToPlayer < 700) {
          // Quad cannon heavy salvo
          [-0.3, -0.1, 0.1, 0.3].forEach((offset) => {
            const bAngle = angleToPlayer + offset;
            this.enemyBullets.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(bAngle) * 360,
              vy: Math.sin(bAngle) * 360,
              radius: 7,
              damage: this.damage,
              color: '#ff0033',
              life: 3.2,
            });
          });
          particleSystem.emitShockwave(this.x, this.y, '#ff0033', 120, 0.4);
          soundEngine.playExplosion();
        }
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Update internal bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  mutate(factor = 1.4) {
    this.isMutated = true;
    this.mutationTier = (this.mutationTier || 0) + 1;
    this.health = Math.round(this.health * factor);
    this.maxHealth = Math.round(this.maxHealth * factor);
    this.damage = Math.round(this.damage * factor);
    this.speed = Math.round(this.speed * 1.15);
    this.radius = Math.round(this.radius * 1.2);
    this.mutantColor = '#d946ef';

    particleSystem?.emitMutationEffect?.(this.x, this.y, '#d946ef');
    soundEngine?.playMutation?.();

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('game:mutation', {
          detail: {
            enemy: this,
            type: this.type,
            name: `${this.type.toUpperCase()} MUTANT MK-${this.mutationTier}`,
            tier: this.mutationTier,
            message: `CẢNH BÁO: ĐỘT BIẾN GEN QUÁI VẬT (${this.type.toUpperCase()})!`,
          },
        })
      );
    }
  }

  takeDamage(amount) {
    if (this.shield && this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        particleSystem.emitSparks(this.x, this.y, '#00f0ff', 6, 140);
        return false;
      } else {
        const remaining = amount - this.shield;
        this.shield = 0;
        particleSystem.emitShockwave(this.x, this.y, '#00f0ff', 75, 0.35);
        soundEngine.playShieldBreak();
        amount = remaining;
      }
    }

    this.health -= amount;
    const sparkColor = this.isElite ? (this.affixColor || '#ffd700') : this.color;
    particleSystem.emitSparks(this.x, this.y, sparkColor, this.isElite ? 8 : 4, 130);

    // Reactive teleport on damage for Teleporter Elite
    if (this.isElite && this.affix === 'teleporter' && this.teleportTimer > 1.8 && Math.random() < 0.35) {
      this.teleportTimer = 0;
      soundEngine.playTeleport();
      particleSystem.emitShockwave(this.x, this.y, '#a855f7', 60, 0.3);
      this.x += (Math.random() - 0.5) * 160;
      this.y += (Math.random() - 0.5) * 160;
      particleSystem.emitShockwave(this.x, this.y, '#a855f7', 60, 0.3);
    }

    return this.health <= 0;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 1. Sniper Charging Telegraph Laser Line
    if (this.type === 'sniper' && this.isCharging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(850, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Mutated Cyber Aura
    if (this.isMutated) {
      ctx.save();
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 12;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Artisanal Mechanical Drone Chassis (Itch.io Handcrafted Shmup Sprites)
    ctx.fillStyle = '#060814';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.type === 'kamikaze' ? 14 + Math.sin(this.pulseTimer) * 7 : 8;

    if (this.type === 'swarmer') {
      // --- ATTACK DRONE WITH ROTATING COUNTER-TORQUE ROTORS ---
      // Counter-Rotating Carbon Rotor Blades
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.lineWidth = 1.5;
      const rotorAngle = (this.animTimer || 0) * 24;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 3, rotorAngle, rotorAngle + Math.PI * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 3, rotorAngle + Math.PI, rotorAngle + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();

      // Main Insectoid Drone Body
      const bodyGrad = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
      bodyGrad.addColorStop(0, '#0a0d18');
      bodyGrad.addColorStop(0.7, '#141c2e');
      bodyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = bodyGrad;

      ctx.beginPath();
      ctx.moveTo(this.radius + 5, 0);
      ctx.lineTo(-this.radius * 0.4, -this.radius * 0.95);
      ctx.lineTo(-this.radius * 0.9, -this.radius * 0.5);
      ctx.lineTo(-this.radius * 0.5, 0);
      ctx.lineTo(-this.radius * 0.9, this.radius * 0.5);
      ctx.lineTo(-this.radius * 0.4, this.radius * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mechanical Wing Chevrons
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(this.radius * 0.4, 0);
      ctx.lineTo(0, 6);
      ctx.stroke();

      // Predatory Optical Sensor Eye (Glows & Tracks)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(3, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(4, 0, 1.2, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'sniper') {
      // --- LONG-RANGE STEALTH RAILGUN GUNSHIP ---
      const bodyGrad = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
      bodyGrad.addColorStop(0, '#090d16');
      bodyGrad.addColorStop(1, '#1c1936');
      ctx.fillStyle = bodyGrad;

      ctx.beginPath();
      ctx.moveTo(this.radius + 6, 0);
      ctx.lineTo(-this.radius * 0.85, -this.radius * 0.85);
      ctx.lineTo(-this.radius * 0.5, 0);
      ctx.lineTo(-this.radius * 0.85, this.radius * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Extended Heavy Carbon Railgun Barrel
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, -2.5, 20, 5);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(6, -2.5, 20, 5);

      // Magnetic Accelerator Coils (Charge Brightly when aiming)
      const coilColor = this.isCharging ? '#ff0055' : '#a855f7';
      ctx.fillStyle = coilColor;
      ctx.fillRect(10, -3.5, 2.5, 7);
      ctx.fillRect(16, -3.5, 2.5, 7);
      ctx.fillRect(22, -3.5, 2.5, 7);

      // Heat Dissipation Vents
      ctx.fillStyle = this.isCharging ? 'rgba(255, 0, 85, 0.7)' : 'rgba(168, 85, 247, 0.3)';
      ctx.fillRect(-this.radius * 0.3, -5, 5, 1.5);
      ctx.fillRect(-this.radius * 0.3, 3.5, 5, 1.5);

    } else if (this.type === 'kamikaze') {
      // --- MAGNETIC SPIKED CLUSTER MINE ---
      const pulse = Math.sin(this.pulseTimer * 3);
      const spikeExtension = 1.0 + Math.max(0, pulse * 0.25);

      // Armored Spherical Core
      ctx.fillStyle = '#1c0a06';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = (i % 2 === 0 ? this.radius * 1.35 : this.radius * 0.7) * (i % 2 === 0 ? spikeExtension : 1.0);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hazard Black & Orange Danger Stripes on Core
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      // Flashing Detonation Warning Countdown Core
      const isFlash = Math.sin(this.pulseTimer * 8) > 0;
      ctx.fillStyle = isFlash ? '#ffffff' : this.color;
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

    } else if (this.type === 'enforcer') {
      // --- HEAVY FRONTLINE MECH WITH DIRECTIONAL RIOT SHIELD ---
      const bodyGrad = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
      bodyGrad.addColorStop(0, '#040d1a');
      bodyGrad.addColorStop(1, '#0e2338');
      ctx.fillStyle = bodyGrad;

      // Heavy Armored Walker Torso
      ctx.beginPath();
      ctx.roundRect(-this.radius * 0.85, -this.radius * 0.75, this.radius * 1.6, this.radius * 1.5, 4);
      ctx.fill();
      ctx.stroke();

      // Dual Shoulder Armor Cannons
      ctx.fillStyle = '#334155';
      ctx.fillRect(this.radius * 0.4, -this.radius * 0.65, 8, 3.5);
      ctx.fillRect(this.radius * 0.4, this.radius * 0.65 - 3.5, 8, 3.5);

      // Projected Holographic Hexagonal Energy Barrier
      ctx.save();
      const barrierAlpha = 0.65 + Math.sin(this.animTimer * 5) * 0.2;
      ctx.strokeStyle = `rgba(0, 240, 255, ${barrierAlpha})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();

      // Hex Deflector Nodes on Shield
      ctx.fillStyle = '#ffffff';
      for (let s = -2; s <= 2; s++) {
        const sa = (s * Math.PI) * 0.12;
        const sx = Math.cos(sa) * (this.radius + 6);
        const sy = Math.sin(sa) * (this.radius + 6);
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
      ctx.restore();

    } else if (this.type === 'phantom') {
      // --- ACTIVE-CAMO CYBER ASSASSIN BLADE ---
      // Shimmering Optical Cloak
      const camoAlpha = 0.6 + Math.sin(this.animTimer * 6) * 0.25;
      ctx.save();
      ctx.globalAlpha = camoAlpha;

      ctx.fillStyle = '#041d18';
      ctx.beginPath();
      ctx.moveTo(this.radius + 7, 0);
      ctx.lineTo(-this.radius * 0.9, -this.radius * 0.75);
      ctx.lineTo(-this.radius * 0.3, 0);
      ctx.lineTo(-this.radius * 0.9, this.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Cyan Plasma Wing Edges
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.radius + 7, 0);
      ctx.lineTo(-this.radius * 0.9, -this.radius * 0.75);
      ctx.moveTo(this.radius + 7, 0);
      ctx.lineTo(-this.radius * 0.9, this.radius * 0.75);
      ctx.stroke();

      // Central Reactor Vent
      ctx.fillStyle = '#00ffcc';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (this.type === 'colossus') {
      // --- HEAVY CYBER DREADNOUGHT MECH ---
      // Armored Hexagonal Hull
      const colGrad = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
      colGrad.addColorStop(0, '#1a0508');
      colGrad.addColorStop(1, '#360910');
      ctx.fillStyle = colGrad;

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const r = this.radius;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Twin Heavy Minigun Barrels with Revolving Barrels
      ctx.fillStyle = '#111827';
      ctx.fillRect(8, -this.radius * 0.55, 18, 7);
      ctx.fillRect(8, this.radius * 0.55 - 7, 18, 7);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, -this.radius * 0.55, 18, 7);
      ctx.strokeRect(8, this.radius * 0.55 - 7, 18, 7);

      // Flashing Core Reactor with Protective Cage
      ctx.fillStyle = '#ff0033';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-4, -4, 8, 8);
    }

    // Render Elite Champion Visuals (Aura, Shield Bubble, Badge & HP Bar)
    if (this.isElite) {
      // Rotating Golden/Affix Neon Aura
      ctx.strokeStyle = this.affixColor || '#ffd700';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 7 + Math.sin(this.animTimer * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shimmering Shield Bubble
      if (this.shield && this.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 11 + Math.sin(this.animTimer * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(-this.angle); // text remains upright
      ctx.fillStyle = this.affixColor || '#ffd700';
      ctx.font = 'bold 9px "Orbitron", monospace, sans-serif';
      ctx.textAlign = 'center';
      const label = this.affixTag ? `★ [${this.affixTag}] ELITE` : '★ ELITE';
      ctx.fillText(label, 0, -this.radius - 8);

      // Mini Health + Shield Overhead Bar
      const barW = 34;
      const barH = 3;
      const barY = -this.radius - 16;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      const hpRatio = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = this.affixColor || '#ef4444';
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);
      if (this.maxShield > 0) {
        const shRatio = Math.max(0, (this.shield || 0) / this.maxShield);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-barW / 2, barY - 3, barW * shRatio, 2);
      }
      ctx.restore();
    }

    ctx.restore();

    // 3. Render High-Tech Projectiles with Directional Motion Streak
    if (this.enemyBullets.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.enemyBullets.length; i++) {
        const b = this.enemyBullets[i];
        const angle = Math.atan2(b.vy, b.vx);

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        // Outer Neon Aura
        ctx.fillStyle = b.color + '44';
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius + 8, b.radius + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // High Intensity Core
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius + 4, b.radius, 0, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Singularity Point
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      ctx.restore();
    }
  }
}

// Export Module 2 Multi-Phase Boss Architecture
export { Boss, BossDrone, BossShockwave, BOSS_ARCHETYPES } from './boss.js';

