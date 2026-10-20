export const DROP_CONFIGS = {
  health: {
    type: 'health',
    name: 'Nano-Repair Medkit',
    icon: '✚',
    faIcon: '<i class="fa-solid fa-kit-medical"></i>',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    healAmount: 35,
  },
  ammo_homing: {
    type: 'ammo',
    weaponType: 'homing',
    name: 'Plasma Ammo Core',
    icon: '🚀',
    faIcon: '<i class="fa-solid fa-rocket"></i>',
    color: '#00f0ff',
    glowColor: 'rgba(0, 240, 255, 0.4)',
  },
  ammo_laser: {
    type: 'ammo',
    weaponType: 'laser',
    name: 'Laser Battery Cell',
    icon: '⚡',
    faIcon: '<i class="fa-solid fa-bolt"></i>',
    color: '#ff007f',
    glowColor: 'rgba(255, 0, 128, 0.4)',
  },
  ammo_shotgun: {
    type: 'ammo',
    weaponType: 'shotgun',
    name: 'EMP Shells Pack',
    icon: '💥',
    faIcon: '<i class="fa-solid fa-burst"></i>',
    color: '#ffff00',
    glowColor: 'rgba(255, 255, 0, 0.4)',
  },
  ammo_orbit: {
    type: 'ammo',
    weaponType: 'orbit',
    name: 'Orbit Core Matrix',
    icon: '🛡️',
    faIcon: '<i class="fa-solid fa-shield-halved"></i>',
    color: '#39ff14',
    glowColor: 'rgba(57, 255, 20, 0.4)',
  },
  buff_speed: {
    type: 'buff',
    buffType: 'speed',
    name: 'Neural Accelerator',
    icon: '👟',
    faIcon: '<i class="fa-solid fa-person-running"></i>',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
  },
  buff_crit: {
    type: 'buff',
    buffType: 'crit',
    name: 'Precision Optics Chip',
    icon: '🎯',
    faIcon: '<i class="fa-solid fa-crosshairs"></i>',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.4)',
  },
  buff_hull: {
    type: 'buff',
    buffType: 'hull',
    name: 'Nano-Repair Hull Core',
    icon: '💖',
    faIcon: '<i class="fa-solid fa-heart"></i>',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.4)',
  },
  buff_energy: {
    type: 'buff',
    buffType: 'energy',
    name: 'Chrono Battery Cell',
    icon: '🔋',
    faIcon: '<i class="fa-solid fa-battery-full"></i>',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
  buff_nuke: {
    type: 'buff',
    buffType: 'nuke',
    name: 'EMP Tactical Nuke',
    icon: '💣',
    faIcon: '<i class="fa-solid fa-bomb"></i>',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.5)',
  },
  buff_magnet: {
    type: 'buff',
    buffType: 'magnet',
    name: 'Quantum Graviton Magnet',
    icon: '🧲',
    faIcon: '<i class="fa-solid fa-magnet"></i>',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.5)',
  },
};

export class CollectibleDrop {
  constructor(x, y, configKey = 'health') {
    this.x = x;
    this.y = y;
    this.configKey = configKey;
    this.config = DROP_CONFIGS[configKey] || DROP_CONFIGS.health;
    this.radius = 14;
    this.vx = 0;
    this.vy = 0;
    this.lifetime = 35; // 35 seconds before despawn
    this.maxLifetime = 35;
    this.hoverAngle = Math.random() * Math.PI * 2;
    this.pulseScale = 1.0;
  }

  get isHealth() {
    return this.config.type === 'health';
  }

  get isAmmo() {
    return this.config.type === 'ammo';
  }

  get isBuff() {
    return this.config.type === 'buff';
  }

