import { particleSystem } from '../vfx/particles.js';
import { soundEngine } from '../audio/soundEngine.js';

export const BOSS_ARCHETYPES = [
  {
    id: 'colossus',
    name: 'CYBER-COLOSSUS',
    title: 'HEAVY SIEGE DREADNOUGHT',
    baseColor: '#00f0ff',
    enrageColor: '#ff0055',
    hullShape: 'hex',
    speedMult: 1.0,
    hpMult: 1.0,
  },
  {
    id: 'hydra',
    name: 'VORTEX-HYDRA',
    title: 'BULLET-HELL WEAPON PLATFORM',
    baseColor: '#a855f7',
    enrageColor: '#ff2a6d',
    hullShape: 'quad',
    speedMult: 1.25,
    hpMult: 1.15,
  },
  {
    id: 'reaper',
    name: 'NEXUS-REAPER',
    title: 'QUANTUM STRIKE RAIDER',
    baseColor: '#f59e0b',
    enrageColor: '#ff0055',
    hullShape: 'scythe',
    speedMult: 1.45,
    hpMult: 1.3,
  },
];

/**
 * BossDrone: Specialized escort drone deployed during Phase 2 (Overdrive Drones)
 * and Phase 3 (Berserk Overclock). Orbits the parent boss, intercepts incoming
 * fire, and fires synchronized laser dart volleys at the player.
 */
export class BossDrone {
  constructor(boss, orbitAngle = 0, orbitRadius = 96) {
    this.boss = boss;
    this.orbitAngle = orbitAngle;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = 1.6; // rad/s (accelerates to 2.8 in Phase 3 Berserk)
    this.radius = 13;

    // Position calculated from boss
    this.x = boss.x + Math.cos(orbitAngle) * orbitRadius;
    this.y = boss.y + Math.sin(orbitAngle) * orbitRadius;

    // Drone HP scaling
    const tier = boss.tier || 1;
    this.maxHealth = 85 + tier * 25;
    this.health = this.maxHealth;

    // Combat attributes
    this.color = '#00f0ff';
    this.shootTimer = Math.random() * 1.2; // staggered firing offset
    this.shootCooldown = Math.max(1.3, 2.2 - tier * 0.1);
    this.damage = 14 + tier * 3;
    this.bullets = [];

    // Visual pulse
    this.pulseTimer = Math.random() * Math.PI;
  }

  update(dt, player) {
    const isBerserk = this.boss.phase === 3;
    this.orbitSpeed = isBerserk ? 2.8 : 1.6;
    this.orbitAngle += this.orbitSpeed * dt;
    this.color = isBerserk ? '#ff0055' : '#00f0ff';

    // Update position relative to boss
    this.x = this.boss.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.boss.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.pulseTimer += dt * 5;

    // Drone firing logic towards player
    if (player) {
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootCooldown) {
        this.shootTimer = 0;
        this.fireAtPlayer(player);
      }
    }

