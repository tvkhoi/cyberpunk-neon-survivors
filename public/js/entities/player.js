import { particleSystem } from '../vfx/particles.js';
import { soundEngine } from '../audio/soundEngine.js';

export const AVATARS = {
  phantom: {
    id: 'phantom',
    name: 'CYBER PHANTOM',
    icon: '⚡',
    faIcon: '<i class="fa-solid fa-bolt"></i>',
    color: '#00f0ff',
    visorColor: '#ff007f',
    desc: '+15% Tốc độ di chuyển & lướt né',
    speedBonus: 1.15,
    shieldBonus: 0,
    critBonus: 0,
    energyBonus: 0,
  },
  titan: {
    id: 'titan',
    name: 'NEO TITAN',
    icon: '🛡️',
    faIcon: '<i class="fa-solid fa-shield-halved"></i>',
    color: '#10b981',
    visorColor: '#f59e0b',
    desc: '+35 Giáp ảo & Hồi phục giáp nhanh',
    speedBonus: 1.0,
    shieldBonus: 35,
    critBonus: 0,
    energyBonus: 0,
  },
  reaper: {
    id: 'reaper',
    name: 'VORTEX REAPER',
    icon: '🩸',
    faIcon: '<i class="fa-solid fa-droplet"></i>',
    color: '#f43f5e',
    visorColor: '#00f0ff',
    desc: '+15% Tỷ lệ sát thương bạo kích (Crit)',
    speedBonus: 1.0,
    shieldBonus: 0,
    critBonus: 0.15,
    energyBonus: 0,
  },
  valkyrie: {
    id: 'valkyrie',
    name: 'QUANTUM VALKYRIE',
    icon: '🌟',
    faIcon: '<i class="fa-solid fa-star"></i>',
    color: '#f59e0b',
    visorColor: '#8b5cf6',
    desc: '+30 Năng lượng Bullet-Time làm chậm',
    speedBonus: 1.05,
    shieldBonus: 0,
    critBonus: 0,
    energyBonus: 30,
  },
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.angle = 0;

    // Character Identity & Avatar
    this.name = 'CYBER_V';
    this.avatar = AVATARS.phantom;

    // Movement
    this.baseSpeed = 240 * this.avatar.speedBonus;
    this.speed = this.baseSpeed;
    this.speedMultiplier = 1.0; // Dynamic hazard slow multiplier (Module 3)
    this.vx = 0;
    this.vy = 0;

    // Stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 50 + this.avatar.shieldBonus;
    this.shield = this.maxShield;
    this.shieldRegenRate = 10; // per second
    this.shieldCooldown = 0;

    // Module 4: Medkit Inventory & Quick Injector
    this.storedMedkits = 1;
    this.maxStoredMedkits = 3;

    // Dash Skill & Hyper Boost
    this.dashCooldown = 1.2;
    this.dashTimer = 0;
    this.isDashing = false;
    this.dashDuration = 0.18;
    this.dashTimeRemaining = 0;
    this.dashSpeedMultiplier = 3.6;

    // Hyper Boost Mechanic (Unlimited Boost Chaining)
    this.hyperBoostTimer = 0;
    this.isHyperBoosted = false;

    // Mobile Virtual Touch Joystick & Aiming States
    this.joystickVector = { x: 0, y: 0 };
    this.isManualAiming = false;
    this.isAutoAiming = false;

    // Bullet-Time Skill (Slow Motion)
    this.isBulletTime = false;
    this.touchBulletTimeToggle = false;
    this.maxEnergy = 100 + this.avatar.energyBonus;
    this.energy = this.maxEnergy;
    this.energyDrainRate = 42; // per second (Faster drain under high-octane pressure)
    this.energyRegenRate = 14; // Slower recharge, making bullet-time a high-value tactical skill

    // Cyber Overclock Ultimate (Sandevistan / Bullet Time / Nộ Tối Thượng)
    this.overclockGauge = 0;
    this.maxOverclockGauge = 100;
    this.isOverclockActive = false;
    this.overclockDuration = 5.0;
    this.overclockTimer = 0;

    // Visual Animation States & Artisanal Shmup Physics (Itch.io Handcrafted Visuals)
    this.thrusterAnim = 0;
    this.strobeTimer = 0;
    this.recoil = 0;
    this.bankAngle = 0;

    // Progression
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.critChance = 0.15 + this.avatar.critBonus;
    this.critMultiplier = 2.0;
    this.damageMultiplier = 1.0;
  }

  triggerRecoil(amt = 3.5) {
    this.recoil = Math.min(8, this.recoil + amt);
  }

  setProfile(name, avatarId) {
    if (name && typeof name === 'string') {
      this.name = name.trim().slice(0, 15) || 'CYBER_V';
    }
    if (avatarId && AVATARS[avatarId]) {
      this.avatar = AVATARS[avatarId];
    }

    // Apply Avatar bonuses
    this.baseSpeed = 240 * this.avatar.speedBonus;
    this.speed = this.isHyperBoosted ? this.baseSpeed * 1.35 : this.baseSpeed;

    this.maxShield = 50 + this.avatar.shieldBonus;
    this.shield = Math.min(this.shield, this.maxShield);

    this.maxEnergy = 100 + this.avatar.energyBonus;
    this.energy = Math.min(this.energy, this.maxEnergy);

    this.critChance = 0.15 + this.avatar.critBonus;

    particleSystem.emitShockwave(this.x, this.y, this.avatar.color, 140, 0.4);
    soundEngine.playLevelUp();
  }

  triggerHyperBoost(duration = 2.5) {
    this.isHyperBoosted = true;
    this.hyperBoostTimer = duration;
    this.dashTimer = 0; // immediate dash refresh!
    particleSystem.emitShockwave(this.x, this.y, '#ffe600', 160, 0.45);
    particleSystem.addFloatingText(this.x, this.y - 25, 'HYPER BOOST!', '#ffe600', true);
    soundEngine.playLevelUp();
  }

  dash() {
    if (this.dashTimer <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = this.isHyperBoosted ? this.dashCooldown * 0.5 : this.dashCooldown;
      this.dashTimeRemaining = this.dashDuration;
      soundEngine.playDash();
      return true;
    }
    return false;
  }

  chargeOverclock(amt = 5) {
    if (this.isOverclockActive) return;
    const prev = this.overclockGauge;
    this.overclockGauge = Math.min(this.maxOverclockGauge, this.overclockGauge + amt);
    if (prev < this.maxOverclockGauge && this.overclockGauge >= this.maxOverclockGauge) {
      if (soundEngine.announce) soundEngine.announce('Overclock ultimate ready');
      particleSystem.emitShockwave(this.x, this.y, '#ffd700', 180, 0.45);
      particleSystem.addFloatingText(this.x, this.y - 30, '⚡ OVERCLOCK SẴN SÀNG (PHÍM F)!', '#ffd700', true);
    }
  }

  activateOverclock() {
    if (this.overclockGauge < this.maxOverclockGauge || this.isOverclockActive) return false;
    this.overclockGauge = 0;
    this.isOverclockActive = true;
    this.overclockTimer = this.overclockDuration;
    this.dashTimer = 0; // instant dash refresh
    particleSystem.emitShockwave(this.x, this.y, '#ffd700', 260, 0.6);
    particleSystem.emitShockwave(this.x, this.y, '#00f0ff', 180, 0.4);
    particleSystem.addFloatingText(this.x, this.y - 40, '⚡ SANDEVISTAN OVERCLOCK KÍCH HOẠT!', '#ffd700', true);
    if (soundEngine.playOverclockActive) soundEngine.playOverclockActive();
    if (soundEngine.announce) soundEngine.announce('Sandevistan overdrive engaged');
    return true;
  }

  toggleBulletTime() {
    if (this.isBulletTime) {
      this.isBulletTime = false;
      this.touchBulletTimeToggle = false;
    } else if (this.energy > 15) {
      this.isBulletTime = true;
      this.touchBulletTimeToggle = true;
    }
    return this.isBulletTime;
  }

  isInvulnerable() {
    return Boolean(this.isDashing);
  }

  handleInput(keys, mouseWorld, dt) {
    // 1. Aim toward mouse or touch drag position when manually aiming or on desktop
    if (mouseWorld && (this.isManualAiming || !this.isAutoAiming)) {
      const dx = mouseWorld.x - this.x;
      const dy = mouseWorld.y - this.y;
      if (Math.hypot(dx, dy) > 8) {
        this.angle = Math.atan2(dy, dx);
      }
    }

    // 2. Dash Skill Trigger (Spacebar, Right Click, or Touch Dash Button)
    if ((keys['Space'] || keys['Dash']) && this.dashTimer <= 0 && !this.isDashing) {
      this.dash();
    }

    // 2.5. Overclock Ultimate Trigger (Key F, Key R, or Touch Overclock Button)
    if (keys['KeyF'] || keys['KeyR'] || keys['Overclock']) {
      this.activateOverclock();
    }

    // 3. Bullet-Time Trigger (Shift, Q key, or Touch Button)
    if ((keys['ShiftLeft'] || keys['KeyQ'] || keys['BulletTime'] || this.touchBulletTimeToggle) && this.energy > 15) {
      this.isBulletTime = true;
    } else if (!keys['ShiftLeft'] && !keys['KeyQ'] && !keys['BulletTime'] && !this.touchBulletTimeToggle) {
      this.isBulletTime = false;
    }

    // 4. Directional WASD Movement & Virtual Joystick
    let moveX = 0;
    let moveY = 0;

    if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    // Apply Virtual Joystick vector if active
    if (this.joystickVector && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
      moveX = this.joystickVector.x;
      moveY = this.joystickVector.y;
      // If not auto-aiming and not touching to aim, face moving direction
      if (!this.isAutoAiming && !this.isManualAiming) {
        this.angle = Math.atan2(moveY, moveX);
      }
    } else {
      // Normalize diagonal velocity for keyboard
      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        moveX /= len;
        moveY /= len;
      }
    }

    let currentSpeed = (this.isHyperBoosted ? this.baseSpeed * 1.35 : this.baseSpeed) * (this.speedMultiplier !== undefined ? this.speedMultiplier : 1.0);
    this.speed = currentSpeed;

    if (this.isDashing) {
      currentSpeed *= this.dashSpeedMultiplier;
      // Emit neon dash ghost in player's avatar color
      particleSystem.addGhost(this.x, this.y, this.angle, this.radius, this.avatar.color);
    }

    this.vx = moveX * currentSpeed;
    this.vy = moveY * currentSpeed;
  }

  update(dt, worldWidth, worldHeight) {
    this.thrusterAnim += dt * 18;
    this.strobeTimer += dt * 4;

    // Recoil decay & lateral flight banking physics
    this.recoil = Math.max(0, this.recoil - dt * 28);
    const lateralSpeed = (this.vx * -Math.sin(this.angle) + this.vy * Math.cos(this.angle));
    const targetBank = Math.max(-0.35, Math.min(0.35, lateralSpeed / 250));
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1, dt * 12);

    // Update Hyper Boost decay
    if (this.hyperBoostTimer > 0) {
      this.hyperBoostTimer -= dt;
      if (this.hyperBoostTimer <= 0) {
        this.isHyperBoosted = false;
      }
    }

    // Update Cyber Overclock Ultimate (Sandevistan)
    if (this.isOverclockActive) {
      this.overclockTimer -= dt;
      this.critChance = 1.0; // 100% Guaranteed Critical Strike!
      this.dashTimer = 0; // Infinite chaining dash
      if (Math.random() < 0.6) {
        particleSystem.addGhost(this.x, this.y, this.angle, this.radius, '#ffd700');
      }
      if (this.overclockTimer <= 0) {
        this.isOverclockActive = false;
        this.critChance = 0.15 + this.avatar.critBonus;
        particleSystem.addFloatingText(this.x, this.y - 30, 'OVERCLOCK EXHAUSTED', '#94a3b8', false);
      }
    }

    // Update Dash
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    }
    if (this.isDashing) {
      this.dashTimeRemaining -= dt;
      if (this.dashTimeRemaining <= 0) {
        this.isDashing = false;
      }
    }

    // Update Bullet-Time Energy
    if (this.isBulletTime) {
      this.energy = Math.max(0, this.energy - this.energyDrainRate * dt);
      if (this.energy <= 0) {
        this.isBulletTime = false;
        this.touchBulletTimeToggle = false;
      }
      soundEngine.setBulletTime(true);
    } else {
      this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegenRate * dt);
      soundEngine.setBulletTime(false);
    }

    // Update Shield Regen
    if (this.shieldCooldown > 0) {
      this.shieldCooldown -= dt;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
    }

    // Move player
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Boundary clamp (only applied when finite world bounds are defined)
    if (Number.isFinite(worldWidth) && Number.isFinite(worldHeight)) {
      this.x = Math.max(this.radius, Math.min(worldWidth - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(worldHeight - this.radius, this.y));
    }

    // Reset hazard slow multiplier for next frame
    this.speedMultiplier = 1.0;
  }

  takeDamage(amount) {
    if (this.isDashing) return 0; // Invulnerable while dashing

    let remaining = amount;
    this.shieldCooldown = 3.0; // delay shield regen

    if (this.shield > 0) {
      if (this.shield >= remaining) {
        this.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= this.shield;
        this.shield = 0;
      }
    }

    if (remaining > 0) {
      this.health = Math.max(0, this.health - remaining);
      particleSystem.emitSparks(this.x, this.y, '#ff0055', 8, 150);
    }

    return remaining;
  }

  heal(amount) {
    const prevHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    const restored = this.health - prevHealth;

    // Bonus 50% shield recharge on heal
    if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + Math.round(amount * 0.5));
    }

    particleSystem.emitShockwave(this.x, this.y, '#10b981', 120, 0.4);
    particleSystem.addFloatingText(this.x, this.y - 20, `+${restored} HP`, '#10b981', true);
    return { restored, health: this.health, shield: this.shield };
  }

  useStoredMedkit() {
    if (this.storedMedkits <= 0) return null;
    if (this.health >= this.maxHealth) return null; // full health, do not waste

    this.storedMedkits--;
    return this.heal(35);
  }

  addXP(amount) {
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.42);
      leveledUp = true;
      soundEngine.playLevelUp();
      particleSystem.emitShockwave(this.x, this.y, '#ffff00', 160, 0.5);
    }
    return leveledUp;
  }

  render(ctx) {
    ctx.save();

    // 1. Tactical Pilot Bracket Callout (Clean Indie Shmup Typography)
    ctx.save();
    ctx.font = 'bold 11px "JetBrains Mono", "Chakra Petch", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = this.avatar.color;
    ctx.shadowBlur = 6;
    ctx.fillText(`[ PILOT // ${this.name} ]`, this.x, this.y - this.radius - 15);
    ctx.restore();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 2. Physical Flight Dynamics: Recoil Kickback & Lateral 2.5D Wing Banking
    ctx.translate(-this.recoil, 0);
    ctx.transform(1, 0, this.bankAngle * 0.35, 1 - Math.abs(this.bankAngle) * 0.15, 0, 0);

    // 3. Neon Cyber Shield with Hexagonal Deflector Nodes
    if (this.shield > 0) {
      ctx.save();
      const shieldAlpha = 0.35 + (this.shield / this.maxShield) * 0.5;
      ctx.strokeStyle = `rgba(0, 240, 255, ${shieldAlpha})`;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Shield Hex Deflector Brackets
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8, a - 0.18, a + 0.18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3.5. Golden Sandevistan Overclock Aura
    if (this.isOverclockActive) {
      ctx.save();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 18;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const isMoving = Math.hypot(this.vx, this.vy) > 10;
    const flameBase = isMoving ? 18 + Math.sin(this.thrusterAnim) * 5 : 6;
    const flameLen = this.isDashing ? flameBase * 2.8 : (this.isHyperBoosted ? flameBase * 1.8 : flameBase);

    const thrusterYOffsets = [-7, 7];
    thrusterYOffsets.forEach((ty) => {
      // Mach Shock Diamonds & Multi-layer Plasma Flame
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Outer Flame Sheath
      ctx.fillStyle = this.isHyperBoosted ? '#ffe600' : (this.avatar.color || '#00f0ff');
      ctx.beginPath();
      ctx.moveTo(-this.radius + 2, ty - 3.5);
      ctx.lineTo(-this.radius - flameLen, ty);
      ctx.lineTo(-this.radius + 2, ty + 3.5);
      ctx.closePath();
      ctx.fill();

      // Inner White-Hot Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-this.radius + 2, ty - 1.8);
      ctx.lineTo(-this.radius - flameLen * 0.55, ty);
      ctx.lineTo(-this.radius + 2, ty + 1.8);
      ctx.closePath();
      ctx.fill();

      // Diamond Shock Nodes
      if (isMoving) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-this.radius - flameLen * 0.35 - 1, ty - 1, 2, 2);
        ctx.fillRect(-this.radius - flameLen * 0.7 - 1, ty - 1, 2, 2);
      }
      ctx.restore();

      // Metallic Nozzle Housing
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.fillRect(-this.radius - 2, ty - 3.5, 4, 7);
      ctx.strokeRect(-this.radius - 2, ty - 3.5, 4, 7);
    });

    // 5. Handcrafted Composite Fighter Hull (Layered Shading & Beveling)
    ctx.shadowColor = this.avatar.color;
    ctx.shadowBlur = this.isHyperBoosted ? 18 : 10;

    // Dark Gunmetal Chassis Base
    const hullGrad = ctx.createLinearGradient(-this.radius, 0, this.radius, 0);
    hullGrad.addColorStop(0, '#070b14');
    hullGrad.addColorStop(0.6, '#0f172a');
    hullGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = this.avatar.color;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    if (this.avatar.id === 'titan') {
      // Neo Titan: Heavy Hexagonal Siege Dreadnought
      ctx.moveTo(this.radius + 6, 0);
      ctx.lineTo(this.radius * 0.4, -this.radius * 1.15);
      ctx.lineTo(-this.radius * 0.7, -this.radius * 1.15);
      ctx.lineTo(-this.radius, -this.radius * 0.45);
      ctx.lineTo(-this.radius, this.radius * 0.45);
      ctx.lineTo(-this.radius * 0.7, this.radius * 1.15);
      ctx.lineTo(this.radius * 0.4, this.radius * 1.15);
    } else if (this.avatar.id === 'reaper') {
      // Vortex Reaper: Swept Scythe Assassin Wings
      ctx.moveTo(this.radius + 9, 0);
      ctx.lineTo(this.radius * 0.15, -this.radius * 0.6);
      ctx.lineTo(-this.radius * 0.85, -this.radius * 1.35);
      ctx.lineTo(-this.radius * 0.5, -this.radius * 0.3);
      ctx.lineTo(-this.radius * 0.85, 0);
      ctx.lineTo(-this.radius * 0.5, this.radius * 0.3);
      ctx.lineTo(-this.radius * 0.85, this.radius * 1.35);
      ctx.lineTo(this.radius * 0.15, this.radius * 0.6);
    } else if (this.avatar.id === 'valkyrie') {
      // Quantum Valkyrie: Golden Swept Solar Interceptor
      ctx.moveTo(this.radius + 9, 0);
      ctx.lineTo(this.radius * 0.35, -this.radius * 0.8);
      ctx.lineTo(-this.radius * 0.95, -this.radius * 1.1);
      ctx.lineTo(-this.radius * 0.45, 0);
      ctx.lineTo(-this.radius * 0.95, this.radius * 1.1);
      ctx.lineTo(this.radius * 0.35, this.radius * 0.8);
    } else {
      // Cyber Phantom: High-Tech Delta Fighter with Canards
      ctx.moveTo(this.radius + 8, 0);
      ctx.lineTo(this.radius * 0.15, -this.radius * 0.5);
      ctx.lineTo(-this.radius * 0.9, -this.radius * 0.95);
      ctx.lineTo(-this.radius * 0.6, 0);
      ctx.lineTo(-this.radius * 0.9, this.radius * 0.95);
      ctx.lineTo(this.radius * 0.15, this.radius * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Recessed Armor Seam Grooves & Intake Radiators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.25, -4);
    ctx.lineTo(-this.radius * 0.35, -9);
    ctx.moveTo(this.radius * 0.25, 4);
    ctx.lineTo(-this.radius * 0.35, 9);
    ctx.stroke();

    // Air Intake Cowlings with Accent Glow
    ctx.fillStyle = this.avatar.color;
    ctx.fillRect(-this.radius * 0.2, -7.5, 4, 2);
    ctx.fillRect(-this.radius * 0.2, 5.5, 4, 2);

    // 7. Cockpit Canopy with Specular Sheen (High-Tech Fighter Visor)
    const canopyGrad = ctx.createLinearGradient(2, -4, 8, 4);
    canopyGrad.addColorStop(0, '#ffffff');
    canopyGrad.addColorStop(0.35, this.avatar.visorColor);
    canopyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = canopyGrad;
    ctx.shadowColor = this.avatar.visorColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(3, 0, 7.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pilot HUD Display Reticle Dot inside Canopy
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 8. Wingtip Navigational Strobe LEDs (Arcade Strobe Pulse)
    const isStrobeOn = Math.sin(this.strobeTimer) > 0;
    if (isStrobeOn) {
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-this.radius * 0.8, -this.radius * 0.9, 2.5, 2.5);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(-this.radius * 0.8, this.radius * 0.9, 2.5, 2.5);
    }

    // 9. Dual Front Railgun Barrels with Muzzle Heat Discoloration
    ctx.fillStyle = '#334155';
    ctx.fillRect(8, -5, 12, 2.5);
    ctx.fillRect(8, 2.5, 12, 2.5);

    // Muzzle Burn Rings
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(18, -5, 2, 2.5);
    ctx.fillRect(18, 2.5, 2, 2.5);

    ctx.restore();
  }
}