  update(dt, player) {
    this.lifetime -= dt;
    this.hoverAngle += dt * 3.5;
    this.pulseScale = 1.0 + Math.sin(this.hoverAngle) * 0.15;

    // Magnet Pull Effect towards Player if player exists
    this.vx = 0;
    this.vy = 0;
    if (player) {
      const magnetRadius = (player && player.magnetRadius) || 190;
      const dist = Math.hypot(player.x - this.x, player.y - this.y);

      if (dist < magnetRadius && dist > 1) {
        const pullSpeed = 460;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.vx = Math.cos(angle) * pullSpeed;
        this.vy = Math.sin(angle) * pullSpeed;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
    }

    return this.lifetime > 0;
  }

  render(ctx) {
    // Blinking warning when near despawn (last 5 seconds)
    if (this.lifetime < 5.0 && Math.floor(this.lifetime * 8) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const r = this.radius * this.pulseScale;
    const hoverY = Math.sin(this.hoverAngle) * 4;

    // 1. Ground Shadow & Circular Energy Beacon
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 15, r * 1.15, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Floor Projection Beacon Ring
    ctx.strokeStyle = this.config.glowColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 15, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating Beacon Ticks
    ctx.save();
    ctx.translate(0, 15);
    ctx.rotate(this.hoverAngle * 0.6);
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, a - 0.2, a + 0.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // 2. Hover Floating Offset for 2.5D Crate
    ctx.save();
    ctx.translate(0, hoverY);

    // Outer Aura Glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
    ctx.fillStyle = this.config.glowColor;
    ctx.fill();
    ctx.restore();

    if (this.isHealth) {
      // --- NANO-REPAIR MEDKIT (Military Pelican Crate) ---
      const w = 26;
      const h = 20;

      // Heavy Armored Flight-Case Body
      const crateGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      crateGrad.addColorStop(0, '#062817');
      crateGrad.addColorStop(0.5, '#04180e');
      crateGrad.addColorStop(1, '#020b06');
      ctx.fillStyle = crateGrad;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;

      // Chamfered / Rounded Crate Body
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3.5);
      ctx.fill();
      ctx.stroke();

      // Steel Corner Bumper Protectors
      ctx.fillStyle = '#334155';
      const corners = [
        [-w / 2, -h / 2],
        [w / 2 - 4, -h / 2],
        [-w / 2, h / 2 - 4],
        [w / 2 - 4, h / 2 - 4]
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx, cy, 4, 4);
      });

      // Carrying Handle on Top
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -h / 2);
      ctx.lineTo(-6, -h / 2 - 3);
      ctx.lineTo(6, -h / 2 - 3);
      ctx.lineTo(6, -h / 2);
      ctx.stroke();

      // Recessed Emerald Center Plate
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(-w / 2 + 5, -h / 2 + 4, w - 10, h - 8);

      // White-Hot Medical Plus Emblem (Vector drawn, not font glyph)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      // Vertical bar
      ctx.fillRect(-2, -5, 4, 10);
      // Horizontal bar
      ctx.fillRect(-5, -2, 10, 4);
      ctx.shadowBlur = 0;