    // Update drone bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }
  }

  fireAtPlayer(player) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const speed = 400 + (this.boss.tier || 1) * 20;
    this.bullets.push({
      x: this.x + Math.cos(angle) * (this.radius + 4),
      y: this.y + Math.sin(angle) * (this.radius + 4),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 5,
      damage: this.damage,
      color: this.color,
      life: 3.2,
      isDroneBullet: true,
    });
    if (typeof soundEngine?.playShoot === 'function') {
      soundEngine.playShoot(0.4);
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (typeof particleSystem?.emitSparks === 'function') {
      particleSystem.emitSparks(this.x, this.y, this.color, 4, 120);
    }
    return this.health <= 0;
  }

  render(ctx) {
    // 1. Cyber Tether Shield Line to Boss
    ctx.save();
    ctx.strokeStyle = this.color + '55';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.boss.x, this.boss.y);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.restore();

    // 2. Drone Chassis (Diamond / Escort Shmup Hull)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.orbitAngle + Math.PI / 2);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#0a0e1c';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius * 0.85, 0);
    ctx.lineTo(0, this.radius * 0.85);
    ctx.lineTo(-this.radius * 0.85, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner glowing core lens
    const corePulse = 3.5 + Math.sin(this.pulseTimer) * 1.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. Mini Health Bar if damaged
    if (this.health < this.maxHealth) {
      const bw = 24;
      const bh = 3;
      const bx = this.x - bw / 2;
      const by = this.y - this.radius - 8;
      ctx.fillStyle = '#05070f';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = this.color;
      ctx.fillRect(bx, by, bw * Math.max(0, this.health / this.maxHealth), bh);
    }

    // 4. Render Drone Bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * BossShockwave: Expanding kinetic energy ring detonated in Phase 3
 * (Berserk Overclock) during dash impacts and enrage ground slams.
 */
export class BossShockwave {
  constructor(x, y, tier = 1, options = {}) {
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.radius = options.radius || 12;
    this.maxRadius = options.maxRadius || (260 + tier * 25);
    this.expandSpeed = options.expandSpeed || 420; // px/s
    this.thickness = options.thickness || 20; // ring thickness
    this.damage = options.damage || (25 + tier * 5);
    this.color = options.color || '#ff0055';
    this.hitPlayer = false;
  }

  update(dt) {
    this.radius += this.expandSpeed * dt;
    return this.radius >= this.maxRadius;
  }

  checkCollision(player) {
    if (this.hitPlayer || !player) return null;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const halfThick = this.thickness * 0.5;

    // Check if player's collision circle overlaps with the expanding ring
    if (Math.abs(dist - this.radius) <= (halfThick + (player.radius || 15))) {
      this.hitPlayer = true;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      return {
        hit: true,
        isDashing: Boolean(player.isDashing),
        damage: this.damage,
        angle: angle,
        x: this.x,
        y: this.y,
      };
    }
    return null;
  }

  render(ctx) {
    const progress = Math.min(1, this.radius / this.maxRadius);
    const alpha = (1 - progress) * 0.85;
    if (alpha <= 0) return;

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.thickness * (1 - progress * 0.5);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright crest
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Boss: Multi-Phase Epic Cyberpunk Boss
 * Phase 1: Standard (Heavy Radial Nova Bursts, Twin Articulated Turret Salvos)
 * Phase 2: Overdrive Drones (Deploys orbiting escort drones, Dual Spirals, Cluster Mines)
 * Phase 3: Berserk Laser Beam & Shockwave (Sweeping Mega Laser, Kinetic Shockwaves, High-speed Ramming Charge)
 */
export class Boss {
  constructor(x, y, wave = 5, archetypeIndex = -1) {
    this.x = x;
    this.y = y;
    this.wave = wave;
    this.tier = Math.max(1, Math.floor(wave / 5));

    // Select archetype based on tier or explicit index
    const archIdx = archetypeIndex >= 0
      ? archetypeIndex % BOSS_ARCHETYPES.length
      : (this.tier - 1) % BOSS_ARCHETYPES.length;
    this.archetype = BOSS_ARCHETYPES[archIdx];

    this.name = `${this.archetype.name} MK-${this.tier}`;
    this.title = this.archetype.title;
    this.radius = 48 + Math.min(16, this.tier * 2);

    // Infinite scaling HP: scales with wave and tier exponential factor
    const baseHp = 1400 + wave * 380;
    this.maxHealth = Math.round(baseHp * this.archetype.hpMult * Math.pow(1.15, Math.max(0, this.tier - 1)));
    this.health = this.maxHealth;
    this.prevHealth = this.health; // for smooth damage lag bar

    this.baseSpeed = (75 + Math.min(60, this.tier * 6)) * this.archetype.speedMult;
    this.speed = this.baseSpeed;
    this.angle = 0;
    this.turretAngle = 0;

    // Phase management: 1 (100%-66%), 2 (66%-33%), 3 (<33% Berserk Overclock)
    this.phase = 1;
    this.prevPhase = 1;
    this.attackTimer = 0;
    this.subAttackTimer = 0;
    this.spiralAngle = 0;
    this.reactorRotation = 0;

    // Movement & Dash Charge
    this.isCharging = false;
    this.chargeTimer = 0;
    this.chargeCooldown = Math.max(3.0, 5.0 - this.tier * 0.3);

    // Phase 2: Overdrive Drones Squadron
    this.drones = [];
    this.maxDrones = 2 + Math.min(2, Math.floor(this.tier / 2));
    this.droneRespawnTimer = 0;
    this.droneRespawnCooldown = Math.max(4.0, 7.0 - this.tier * 0.3);

    // Phase 3: Berserk Sweeping Laser Beam State Machine
    this.laserState = 'idle'; // 'idle' | 'charging' | 'firing'
    this.laserCooldownTimer = 1.5; // initial warmup delay
    this.laserCooldown = Math.max(5.0, 7.5 - this.tier * 0.4);
    this.laserChargeTime = 1.1; // seconds
    this.laserChargeProgress = 0;
    this.laserFireDuration = 2.2; // seconds
    this.laserFireProgress = 0;
    this.laserAngle = 0;
    this.laserSweepSpeed = 0.85 + Math.min(0.6, this.tier * 0.08); // rad/s
    this.laserSweepDir = 1;
    this.laserLength = 1200;
    this.laserWidth = 28;
    this.laserTickCooldown = 0.12;
    this.laserTickTimer = 0;
    this.laserDamage = 18 + this.tier * 4;

    // Phase 3: Kinetic Shockwaves
    this.shockwaves = [];
    this.shockwaveCooldown = Math.max(3.5, 6.0 - this.tier * 0.3);
    this.shockwaveTimer = 0;

    // Bullets pool
    this.bullets = [];

    // Minion summoning timer
    this.summonTimer = 0;

    // Tactical Orbital Artillery Strikes (Vùng nguy hiểm pháo kích)
    this.artilleryTimer = 0;
    this.artilleryCooldown = Math.max(4.0, 6.5 - this.tier * 0.3);

    // Artisanal Shmup Recoil & Mechanical FX
    this.turretRecoil = 0;

    // Boss Arena Lockdown Forcefield (Perimeter Barrier)
    this.arena = {
      active: true,
      x: this.x,
      y: this.y,
      radius: 850 + Math.min(200, this.tier * 25),
    };
  }

  update(dt, player, camera, gameContext) {
    this.turretRecoil = Math.max(0, this.turretRecoil - dt * 22);

    // Boss Arena Lockdown Barrier containment
    if (this.arena && this.arena.active && player) {
      const pd = Math.hypot(player.x - this.arena.x, player.y - this.arena.y);
      if (pd > this.arena.radius) {
        const excess = pd - this.arena.radius;
        const pushAngle = Math.atan2(player.y - this.arena.y, player.x - this.arena.x);
        player.x -= Math.cos(pushAngle) * excess * 1.5;
        player.y -= Math.sin(pushAngle) * excess * 1.5;
        player.vx *= 0.4;
        player.vy *= 0.4;
        particleSystem?.emitSparks?.(player.x, player.y, this.archetype.enrageColor, 3, 120);
      }
    }

    // Smooth damage-lag animation for HP bar
    if (this.prevHealth > this.health) {
      this.prevHealth = Math.max(this.health, this.prevHealth - this.maxHealth * dt * 0.4);
    }

    const hpPercent = this.health / this.maxHealth;
    if (hpPercent > 0.66) {
      this.phase = 1;
    } else if (hpPercent > 0.33) {
      this.phase = 2;
    } else {
      this.phase = 3; // BERSERK OVERCLOCK
    }

    // Phase Transition Handler
    if (this.phase !== this.prevPhase) {
      this.handlePhaseTransition(this.prevPhase, this.phase, camera);
      this.prevPhase = this.phase;
    }

    const angleToPlayer = player ? Math.atan2(player.y - this.y, player.x - this.x) : this.angle;
    this.angle = angleToPlayer;

    // Articulated turrets smoothly track player
    const turretDiff = angleToPlayer - this.turretAngle;
    this.turretAngle += Math.sin(turretDiff) * Math.min(1, 6 * dt);

    // Reactor core rotation
    this.reactorRotation += (this.phase === 3 ? 12 : 5) * dt;

    // Dynamic Speed based on phase
    const currentSpeed = this.phase === 3
      ? this.baseSpeed * 1.5
      : (this.phase === 2 ? this.baseSpeed * 1.25 : this.baseSpeed);
    this.speed = currentSpeed;

    // Movement
    if (!this.isCharging) {
      // Flank and reposition rather than purely head-on
      const orbitOffset = Math.sin(Date.now() * 0.001) * 0.4;
      this.x += Math.cos(angleToPlayer + orbitOffset) * currentSpeed * dt;
      this.y += Math.sin(angleToPlayer + orbitOffset) * currentSpeed * dt;
    }

    this.attackTimer += dt;
    this.subAttackTimer += dt;
    this.spiralAngle += (this.phase === 3 ? 6.5 : 4.5) * dt;

    // =========================================================================
    // ATTACK PATTERNS BY PHASE
    // =========================================================================

    if (this.phase === 1) {
      // PHASE 1: Heavy Radial Nova Bursts + Targeted Dual Laser Bolts
      const burstInterval = Math.max(1.1, 1.8 - this.tier * 0.1);
      if (this.attackTimer >= burstInterval) {
        this.fireRadialBurst(12 + Math.min(8, this.tier * 2), 240 + this.tier * 15);
        this.attackTimer = 0;
        soundEngine?.playLaser?.();
      }

      if (this.subAttackTimer >= 0.7) {
        this.fireTurretSalvo();
        this.subAttackTimer = 0;
      }

    } else if (this.phase === 2) {
      // PHASE 2: OVERDRIVE DRONES + Dual Spirals + Cluster Bomb Shells
      const spiralInterval = Math.max(0.09, 0.14 - this.tier * 0.01);
      if (this.attackTimer >= spiralInterval) {
        this.fireSpiralPair(270 + this.tier * 15);
        this.attackTimer = 0;
      }

      if (this.subAttackTimer >= 2.2 && player) {
        this.fireClusterMine(player.x, player.y);
        this.subAttackTimer = 0;
        soundEngine?.playShoot?.(0.8);
      }

      // Tactical Orbital Artillery Strikes (Vùng nguy hiểm pháo kích)
      this.artilleryTimer += dt;
      if (this.artilleryTimer >= this.artilleryCooldown && player) {
        this.artilleryTimer = 0;
        this.callArtilleryStrike(player.x, player.y, 75, gameContext);
      }

      // Manage Overdrive Drones replenishment
      if (this.drones.length < this.maxDrones) {
        this.droneRespawnTimer += dt;
        if (this.droneRespawnTimer >= this.droneRespawnCooldown) {
          this.droneRespawnTimer = 0;
          this.spawnSingleDrone();
        }
      }

    } else if (this.phase === 3) {
      // PHASE 3: BERSERK OVERCLOCK - Sweeping Laser, Shockwaves & Ramming Dash
      this.updateLaser(dt, player, camera, gameContext);
      this.updateBerserkCharge(dt, player, camera, gameContext);

      // Relentless spiral storm when not charging
      if (!this.isCharging) {
        if (this.attackTimer >= 0.09) {
          this.fireSpiralPair(310 + this.tier * 15);
          this.attackTimer = 0;
        }

        if (this.subAttackTimer >= 0.5) {
          this.fireTurretSalvo();
          this.subAttackTimer = 0;
        }
      }

      // Periodic Ground Slam Shockwaves
      this.shockwaveTimer += dt;
      if (this.shockwaveTimer >= this.shockwaveCooldown) {
        this.shockwaveTimer = 0;
        this.spawnShockwave(280 + this.tier * 20, 420);
        camera?.addTrauma?.(0.35);
        soundEngine?.playExplosion?.();
      }

      // Berserk Dual Orbital Artillery Strikes (Vùng nguy hiểm pháo kích)
      this.artilleryTimer += dt;
      if (this.artilleryTimer >= this.artilleryCooldown * 0.7 && player) {
        this.artilleryTimer = 0;
        this.callArtilleryStrike(player.x, player.y, 90, gameContext);
      }

      // Drone Escort in Phase 3
      if (this.drones.length < this.maxDrones) {
        this.droneRespawnTimer += dt;
        if (this.droneRespawnTimer >= this.droneRespawnCooldown * 0.8) {
          this.droneRespawnTimer = 0;
          this.spawnSingleDrone();
        }
      }

      // Tactical drone minions escort summon if gameContext provided
      this.summonTimer += dt;
      if (this.summonTimer >= 8.0 && gameContext && gameContext.enemies && gameContext.enemies.length < 35) {
        this.summonTimer = 0;
        if (typeof gameContext.spawnEnemy === 'function') {
          gameContext.spawnEnemy(250);
          gameContext.spawnEnemy(280);
          soundEngine?.playBossAlert?.();
          this.spawnShockwave(200, 360);
        }
      }
    }

    // Update Overdrive Drones
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const drone = this.drones[i];
      drone.update(dt, player);
      if (drone.health <= 0) {
        this.drones.splice(i, 1);
      }
    }

    // Update Kinetic Shockwaves and test Player collision
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const isExpired = sw.update(dt);

      if (player && !sw.hitPlayer) {
        const col = sw.checkCollision(player);
        if (col) {
          if (col.isDashing) {
            // Perfect Dash graze!
            player.triggerHyperBoost?.(2.5);
            particleSystem?.emitSparks?.(player.x, player.y, '#00f0ff', 6, 140);
          } else {
            player.takeDamage?.(col.damage);
            gameContext?.triggerWeaponDegradeOnHit?.();
            camera?.addTrauma?.(0.35);
            particleSystem?.emitShockwave?.(player.x, player.y, col.color || '#ff0055', 70, 0.3);
          }
        }
      }

      if (isExpired) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Boss Bullets with trailing motion
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }
  }

  handlePhaseTransition(fromPhase, toPhase, camera) {
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(fromPhase, toPhase);
    }
    // Specialized Web Audio procedural phase transition alarm
    soundEngine?.playBossPhaseChange?.(toPhase);
    if (soundEngine?.announce) {
      soundEngine.announce(toPhase === 3 ? 'Warning: Boss berserk overclock engaged' : 'Alert: Boss overdrive drones deployed');
    }

    const phaseColor = toPhase === 3 ? this.archetype.enrageColor : this.archetype.baseColor;
    particleSystem?.emitBossPhaseShockwave?.(this.x, this.y, toPhase, phaseColor);

    if (toPhase === 2) {
      // OVERDRIVE ACTIVATION
      this.spawnDrones(this.maxDrones);
      this.spawnShockwave(240, 400);
      camera?.addTrauma?.(0.55);
      particleSystem?.addFloatingText?.(this.x, this.y - this.radius - 40, '⚠️ OVERDRIVE DRONES ONLINE', '#00f0ff', true);
    } else if (toPhase === 3) {
      // BERSERK PROTOCOL ENGAGED
      this.spawnShockwave(320, 480);
      camera?.addTrauma?.(0.75);
      soundEngine?.playExplosion?.();
      particleSystem?.addFloatingText?.(this.x, this.y - this.radius - 40, '💀 BERSERK OVERCLOCK ENGAGED', '#ff0055', true);
      // Accelerate any surviving drones
      for (const d of this.drones) {
        d.orbitSpeed = 2.8;
      }
    }

    // Dispatch global event for HUD alert banner & tactical warnings
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('game:bossphase', {
          detail: {
            boss: this,
            phase: toPhase,
            name: this.name,
            title: toPhase === 3 ? 'BÁO ĐỘNG ĐỎ: BẠO NỘ QUÁ TẢI (PHASE 3)' : 'CẢNH BÁO: TĂNG CƯỜNG HỎA LỰC (PHASE 2)',
            desc: toPhase === 3 ? 'TỐC ĐỘ & SÁT THƯƠNG TỐI ĐA - NÉ TRÁNH PHÁO KÍCH VÀ LASER!' : 'TRIỆU HỒI DRONE PHÒNG VỆ & BẮT ĐẦU PHÁO KÍCH QUỸ ĐẠO!',
            message: toPhase === 2
              ? `CẢNH BÁO: ${this.name} KÍCH HOẠT GIAI ĐOẠN 2 (OVERDRIVE DRONES)!`
              : `BÁO ĐỘNG ĐỎ: ${this.name} KÍCH HOẠT GIAI ĐOẠN 3 (BERSERK OVERCLOCK)!`,
            color: phaseColor,
          },
        })
      );
    }
  }

  // =========================================================================
  // TACTICAL ORBITAL ARTILLERY STRIKES (VÙNG NGUY HIỂM PHÁO KÍCH)
  // =========================================================================

  callArtilleryStrike(targetX, targetY, radius = 75, gameContext) {
    soundEngine?.playArtilleryWarning?.();
    const duration = 1.6;
    const damage = 35 + this.tier * 6;
    const color = this.phase === 3 ? '#ff0055' : '#f59e0b';

    particleSystem?.addTelegraph?.(targetX, targetY, radius, duration, color, {
      damage,
      type: 'artillery',
      onDetonate: (zone) => {
        soundEngine?.playArtilleryExplosion?.();
        if (gameContext) {
          if (gameContext.player) {
            const pDist = Math.hypot(gameContext.player.x - zone.x, gameContext.player.y - zone.y);
            if (pDist <= zone.radius + (gameContext.player.radius || 15)) {
              if (gameContext.player.isDashing) {
                particleSystem?.addFloatingText?.(gameContext.player.x, gameContext.player.y - 20, 'GRAZE EVADE!', '#00f0ff');
              } else {
                gameContext.player.takeDamage(zone.damage);
                if (gameContext.camera) gameContext.camera.addTrauma(0.5);
                particleSystem?.addFloatingText?.(gameContext.player.x, gameContext.player.y - 20, `-${zone.damage} ARTILLERY!`, '#ff0055', true);
              }
            }
          }
          if (gameContext.enemies && Array.isArray(gameContext.enemies)) {
            for (const e of gameContext.enemies) {
              const eDist = Math.hypot(e.x - zone.x, e.y - zone.y);
              if (eDist <= zone.radius + (e.radius || 15)) {
                e.takeDamage?.(Math.round(zone.damage * 1.5));
              }
            }
          }
        }
      },
    });

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('game:artillery', {
          detail: { x: targetX, y: targetY, radius, duration, damage },
        })
      );
    }
  }

  // =========================================================================
  // PHASE 2: OVERDRIVE DRONES SYSTEM
  // =========================================================================

  spawnDrones(count) {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = this.angle + i * step;
      this.drones.push(new BossDrone(this, angle, 95 + (i % 2) * 12));
    }
  }

  spawnSingleDrone() {
    const baseAngle = this.drones.length > 0
      ? this.drones[this.drones.length - 1].orbitAngle + Math.PI * 0.8
      : this.angle;
    this.drones.push(new BossDrone(this, baseAngle, 98));
    soundEngine?.playBossAlert?.();
  }

  // =========================================================================
  // PHASE 3: BERSERK SWEEPING LASER BEAM
  // =========================================================================

  updateLaser(dt, player, camera, gameContext) {
    if (this.laserState === 'idle') {
      this.laserCooldownTimer += dt;
      if (this.laserCooldownTimer >= this.laserCooldown && player) {
        this.laserState = 'charging';
        this.laserChargeProgress = 0;
        this.laserSweepDir = Math.random() < 0.5 ? 1 : -1;
        const directAngle = Math.atan2(player.y - this.y, player.x - this.x);
        this.laserAngle = directAngle - (0.55 * this.laserSweepDir);
        soundEngine?.playLaser?.();
      }
    } else if (this.laserState === 'charging') {
      this.laserChargeProgress += dt;
      if (player) {
        const directAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const diff = directAngle - this.laserAngle;
        this.laserAngle += Math.sin(diff) * Math.min(1, 2.5 * dt);
      }

      particleSystem?.emitSparks?.(this.x, this.y, '#ff0055', 2, 80);

      if (this.laserChargeProgress >= this.laserChargeTime) {
        this.laserState = 'firing';
        this.laserFireProgress = 0;
        this.laserTickTimer = 0;
        camera?.addTrauma?.(0.5);
        soundEngine?.playLaser?.();
      }
    } else if (this.laserState === 'firing') {
      this.laserFireProgress += dt;
      const prevAngle = this.laserAngle;
      this.laserAngle += this.laserSweepDir * this.laserSweepSpeed * dt;

      // Check player laser collision (checks current, previous, and midpoint to prevent tunneling)
      const hit = this.checkLaserHit(player, this.laserAngle) ||
                  this.checkLaserHit(player, prevAngle) ||
                  this.checkLaserHit(player, (prevAngle + this.laserAngle) * 0.5);

      if (player && hit) {
        if (player.isDashing) {
          player.triggerHyperBoost?.(2.0);
          particleSystem?.emitSparks?.(player.x, player.y, '#ffe600', 4, 120);
        } else {
          this.laserTickTimer += dt;
          if (this.laserTickTimer >= this.laserTickCooldown) {
            this.laserTickTimer = 0;
            player.takeDamage?.(this.laserDamage);
            gameContext?.triggerWeaponDegradeOnHit?.();
            camera?.addTrauma?.(0.25);
            particleSystem?.emitSparks?.(player.x, player.y, '#ff0055', 5, 140);
          }
        }
      }

      if (this.laserFireProgress >= this.laserFireDuration) {
        this.laserState = 'idle';
        this.laserCooldownTimer = 0;
      }
    }
  }

  /**
   * Geometric ray-segment to player circle collision check
   */
  checkLaserHit(player, customAngle = null) {
    if (!player) return false;
    const angle = customAngle !== null ? customAngle : this.laserAngle;
    const x1 = this.x;
    const y1 = this.y;
    const x2 = this.x + Math.cos(angle) * this.laserLength;
    const y2 = this.y + Math.sin(angle) * this.laserLength;
    const px = player.x;
    const py = player.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const dist = Math.hypot(px - closestX, py - closestY);

    const hitThreshold = (player.radius || 15) + (this.laserWidth * 0.5);
    return dist <= hitThreshold;
  }

  // =========================================================================
  // PHASE 3: BERSERK RAMMING CHARGE
  // =========================================================================

  updateBerserkCharge(dt, player, camera, gameContext) {
    this.chargeTimer += dt;
    const angleToPlayer = player ? Math.atan2(player.y - this.y, player.x - this.x) : this.angle;

    if (this.chargeTimer >= this.chargeCooldown) {
      this.isCharging = true;
      camera?.addTrauma?.(0.4);
      particleSystem?.emitShockwave?.(this.x, this.y, this.archetype.enrageColor, 220, 0.5);
      soundEngine?.playExplosion?.();

      // High-velocity dash assault
      const dashSpeed = 620 + this.tier * 25;
      this.x += Math.cos(angleToPlayer) * dashSpeed * dt;
      this.y += Math.sin(angleToPlayer) * dashSpeed * dt;

      // Check kinetic ramming collision with player
      if (player) {
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer < this.radius + (player.radius || 15)) {
          if (player.isDashing) {
            player.triggerHyperBoost?.(2.5);
            particleSystem?.emitSparks?.(player.x, player.y, '#00f0ff', 6, 150);
          } else {
            const ramDamage = 35 + this.tier * 6;
            player.takeDamage?.(ramDamage);
            gameContext?.triggerWeaponDegradeOnHit?.();
            camera?.addTrauma?.(0.5);
            // Knock player backwards
            player.x += Math.cos(angleToPlayer) * 45;
            player.y += Math.sin(angleToPlayer) * 45;
          }
        }
      }

      // Leave flaming plasma trail
      particleSystem?.emitSparks?.(this.x, this.y, this.archetype.enrageColor, 4, 180);

      if (this.chargeTimer >= this.chargeCooldown + 0.65) {
        this.isCharging = false;
        this.chargeTimer = 0;
        // Detonate physical shockwave at end of dash
        this.spawnShockwave(260 + this.tier * 20, 420);
        this.fireRadialBurst(18 + Math.min(8, this.tier * 2), 320);
        camera?.addTrauma?.(0.5);
      }
    }
  }

  spawnShockwave(maxRadius = 260, expandSpeed = 420) {
    const sw = new BossShockwave(this.x, this.y, this.tier, {
      maxRadius: maxRadius,
      expandSpeed: expandSpeed,
      color: this.phase === 3 ? this.archetype.enrageColor : this.archetype.baseColor,
    });
    this.shockwaves.push(sw);
    particleSystem?.emitShockwave?.(this.x, this.y, sw.color, maxRadius * 0.6, 0.4);
  }

  // =========================================================================
  // BULLET ATTACK PRIMITIVES
  // =========================================================================

  fireRadialBurst(count, speed) {
    const step = (Math.PI * 2) / count;
    const color = this.phase === 3 ? this.archetype.enrageColor : this.archetype.baseColor;
    for (let i = 0; i < count; i++) {
      const a = i * step + this.angle;
      this.bullets.push({
        x: this.x + Math.cos(a) * (this.radius + 6),
        y: this.y + Math.sin(a) * (this.radius + 6),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        radius: 6.5,
        damage: 18 + this.tier * 3,
        color: color,
        life: 4.8,
      });
    }
  }

  fireSpiralPair(speed = 260) {
    const color1 = this.archetype.baseColor;
    const color2 = this.archetype.enrageColor;
    const arms = this.phase === 3 ? 4 : 2;

    for (let i = 0; i < arms; i++) {
      const a = this.spiralAngle + (i * (Math.PI * 2 / arms));
      this.bullets.push({
        x: this.x + Math.cos(a) * (this.radius * 0.6),
        y: this.y + Math.sin(a) * (this.radius * 0.6),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        radius: 5.5,
        damage: 14 + this.tier * 2,
        color: i % 2 === 0 ? color1 : color2,
        life: 4.2,
      });
    }
    soundEngine?.playShoot?.(0.5);
  }

  fireTurretSalvo() {
    this.turretRecoil = 7.5;
    const turretOffsets = [-18, 18];
    const turretDist = 32;
    const color = this.phase === 3 ? '#ff0055' : '#ffe600';

    turretOffsets.forEach((off) => {
      const tx = this.x + Math.cos(this.turretAngle) * turretDist - Math.sin(this.turretAngle) * off;
      const ty = this.y + Math.sin(this.turretAngle) * turretDist + Math.cos(this.turretAngle) * off;

      this.bullets.push({
        x: tx,
        y: ty,
        vx: Math.cos(this.turretAngle) * 440,
        vy: Math.sin(this.turretAngle) * 440,
        radius: 6,
        damage: 22 + this.tier * 4,
        color: color,
        life: 3.5,
      });
    });
  }

  fireClusterMine(targetX, targetY) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    const speed = 280;
    this.bullets.push({
      x: this.x,
      y: this.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 11,
      damage: 32 + this.tier * 5,
      color: '#ff2a6d',
      life: 2.2,
      isCluster: true,
    });
  }

  takeDamage(amount) {
    this.health -= amount;
    particleSystem?.emitSparks?.(this.x, this.y, this.phase === 3 ? '#ff0055' : this.archetype.baseColor, 5, 200);
    if (this.health <= 0) {
      this.destroyAllMinions();
      return true;
    }
    return false;
  }

  destroyAllMinions() {
    this.drones = [];
    this.bullets = [];
    this.shockwaves = [];
    this.laserState = 'idle';
    if (this.arena) this.arena.active = false;
  }

  // =========================================================================
  // RENDERING PIPELINE
  // =========================================================================

  renderArena(ctx) {
    if (!this.arena || !this.arena.active) return;
    ctx.save();
    const glowColor = this.phase === 3 ? this.archetype.enrageColor : this.archetype.baseColor;

    // 1. Forcefield Hex Boundary Ring
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(this.arena.x, this.arena.y, this.arena.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Translucent Hazard Perimeter Fill
    ctx.fillStyle = glowColor + '08';
    ctx.beginPath();
    ctx.arc(this.arena.x, this.arena.y, this.arena.radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Rotating Perimeter Hazard Markers
    ctx.save();
    ctx.translate(this.arena.x, this.arena.y);
    ctx.rotate(this.reactorRotation * 0.15);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (this.arena.radius - 8), Math.sin(a) * (this.arena.radius - 8));
      ctx.lineTo(Math.cos(a) * (this.arena.radius + 8), Math.sin(a) * (this.arena.radius + 8));
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  render(ctx) {
    // 0. Render Boss Arena Forcefield
    this.renderArena(ctx);

    // 1. Render Kinetic Shockwaves
    for (const sw of this.shockwaves) {
      sw.render(ctx);
    }

    // 2. Render Sweeping Laser Beam (Telegraph or Firing)
    this.renderLaser(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);

    // 3. Threat Aura & Shadow Grid
    const glowColor = this.phase === 3 ? this.archetype.enrageColor : this.archetype.baseColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = this.phase === 3 ? 24 : 14;

    ctx.save();
    ctx.rotate(this.angle);

    // 4. Heavy Armored Hull Geometry
    const r = this.radius;

    // Dark Gunmetal Base Chassis
    ctx.fillStyle = '#060814';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 3;

    if (this.archetype.hullShape === 'hex') {
      // Segmented Dreadnought Fortress
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Armor Plating Seam Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
    } else if (this.archetype.hullShape === 'quad') {
      // Quad Heavy Cruiser with Spikes
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r * 1.15 : r * 0.8;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Scythe Reaper Warship
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(-r * 0.4, -r * 1.2);
      ctx.lineTo(-r * 0.8, -r * 0.5);
      ctx.lineTo(-r * 0.5, 0);
      ctx.lineTo(-r * 0.8, r * 0.5);
      ctx.lineTo(-r * 0.4, r * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 5. Rotating Energy Containment Rings
    ctx.save();
    ctx.rotate(this.reactorRotation);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 6. Central Pulsing Singularity Core
    const corePulse = 14 + Math.sin(this.reactorRotation * 2) * 3;
    const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, corePulse);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, glowColor);
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // restore rotation

    // 7. Articulated Twin Heavy Turrets
    ctx.save();
    ctx.rotate(this.turretAngle);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;

    const kick = this.turretRecoil || 0;
    ctx.fillRect(14 - kick, -22, 28, 7);
    ctx.fillRect(14 - kick, 15, 28, 7);
    ctx.strokeRect(14 - kick, -22, 28, 7);
    ctx.strokeRect(14 - kick, 15, 28, 7);

    // Muzzle Heat Vents
    ctx.fillStyle = glowColor;
    ctx.fillRect(38 - kick, -21, 4, 5);
    ctx.fillRect(38 - kick, 16, 4, 5);

    // Turret Mount Cap
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hazard Stripes
    ctx.save();
    ctx.beginPath();
    ctx.arc(8, 0, 12, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = glowColor;
    for (let s = -15; s < 25; s += 7) {
      ctx.fillRect(s, -15, 3, 30);
    }
    ctx.restore();
    ctx.restore();

    ctx.restore(); // restore translation

    // 8. Render Overdrive Escort Drones
    for (const drone of this.drones) {
      drone.render(ctx);
    }

    // 9. Tactical Boss Overhead Nameplate & Segmented HP Bar
    this.renderBossHealthBar(ctx);

    // 10. Render Glowing Plasma Projectiles
    this.renderBullets(ctx);
  }

  renderLaser(ctx) {
    if (this.laserState === 'idle') return;

    const x2 = this.x + Math.cos(this.laserAngle) * this.laserLength;
    const y2 = this.y + Math.sin(this.laserAngle) * this.laserLength;

    if (this.laserState === 'charging') {
      // Telegraph guide beam: glowing dotted red line with targeting reticle
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Targeting reticle along beam line
      const reticleDist = 380;
      const rx = this.x + Math.cos(this.laserAngle) * reticleDist;
      const ry = this.y + Math.sin(this.laserAngle) * reticleDist;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(rx, ry, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else if (this.laserState === 'firing') {
      // Full Berserk Mega Laser Beam
      ctx.save();

      // Outer Corona Glow
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.35)';
      ctx.lineWidth = this.laserWidth * 1.9;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 24;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Intermediate Radiant Beam
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = this.laserWidth;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Blinding White Core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.laserWidth * 0.38;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Core Emitter Flare
      const flareGrad = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.laserWidth * 1.5);
      flareGrad.addColorStop(0, '#ffffff');
      flareGrad.addColorStop(0.5, '#ff0055');
      flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.laserWidth * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  renderBossHealthBar(ctx) {
    const barW = 160;
    const barH = 10;
    const barX = this.x - barW / 2;
    const barY = this.y - this.radius - 32;

    ctx.save();

    // Boss Name & Phase Badge
    let phaseLabel = 'PHASE 1: STANDARD';
    if (this.phase === 2) phaseLabel = 'PHASE 2: OVERDRIVE DRONES';
    else if (this.phase === 3) phaseLabel = 'PHASE 3: BERSERK OVERCLOCK';

    ctx.font = 'bold 12px "Chakra Petch", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.phase === 3 ? '#ff0055' : this.archetype.baseColor;
    ctx.shadowBlur = 8;
    ctx.fillText(`${this.name} [${phaseLabel}]`, this.x, barY - 6);

    // Bar Frame
    ctx.fillStyle = '#05070f';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Damage-Lag Bar (Yellow-White)
    const lagPct = Math.max(0, this.prevHealth / this.maxHealth);
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(barX, barY, barW * lagPct, barH);

    // Active Health Fill (Gradient based on Phase)
    const hpPct = Math.max(0, this.health / this.maxHealth);
    const hpGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    if (this.phase === 3) {
      hpGrad.addColorStop(0, '#ff0055');
      hpGrad.addColorStop(1, '#ff708f');
    } else if (this.phase === 2) {
      hpGrad.addColorStop(0, '#a855f7');
      hpGrad.addColorStop(1, '#00f0ff');
    } else {
      hpGrad.addColorStop(0, '#00c6ff');
      hpGrad.addColorStop(1, '#0072ff');
    }
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // Segmented Divider Ticks
    ctx.strokeStyle = '#05070f';
    ctx.lineWidth = 1.5;
    for (let s = 1; s < 4; s++) {
      ctx.beginPath();
      ctx.moveTo(barX + (barW / 4) * s, barY);
      ctx.lineTo(barX + (barW / 4) * s, barY + barH);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderBullets(ctx) {
    if (this.bullets.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];

      // Elongated motion tear / laser streak
      const speed = Math.hypot(b.vx, b.vy);
      const angle = Math.atan2(b.vy, b.vx);
      const streakLen = Math.min(22, speed * 0.045);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      // Outer Corona Glow
      ctx.fillStyle = b.color + '44';
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius + streakLen, b.radius + 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Core Plasma Body
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius + streakLen * 0.6, b.radius, 0, 0, Math.PI * 2);
      ctx.fill();

      // White-Hot Singularity Center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}