      // 3 Blinking Cryo LEDs
      const isLedOn = Math.sin(this.hoverAngle * 4) > 0;
      ctx.fillStyle = isLedOn ? '#34d399' : '#047857';
      ctx.fillRect(w / 2 - 4, -3, 2, 2);
      ctx.fillRect(w / 2 - 4, 0, 2, 2);
      ctx.fillRect(w / 2 - 4, 3, 2, 2);

    } else if (this.isAmmo) {
      // --- AMMO CORE CRATES (Heavy Ballistic Munitions Canister) ---
      const w = 26;
      const h = 22;

      // Carbon Steel Casing
      const ammoGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      ammoGrad.addColorStop(0, '#151b2e');
      ammoGrad.addColorStop(0.5, '#0b0f1a');
      ammoGrad.addColorStop(1, '#06080e');
      ctx.fillStyle = ammoGrad;
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.stroke();

      // Top & Bottom Diagonal Hazard Warning Stripes
      ctx.save();
      ctx.beginPath();
      ctx.rect(-w / 2 + 2, -h / 2 + 2, w - 4, 3.5);
      ctx.clip();
      ctx.fillStyle = this.config.color;
      for (let s = -w; s < w; s += 6) {
        ctx.fillRect(s, -h / 2, 3, 6);
      }
      ctx.restore();

      // Translucent Plasma Core Chamber in Center
      ctx.fillStyle = '#030712';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 7, w - 8, 9);
      ctx.strokeStyle = this.config.color + '66';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2 + 4, -h / 2 + 7, w - 8, 9);

      // Glowing Internal Vector Munitions Insignia
      ctx.save();
      ctx.strokeStyle = this.config.color;
      ctx.fillStyle = this.config.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.config.color;
      ctx.shadowBlur = 6;

      if (this.config.weaponType === 'homing') {
        // Twin Delta-Wing Micro-Missiles
        ctx.beginPath();
        // Left missile
        ctx.moveTo(-4, -h / 2 + 8);
        ctx.lineTo(-2, -h / 2 + 14);
        ctx.lineTo(-6, -h / 2 + 14);
        ctx.closePath();
        ctx.fill();
        // Right missile
        ctx.moveTo(4, -h / 2 + 8);
        ctx.lineTo(6, -h / 2 + 14);
        ctx.lineTo(2, -h / 2 + 14);
        ctx.closePath();
        ctx.fill();
      } else if (this.config.weaponType === 'laser') {
        // High-Voltage Focusing Prism & Laser Spark
        ctx.beginPath();
        ctx.moveTo(-1, -h / 2 + 7.5);
        ctx.lineTo(2, -h / 2 + 11);
        ctx.lineTo(-1, -h / 2 + 11);
        ctx.lineTo(1, -h / 2 + 15);
        ctx.stroke();
      } else if (this.config.weaponType === 'shotgun') {
        // EMP Cluster Shell Spread
        for (let p = -1; p <= 1; p++) {
          ctx.beginPath();
          ctx.arc(p * 5, -h / 2 + 11.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Orbit Core Ring
        ctx.beginPath();
        ctx.arc(0, -h / 2 + 11.5, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -h / 2 + 11.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Dual Mechanical Latch Clips
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-w / 2 - 1, -2, 2, 4);
      ctx.fillRect(w / 2 - 1, -2, 2, 4);

    } else {
      // --- BUFF MODULE HOLOCRONS (Tactical Data Hologram) ---
      const rad = 13;

      // Rotating Holographic Hex Prism
      ctx.save();
      ctx.rotate(this.hoverAngle * 0.8);
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 1.8;
      ctx.fillStyle = this.config.color + '22';

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner Rotating Tech Diamond
      ctx.rotate(-this.hoverAngle * 1.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-rad * 0.4, -rad * 0.4, rad * 0.8, rad * 0.8);
      ctx.restore();

      // Central Floating Tech Symbol
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = this.config.color;
      ctx.shadowBlur = 8;
      ctx.font = 'bold 10px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const buffLabel = (this.config.buffType || 'MOD').slice(0, 3).toUpperCase();
      ctx.fillText(buffLabel, 0, 0);
    }

    ctx.restore(); // restore hoverY
    ctx.restore(); // restore translate
  }
}

/**
 * Calculates drop item based on enemy type and drop rates.
 * Returns null if no drop rolled.
 */
export function calculateEnemyDrop(enemyType = 'swarmer', randomFn = Math.random) {
  const roll = randomFn();
  const ammoTypes = ['ammo_homing', 'ammo_laser', 'ammo_shotgun', 'ammo_orbit'];
  const ammoKey = ammoTypes[Math.floor(randomFn() * ammoTypes.length)];

  if (enemyType === 'kamikaze' || enemyType === 'sniper') {
    // Elite enemies: 20% Ammo Box, 15% Medkit (Total 35%)
    if (roll < 0.20) return ammoKey;
    if (roll < 0.35) return 'health';
    return null;
  }

  // Regular swarmer: 12% Ammo Box, 8% Medkit (Total 20%)
  if (roll < 0.12) return ammoKey;
  if (roll < 0.20) return 'health';
  return null;
}

/**
 * Calculates upgrade perk / power-up drop (Speed, Crit, Hull, Energy, Nuke, Magnet)
 */
export function calculatePerkDrop(enemyType = 'swarmer', randomFn = Math.random) {
  const roll = randomFn();

  // Elite enemies: 7% chance to drop stat perk or powerup
  // Regular swarmer: Only 2.5% chance to drop stat perk or powerup (Hardcore Survival)
  const threshold = (enemyType === 'kamikaze' || enemyType === 'sniper' || enemyType === 'enforcer') ? 0.07 : 0.025;
  if (roll >= threshold) return null;

  // Weighted roll: common stat boosters vs rare emergency powerups (nuke & magnet)
  const perkRoll = randomFn();
  if (perkRoll < 0.25) return 'buff_speed';
  if (perkRoll < 0.50) return 'buff_crit';
  if (perkRoll < 0.75) return 'buff_hull';
  if (perkRoll < 0.90) return 'buff_energy';
  if (perkRoll < 0.95) return 'buff_magnet';
  return 'buff_nuke'; // Rare legendary bomb
}

/**
 * Guaranteed boss drops: 1 Medkit + 2 specialized Ammo Boxes.
 */
export function calculateBossDrops(x, y) {
  return [
    new CollectibleDrop(x, y, 'health'),
    new CollectibleDrop(x - 35, y + 25, 'ammo_laser'),
    new CollectibleDrop(x + 35, y + 25, 'ammo_shotgun'),
  ];
}

/**
 * Computes nearest drops (Medkit and Ammo Box) relative to player.
 */
export function findNearestDrops(player, drops = []) {
  let nearestMedkit = null;
  let minMedkitDist = Infinity;
  let nearestAmmo = null;
  let minAmmoDist = Infinity;

  const arrows = ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'];
  const faIconClasses = [
    'fa-arrow-up',
    'fa-arrow-trend-up',
    'fa-arrow-right',
    'fa-arrow-trend-down',
    'fa-arrow-down',
    'fa-arrow-trend-down fa-flip-horizontal',
    'fa-arrow-left',
    'fa-arrow-trend-up fa-flip-horizontal',
  ];
  const getDirectionArrow = (fromX, fromY, toX, toY) => {
    let angle = Math.atan2(toY - fromY, toX - fromX); // -PI to PI (0 is East)
    let deg = (angle * 180) / Math.PI; // -180 to 180
    // Normalize to 0 = North (up)
    deg = (deg + 90 + 360) % 360;
    const idx = Math.round(deg / 45) % 8;
    return {
      arrow: arrows[idx],
      faArrow: `<i class="fa-solid ${faIconClasses[idx]}"></i>`,
      deg: Math.round(deg),
    };
  };

  for (const drop of drops) {
    const dist = Math.hypot(drop.x - player.x, drop.y - player.y);
    if (drop.config.type === 'health') {
      if (dist < minMedkitDist) {
        minMedkitDist = dist;
        const dir = getDirectionArrow(player.x, player.y, drop.x, drop.y);
        nearestMedkit = {
          drop,
          dist: Math.round(dist),
          arrow: dir.arrow,
          faArrow: dir.faArrow,
          deg: dir.deg,
        };
      }
    } else if (drop.config.type === 'ammo') {
      if (dist < minAmmoDist) {
        minAmmoDist = dist;
        const dir = getDirectionArrow(player.x, player.y, drop.x, drop.y);
        nearestAmmo = {
          drop,
          dist: Math.round(dist),
          arrow: dir.arrow,
          faArrow: dir.faArrow,
          deg: dir.deg,
        };
      }
    }
  }

  return { nearestMedkit, nearestAmmo };
}
