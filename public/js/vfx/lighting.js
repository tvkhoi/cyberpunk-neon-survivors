import { vfxConfig, VFX_CONFIG, DEFAULT_VFX_CONFIG } from '../config/vfxConfig.js';
export { vfxConfig, VFX_CONFIG };

function hash2D(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Dynamic Proxy for HAZARD_TYPES reflecting real-time updates from vfxConfig
 */
export const HAZARD_TYPES = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const lower = prop.toLowerCase();
      const h = vfxConfig.getHazard(lower);
      if (h) return h;
    }
    return undefined;
  },
  ownKeys() {
    return ['ACID_POOL', 'EMP_CONDUIT', 'MAGMA_VENT', 'QUANTUM_SINGULARITY', 'SOLAR_LASER'];
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      value: this.get ? this.get(target, prop) : undefined,
    };
  },
});

export class ArenaHazard {
  constructor(config = {}) {
    this.id = config.id || 'hz_' + Math.random().toString(36).slice(2, 9);
    this.type = config.type || 'acid_pool';
    this.x = config.x || 0;
    this.y = config.y || 0;
    const typeKey = this.type.toLowerCase();
    const hazardDef = vfxConfig.getHazard(typeKey) || {};
    this.config = Object.assign({}, hazardDef, config);
    this.radius = config.radius || (this.config.defaultRadius || 60);
    this.biomeId = config.biomeId || this.config.biomeId || null;
    this.active = config.active !== undefined ? config.active : true;

    // Hazard State Machine
    this.state = config.state || (this.type === 'emp_conduit' ? 'cooldown' : (this.type === 'magma_vent' ? 'dormant' : 'active'));
    this.timer = config.timer || 0;
    this.tickTimer = 0;

    // EMP Conduit attributes
    this.x2 = config.x2 !== undefined ? config.x2 : this.x + (this.config.pylonDist || 180);
    this.y2 = config.y2 !== undefined ? config.y2 : this.y;
    this.pylonRadius = 14;

    // Magma Vent durations
    this.dormantDuration = config.dormantDuration || this.config.dormantDuration || 2.5;
    this.warningDuration = config.warningDuration || this.config.warningDuration || 1.2;
    this.eruptDuration = config.eruptDuration || this.config.eruptDuration || 0.75;

    // Solar Laser attributes
    this.angle = config.angle || 0;
    this.rotSpeed = config.rotSpeed || this.config.rotSpeed || 0.8;
    this.beamLength = config.beamLength || this.config.beamLength || 320;
    this.beamWidth = config.beamWidth || this.config.beamWidth || 8;

    // Quantum Singularity attributes
    this.pullRadius = config.pullRadius || this.config.pullRadius || 240;
    this.pullForce = config.pullForce || this.config.pullForce || 130;
    this.coreRadius = config.coreRadius || this.config.coreRadius || 40;

    // Damage cooldown map to prevent frame-rate crushing
    this.damageCooldowns = new Map();
  }

  canDamage(entity, interval = 0.25) {
    if (!entity) return false;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.damageCooldowns.has(entity)) {
      this.damageCooldowns.set(entity, now);
      return true;
    }
    const last = this.damageCooldowns.get(entity);
    if (now - last >= interval * 1000) {
      this.damageCooldowns.set(entity, now);
      return true;
    }
    return false;
  }

  update(dt, player = null, enemies = null, weapons = null, drops = null, particleSystem = null, camera = null, soundEngine = null) {
    if (!this.active) return;
    this.tickTimer += dt;

    switch (this.type) {
      case 'acid_pool': {
        // Acid bubble particles
        if (particleSystem && this.tickTimer > 0.18) {
          this.tickTimer = 0;
          if (particleSystem.emitAcidBubbles) {
            particleSystem.emitAcidBubbles(this.x, this.y, this.radius * 0.8, this.config.color, 2);
          }
        }

        // Check Player
        if (player) {
          const dist = Math.hypot(player.x - this.x, player.y - this.y);
          if (dist < this.radius + (player.radius || 16)) {
            // Apply slow
            player.speedMultiplier = Math.min(player.speedMultiplier !== undefined ? player.speedMultiplier : 1.0, this.config.slowFactor || 0.65);
            // Apply DoT
            if (this.canDamage(player, 0.25)) {
              if (!player.isDashing) {
                const dmg = Math.max(1, Math.round((this.config.dps || 18) * 0.25));
                if (player.takeDamage) player.takeDamage(dmg);
                if (particleSystem && particleSystem.addFloatingText) {
                  particleSystem.addFloatingText(player.x, player.y - 15, `-${dmg} ACID`, '#34d399');
                }
              }
            }
          }
        }

        // Check Enemies
        if (enemies && Array.isArray(enemies)) {
          const maxD = this.radius + 20;
          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (Math.abs(e.x - this.x) > maxD || Math.abs(e.y - this.y) > maxD) continue;
            const dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.radius + (e.radius || 15)) {
              if (e.speed !== undefined) {
                e.speed = (e.baseSpeed || e.speed) * (this.config.slowFactor || 0.65);
              }
              if (this.canDamage(e, 0.25)) {
                const dmg = Math.max(1, Math.round((this.config.dps || 18) * 1.5 * 0.25));
                if (e.takeDamage) e.takeDamage(dmg);
              }
            }
          }
        }
        break;
      }

      case 'emp_conduit': {
        this.timer += dt;
        if (this.state === 'cooldown') {
          if (this.timer >= (this.config.cooldownDuration || 2.0)) {
            this.state = 'charging';
            this.timer = 0;
          }
        } else if (this.state === 'charging') {
          if (particleSystem && Math.random() < 0.2 && particleSystem.emitSparks) {
            particleSystem.emitSparks(this.x, this.y, '#00f0ff', 2, 80);
            particleSystem.emitSparks(this.x2, this.y2, '#00f0ff', 2, 80);
          }
          if (this.timer >= (this.config.chargeDuration || 1.4)) {
            this.state = 'active';
            this.timer = 0;
            if (camera && camera.addTrauma) camera.addTrauma(0.2);
          }
        } else if (this.state === 'active') {
          const checkShock = (entity, isPlayer = false) => {
            const minX = Math.min(this.x, this.x2) - 30;
            const maxX = Math.max(this.x, this.x2) + 30;
            const minY = Math.min(this.y, this.y2) - 30;
            const maxY = Math.max(this.y, this.y2) + 30;
            if (entity.x < minX || entity.x > maxX || entity.y < minY || entity.y > maxY) return;

            const d = distToSegment(entity.x, entity.y, this.x, this.y, this.x2, this.y2);
            if (d < 22 + (entity.radius || 15)) {
              if (this.canDamage(entity, 0.3)) {
                if (isPlayer) {
                  if (!entity.isDashing) {
                    const dmg = this.config.damage || 32;
                    if (entity.takeDamage) entity.takeDamage(dmg);
                    if (camera && camera.addTrauma) camera.addTrauma(0.35);
                    if (particleSystem) {
                      if (particleSystem.emitSparks) particleSystem.emitSparks(entity.x, entity.y, '#00f0ff', 12, 220);
                      if (particleSystem.addFloatingText) particleSystem.addFloatingText(entity.x, entity.y - 15, `-${dmg} SHOCK!`, '#00f0ff', true);
                    }
                  }
                } else {
                  const dmg = Math.round((this.config.damage || 32) * 1.6);
                  if (entity.takeDamage) entity.takeDamage(dmg);
                  if (particleSystem && particleSystem.emitSparks) {
                    particleSystem.emitSparks(entity.x, entity.y, '#00f0ff', 8, 180);
                  }
                }
              }
            }
          };

          if (player) checkShock(player, true);
          if (enemies && Array.isArray(enemies)) {
            for (let i = 0; i < enemies.length; i++) {
              checkShock(enemies[i], false);
            }
          }

          if (this.timer >= (this.config.activeDuration || 0.85)) {
            this.state = 'cooldown';
            this.timer = 0;
          }
        }
        break;
      }

      case 'magma_vent': {
        this.timer += dt;
        if (this.state === 'dormant') {
          if (this.timer >= this.dormantDuration) {
            this.state = 'warning';
            this.timer = 0;
          }
        } else if (this.state === 'warning') {
          if (this.timer >= this.warningDuration) {
            this.state = 'erupting';
            this.timer = 0;
            if (camera && camera.addTrauma) camera.addTrauma(0.45);
            if (particleSystem) {
              if (particleSystem.emitFireEruption) {
                particleSystem.emitFireEruption(this.x, this.y, '#f97316', 22, 280);
              }
              if (particleSystem.addScorchMark) {
                particleSystem.addScorchMark(this.x, this.y, this.radius * 0.9, 'rgba(20, 6, 4, 0.85)');
              }
            }
          }
        } else if (this.state === 'erupting') {
          if (particleSystem && Math.random() < 0.4 && particleSystem.emitFireEruption) {
            particleSystem.emitFireEruption(this.x, this.y, '#f97316', 6, 200);
          }

          // Damage entities inside magma vent
          if (player) {
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < this.radius + (player.radius || 16)) {
              if (this.canDamage(player, 0.3) && !player.isDashing) {
                const dmg = this.config.damage || 48;
                if (player.takeDamage) player.takeDamage(dmg);
                if (camera && camera.addTrauma) camera.addTrauma(0.4);
                if (particleSystem && particleSystem.addFloatingText) {
                  particleSystem.addFloatingText(player.x, player.y - 15, `-${dmg} MAGMA!`, '#ff4400', true);
                }
              }
            }
          }

          if (enemies && Array.isArray(enemies)) {
            const maxD = this.radius + 20;
            for (let i = 0; i < enemies.length; i++) {
              const e = enemies[i];
              if (Math.abs(e.x - this.x) > maxD || Math.abs(e.y - this.y) > maxD) continue;
              const dist = Math.hypot(e.x - this.x, e.y - this.y);
              if (dist < this.radius + (e.radius || 15)) {
                if (this.canDamage(e, 0.3)) {
                  const dmg = Math.round((this.config.damage || 48) * 1.8);
                  if (e.takeDamage) e.takeDamage(dmg);
                }
              }
            }
          }

          if (this.timer >= this.eruptDuration) {
            this.state = 'dormant';
            this.timer = 0;
          }
        }
        break;
      }

      case 'quantum_singularity': {
        this.angle = (this.angle || 0) + dt * 2.5;

        // Emit swirl particles
        if (particleSystem && this.tickTimer > 0.12) {
          this.tickTimer = 0;
          if (particleSystem.emitVortexSwirl) {
            particleSystem.emitVortexSwirl(this.x, this.y, this.pullRadius * 0.8, '#c084fc', 2);
          }
        }

        // Pull Player
        if (player) {
          const dx = this.x - player.x;
          const dy = this.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1 && dist < this.pullRadius) {
            const pull = Math.min(220, (this.pullForce * 160) / Math.max(40, dist)) * dt;
            player.x += (dx / dist) * pull;
            player.y += (dy / dist) * pull;

            if (dist < this.coreRadius + (player.radius || 16)) {
              if (this.canDamage(player, 0.25) && !player.isDashing) {
                const dmg = Math.max(1, Math.round((this.config.dps || 28) * 0.25));
                if (player.takeDamage) player.takeDamage(dmg);
                if (particleSystem && particleSystem.addFloatingText) {
                  particleSystem.addFloatingText(player.x, player.y - 15, `-${dmg} VOID`, '#c084fc');
                }
              }
            }
          }
        }

        // Pull Enemies
        if (enemies && Array.isArray(enemies)) {
          const maxPullD = this.pullRadius + 20;
          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const dx = this.x - e.x;
            const dy = this.y - e.y;
            if (Math.abs(dx) > maxPullD || Math.abs(dy) > maxPullD) continue;
            const dist = Math.hypot(dx, dy);
            if (dist > 1 && dist < this.pullRadius) {
              const pull = Math.min(260, (this.pullForce * 200) / Math.max(40, dist)) * dt;
              e.x += (dx / dist) * pull;
              e.y += (dy / dist) * pull;

              if (dist < this.coreRadius + (e.radius || 15)) {
                if (this.canDamage(e, 0.25)) {
                  const dmg = Math.max(1, Math.round((this.config.dps || 28) * 1.5 * 0.25));
                  if (e.takeDamage) e.takeDamage(dmg);
                }
              }
            }
          }
        }
        break;
      }

      case 'solar_laser': {
        this.angle = (this.angle || 0) + this.rotSpeed * dt;
        const lx = this.x + Math.cos(this.angle) * this.beamLength;
        const ly = this.y + Math.sin(this.angle) * this.beamLength;

        // Check Player
        if (player) {
          const d = distToSegment(player.x, player.y, this.x, this.y, lx, ly);
          if (d < (this.beamWidth || 8) + (player.radius || 16)) {
            if (this.canDamage(player, 0.25) && !player.isDashing) {
              const dmg = Math.max(1, Math.round((this.config.dps || 45) * 0.25));
              if (player.takeDamage) player.takeDamage(dmg);
              if (camera && camera.addTrauma) camera.addTrauma(0.2);
              if (particleSystem && particleSystem.emitSparks) {
                particleSystem.emitSparks(player.x, player.y, '#facc15', 6, 160);
              }
            }
          }
        }

        // Check Enemies
        if (enemies && Array.isArray(enemies)) {
          const maxBeamD = this.beamLength + 20;
          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (Math.abs(e.x - this.x) > maxBeamD || Math.abs(e.y - this.y) > maxBeamD) continue;
            const d = distToSegment(e.x, e.y, this.x, this.y, lx, ly);
            if (d < (this.beamWidth || 8) + (e.radius || 15)) {
              if (this.canDamage(e, 0.25)) {
                const dmg = Math.max(1, Math.round((this.config.dps || 45) * 1.6 * 0.25));
                if (e.takeDamage) e.takeDamage(dmg);
                if (particleSystem && particleSystem.emitSparks) {
                  particleSystem.emitSparks(e.x, e.y, '#facc15', 4, 140);
                }
              }
            }
          }
        }
        break;
      }
    }
  }

  getDynamicLight() {
    if (!this.active) return null;
    switch (this.type) {
      case 'acid_pool':
        return { x: this.x, y: this.y, radius: this.radius * 1.5, color: this.config.glowColor || 'rgba(52, 211, 153, 0.35)' };
      case 'emp_conduit':
        if (this.state === 'active') {
          return { x: (this.x + this.x2) / 2, y: (this.y + this.y2) / 2, radius: 150, color: 'rgba(0, 240, 255, 0.6)' };
        } else if (this.state === 'charging') {
          return { x: (this.x + this.x2) / 2, y: (this.y + this.y2) / 2, radius: 70, color: 'rgba(0, 240, 255, 0.25)' };
        }
        return null;
      case 'magma_vent':
        if (this.state === 'erupting') {
          return { x: this.x, y: this.y, radius: this.radius * 2.2, color: 'rgba(249, 115, 22, 0.7)' };
        } else if (this.state === 'warning') {
          return { x: this.x, y: this.y, radius: this.radius * 1.2, color: 'rgba(249, 115, 22, 0.35)' };
        }
        return { x: this.x, y: this.y, radius: this.radius * 0.6, color: 'rgba(249, 115, 22, 0.15)' };
      case 'quantum_singularity':
        return { x: this.x, y: this.y, radius: 180, color: 'rgba(192, 132, 252, 0.5)' };
      case 'solar_laser': {
        const midX = this.x + Math.cos(this.angle) * (this.beamLength * 0.5);
        const midY = this.y + Math.sin(this.angle) * (this.beamLength * 0.5);
        return { x: midX, y: midY, radius: 150, color: 'rgba(250, 204, 21, 0.5)' };
      }
      default:
        return null;
    }
  }

  render(ctx, bounds, circuitPulse = 0) {
    if (!this.active || !ctx) return;

    if (bounds) {
      const maxExtent = Math.max(this.radius, this.beamLength || 0, this.pullRadius || 0, 200);
      if (
        this.x + maxExtent < bounds.minX ||
        this.x - maxExtent > bounds.maxX ||
        this.y + maxExtent < bounds.minY ||
        this.y - maxExtent > bounds.maxY
      ) {
        return;
      }
    }

    ctx.save();

    switch (this.type) {
      case 'acid_pool': {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.beginPath();
        const spikes = 14;
        for (let i = 0; i <= spikes; i++) {
          const a = (i / spikes) * Math.PI * 2;
          const r = this.radius * (0.92 + Math.sin(a * 4 + circuitPulse * 2.5) * 0.08);
          const px = this.x + Math.cos(a) * r;
          const py = this.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(5, 40, 20, 0.75)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'emp_conduit': {
        const renderPylon = (px, py) => {
          ctx.fillStyle = '#0a0e1c';
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, this.pylonRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const isBlink = Math.sin(circuitPulse * 6) > 0;
          ctx.fillStyle = this.state === 'active' ? '#ffffff' : (isBlink ? '#00f0ff' : '#0369a1');
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        };

        renderPylon(this.x, this.y);
        renderPylon(this.x2, this.y2);

        if (this.state === 'charging') {
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
          ctx.lineWidth = 1.5;
          if (ctx.setLineDash) ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x2, this.y2);
          ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);
        } else if (this.state === 'active') {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          const segs = 4;
          const dx = (this.x2 - this.x) / segs;
          const dy = (this.y2 - this.y) / segs;
          for (let i = 1; i < segs; i++) {
            const shift = (Math.sin(circuitPulse * 15 + i * 3) * 14);
            ctx.lineTo(this.x + dx * i - dy * (shift / 100), this.y + dy * i + dx * (shift / 100));
          }
          ctx.lineTo(this.x2, this.y2);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x2, this.y2);
          ctx.stroke();
        }
        break;
      }

      case 'magma_vent': {
        ctx.fillStyle = '#1c0a0c';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (this.state === 'warning') {
          const prog = this.timer / this.warningDuration;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * prog, 0, Math.PI * 2);
          ctx.stroke();
        } else if (this.state === 'erupting') {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const glow = (Math.sin(circuitPulse * 3) + 1) * 0.5;
          ctx.fillStyle = `rgba(249, 115, 22, ${0.15 + glow * 0.25})`;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'quantum_singularity': {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle || 0);

        ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.pullRadius * 0.8, 0, Math.PI * 1.5);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.coreRadius * 1.6, 0, Math.PI * 1.7);
        ctx.stroke();

        ctx.fillStyle = '#06020c';
        ctx.beginPath();
        ctx.arc(0, 0, this.coreRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
        break;
      }

      case 'solar_laser': {
        ctx.fillStyle = '#1c1705';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const lx = this.x + Math.cos(this.angle) * this.beamLength;
        const ly = this.y + Math.sin(this.angle) * this.beamLength;

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.lineWidth = (this.beamWidth || 8) * 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = this.beamWidth || 8;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }
}

export class ArenaHazardSystem {
  constructor(worldWidth = 3200, worldHeight = 3200, isInfinite = false) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.isInfinite = isInfinite;
    this.hazards = [];
  }

  clear() {
    this.hazards.length = 0;
  }

  spawnHazard(type, x, y, options = {}) {
    const hazard = new ArenaHazard(Object.assign({ type, x, y }, options));
    this.hazards.push(hazard);
    return hazard;
  }

  onBiomeChanged(biomeId) {
    this.initBiomeHazards(biomeId);
  }

  initBiomeHazards(biomeId = 'neon_core') {
    this.clear();
    if (this.isInfinite) return;

    const templates = vfxConfig.getBiomeSpawns(biomeId);
    if (templates && templates.length > 0) {
      const centerX = this.worldWidth / 2;
      const centerY = this.worldHeight / 2;

      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        const hx = centerX + (t.offsetX || 0);
        const hy = centerY + (t.offsetY || 0);
        const opts = Object.assign({}, t);
        if (t.x2Offset !== undefined && t.y2Offset !== undefined) {
          opts.x2 = centerX + t.x2Offset;
          opts.y2 = centerY + t.y2Offset;
        }
        this.spawnHazard(t.type, hx, hy, opts);
      }
      return;
    }

    // Fallback default
    this.spawnHazard('emp_conduit', this.worldWidth / 2 - 200, this.worldHeight / 2 - 250, { x2: this.worldWidth / 2 + 200, y2: this.worldHeight / 2 - 250 });
  }

  update(dt, player = null, enemies = null, weapons = null, drops = null, particleSystem = null, camera = null, soundEngine = null) {
    for (let i = 0; i < this.hazards.length; i++) {
      this.hazards[i].update(dt, player, enemies, weapons, drops, particleSystem, camera, soundEngine);
    }
  }

  render(ctx, bounds, circuitPulse = 0) {
    for (let i = 0; i < this.hazards.length; i++) {
      this.hazards[i].render(ctx, bounds, circuitPulse);
    }
  }

  getLights(bounds) {
    const lights = [];
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (bounds) {
        if (
          h.x + 350 < bounds.minX ||
          h.x - 350 > bounds.maxX ||
          h.y + 350 < bounds.minY ||
          h.y - 350 > bounds.maxY
        ) {
          continue;
        }
      }
      const l = h.getDynamicLight();
      if (l) lights.push(l);
    }
    return lights;
  }
}

export const MAP_BIOMES = [
  {
    id: 'neon_core',
    name: 'SECTOR 01: NEON CORE',
    subTitle: 'Downtown Central Network // Grid Alpha',
    bgColor: '#030614',
    gridColor: 'rgba(0, 240, 255, 0.08)',
    crosshairColor: 'rgba(0, 240, 255, 0.25)',
    circuitColor: 'rgba(255, 0, 110, 0.16)',
    sectorTextColor: 'rgba(0, 240, 255, 0.18)',
    obstacleBorder: '#00f0ff',
    obstacleDropShadow: '#00f0ff',
    ledColors: ['#05ffa1', '#ff0055'],
    hazardStripe: 'rgba(0, 240, 255, 0.4)',
    circuitDash: [12, 18],
    ambientLight: 'rgba(0, 240, 255, 0.22)',
    accentColor: '#00f0ff',
    floorPattern: 'tech_cross',
  },
  {
    id: 'acid_matrix',
    name: 'SECTOR 02: ACID MATRIX',
    subTitle: 'Bio-Tech Slums // Toxic Neural Conduit',
    bgColor: '#021209',
    gridColor: 'rgba(16, 185, 129, 0.09)',
    crosshairColor: 'rgba(52, 211, 153, 0.3)',
    circuitColor: 'rgba(163, 230, 53, 0.22)',
    sectorTextColor: 'rgba(52, 211, 153, 0.2)',
    obstacleBorder: '#10b981',
    obstacleDropShadow: '#10b981',
    ledColors: ['#34d399', '#a3e635'],
    hazardStripe: 'rgba(163, 230, 53, 0.5)',
    circuitDash: [8, 14],
    ambientLight: 'rgba(16, 185, 129, 0.22)',
    accentColor: '#10b981',
    floorPattern: 'bio_hex',
  },
  {
    id: 'crimson_foundry',
    name: 'SECTOR 03: CRIMSON FOUNDRY',
    subTitle: 'Heavy Megacorp Smelter // Magma Core',
    bgColor: '#140407',
    gridColor: 'rgba(244, 63, 94, 0.1)',
    crosshairColor: 'rgba(251, 113, 133, 0.32)',
    circuitColor: 'rgba(245, 158, 11, 0.24)',
    sectorTextColor: 'rgba(244, 63, 94, 0.22)',
    obstacleBorder: '#f43f5e',
    obstacleDropShadow: '#f43f5e',
    ledColors: ['#f59e0b', '#ef4444'],
    hazardStripe: 'rgba(245, 158, 11, 0.6)',
    circuitDash: [16, 20],
    ambientLight: 'rgba(244, 63, 94, 0.22)',
    accentColor: '#f43f5e',
    floorPattern: 'hazard_bars',
  },
  {
    id: 'quantum_void',
    name: 'SECTOR 04: QUANTUM VOID',
    subTitle: 'Abyssal Neural Nexus // Sub-Space Warp',
    bgColor: '#0c031a',
    gridColor: 'rgba(168, 85, 247, 0.1)',
    crosshairColor: 'rgba(192, 132, 252, 0.35)',
    circuitColor: 'rgba(236, 72, 153, 0.24)',
    sectorTextColor: 'rgba(192, 132, 252, 0.22)',
    obstacleBorder: '#a855f7',
    obstacleDropShadow: '#a855f7',
    ledColors: ['#c084fc', '#f43f5e'],
    hazardStripe: 'rgba(236, 72, 153, 0.5)',
    circuitDash: [6, 10, 18, 10],
    ambientLight: 'rgba(168, 85, 247, 0.22)',
    accentColor: '#a855f7',
    floorPattern: 'quantum_ring',
  },
  {
    id: 'solar_archology',
    name: 'SECTOR 05: SOLAR ARCHOLOGY',
    subTitle: 'Orbital Spire // Radiant Topaz Solar Array',
    bgColor: '#130d02',
    gridColor: 'rgba(234, 179, 8, 0.1)',
    crosshairColor: 'rgba(250, 204, 21, 0.35)',
    circuitColor: 'rgba(249, 115, 22, 0.25)',
    sectorTextColor: 'rgba(250, 204, 21, 0.22)',
    obstacleBorder: '#eab308',
    obstacleDropShadow: '#eab308',
    ledColors: ['#facc15', '#f97316'],
    hazardStripe: 'rgba(250, 204, 21, 0.6)',
    circuitDash: [20, 15],
    ambientLight: 'rgba(234, 179, 8, 0.22)',
    accentColor: '#eab308',
    floorPattern: 'solar_diamonds',
  },
  {
    id: 'glitch_overclock',
    name: 'SECTOR 06: GLITCH REDLINE',
    subTitle: 'Corrupted Mainframe // Overclock Singularity',
    bgColor: '#160205',
    gridColor: 'rgba(255, 0, 55, 0.14)',
    crosshairColor: 'rgba(255, 255, 255, 0.4)',
    circuitColor: 'rgba(255, 0, 85, 0.3)',
    sectorTextColor: 'rgba(255, 80, 110, 0.28)',
    obstacleBorder: '#ff0037',
    obstacleDropShadow: '#ff0037',
    ledColors: ['#ffffff', '#ff0055'],
    hazardStripe: 'rgba(255, 255, 255, 0.6)',
    circuitDash: [4, 8],
    ambientLight: 'rgba(255, 0, 55, 0.25)',
    accentColor: '#ff0037',
    floorPattern: 'glitch_data',
  },
];

export class LightingEngine {
  constructor(worldWidth = Infinity, worldHeight = Infinity) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.isInfinite = !Number.isFinite(worldWidth) || !Number.isFinite(worldHeight);
    this.gridSpacing = 90;
    this.obstacles = [];
    this.circuitPulse = 0;

    // Dynamic Map Biome & Transition Engine
    this.currentBiomeIndex = 0;
    this.previousBiomeIndex = 0;
    this.transitionProgress = 1.0; // 1.0 means fully transitioned
    this.transitionDuration = 1.25; // seconds
    this.scanlineY = 0;

    // Arena Hazards Engine (Module 3)
    this.hazardSystem = new ArenaHazardSystem(this.worldWidth, this.worldHeight, this.isInfinite);

    if (!this.isInfinite) {
      this.initObstacles();
      this.hazardSystem.initBiomeHazards(this.getCurrentBiome().id);
    }
  }

  getCurrentBiome() {
    return MAP_BIOMES[this.currentBiomeIndex % MAP_BIOMES.length];
  }

  getPreviousBiome() {
    return MAP_BIOMES[this.previousBiomeIndex % MAP_BIOMES.length];
  }

  /**
   * Set map biome directly by index with smooth transition
   */
  setBiomeByIndex(targetIndex, forceImmediate = false) {
    const sanitizedIndex = Math.max(0, targetIndex) % MAP_BIOMES.length;
    if (sanitizedIndex === this.currentBiomeIndex && !forceImmediate) {
      return null;
    }

    this.previousBiomeIndex = this.currentBiomeIndex;
    this.currentBiomeIndex = sanitizedIndex;

    if (forceImmediate) {
      this.transitionProgress = 1.0;
    } else {
      this.transitionProgress = 0.0;
      this.scanlineY = 0;
    }

    if (this.hazardSystem) {
      this.hazardSystem.onBiomeChanged(this.getCurrentBiome().id);
    }

    return this.getCurrentBiome();
  }

  /**
   * Automatically updates map biome based on player level and/or wave progression
   * Returns newly switched biome object if a transition was initiated, otherwise null.
   */
  setProgression(level = 1, wave = 1) {
    const progressionScore = Math.max(0, (level - 1) + (wave - 1));
    const targetIndex = progressionScore % MAP_BIOMES.length;
    if (targetIndex !== this.currentBiomeIndex) {
      return this.setBiomeByIndex(targetIndex, false);
    }
    return null;
  }

  update(dt = 0.016, player = null, enemies = null, weapons = null, drops = null, particleSystem = null, camera = null, soundEngine = null) {
    this.circuitPulse += dt * 1.5;

    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + dt / this.transitionDuration);
      this.scanlineY += dt * 1800;
    }

    if (this.hazardSystem) {
      this.hazardSystem.update(dt, player, enemies, weapons, drops, particleSystem, camera, soundEngine);
    }
  }

  renderHazards(ctx, bounds) {
    if (this.hazardSystem) {
      this.hazardSystem.render(ctx, bounds, this.circuitPulse);
    }
  }

  getHazardLights(bounds) {
    return this.hazardSystem ? this.hazardSystem.getLights(bounds) : [];
  }

  initObstacles() {
    // Generate scattered neon server stacks and defense pylons for finite bounds
    const padding = 220;
    for (let x = padding; x < this.worldWidth - padding; x += 480) {
      for (let y = padding; y < this.worldHeight - padding; y += 480) {
        if (Math.abs(x - this.worldWidth / 2) > 220 || Math.abs(y - this.worldHeight / 2) > 220) {
          this.obstacles.push({
            x: x + (Math.sin(x * y) * 90),
            y: y + (Math.cos(x + y) * 90),
            w: 52,
            h: 52,
            type: (x + y) % 2 === 0 ? 'server' : 'relay',
            ledSeed: Math.random() * 100,
          });
        }
      }
    }
  }

  renderBackgroundGrid(ctx, camera) {
    ctx.save();

    const bounds = camera && camera.getVisibleBounds
      ? camera.getVisibleBounds(140)
      : {
          minX: camera.x - camera.viewportWidth / 2 - 140,
          maxX: camera.x + camera.viewportWidth / 2 + 140,
          minY: camera.y - camera.viewportHeight / 2 - 140,
          maxY: camera.y + camera.viewportHeight / 2 + 140,
        };

    const camLeft = (!this.isInfinite && Number.isFinite(this.worldWidth)) ? Math.max(0, bounds.minX) : bounds.minX;
    const camRight = (!this.isInfinite && Number.isFinite(this.worldWidth)) ? Math.min(this.worldWidth, bounds.maxX) : bounds.maxX;
    const camTop = (!this.isInfinite && Number.isFinite(this.worldHeight)) ? Math.max(0, bounds.minY) : bounds.minY;
    const camBottom = (!this.isInfinite && Number.isFinite(this.worldHeight)) ? Math.min(this.worldHeight, bounds.maxY) : bounds.maxY;

    const currentBiome = this.getCurrentBiome();
    const prevBiome = this.getPreviousBiome();
    const inTransition = this.transitionProgress < 1.0;

    // 1. Cyberpunk Map Base Floor
    if (inTransition) {
      // Draw previous biome background
      ctx.fillStyle = prevBiome.bgColor;
      ctx.fillRect(camLeft, camTop, camRight - camLeft, camBottom - camTop);

      // Blend current biome background over top with alpha
      ctx.save();
      ctx.globalAlpha = this.transitionProgress;
      ctx.fillStyle = currentBiome.bgColor;
      ctx.fillRect(camLeft, camTop, camRight - camLeft, camBottom - camTop);
      ctx.restore();
    } else {
      ctx.fillStyle = currentBiome.bgColor;
      ctx.fillRect(camLeft, camTop, camRight - camLeft, camBottom - camTop);
    }

    // 2. High-Tech Grid with Technical Coordinate Crosshairs (+)
    const startX = Math.floor(camLeft / this.gridSpacing) * this.gridSpacing;
    const endX = Math.ceil(camRight / this.gridSpacing) * this.gridSpacing;
    const startY = Math.floor(camTop / this.gridSpacing) * this.gridSpacing;
    const endY = Math.ceil(camBottom / this.gridSpacing) * this.gridSpacing;

    // Subtle Grid Lines
    ctx.strokeStyle = currentBiome.gridColor;
    ctx.lineWidth = 1;
    if (ctx.beginPath) ctx.beginPath();
    for (let x = startX; x <= endX; x += this.gridSpacing) {
      if (ctx.moveTo) ctx.moveTo(x, camTop);
      if (ctx.lineTo) ctx.lineTo(x, camBottom);
    }
    for (let y = startY; y <= endY; y += this.gridSpacing) {
      if (ctx.moveTo) ctx.moveTo(camLeft, y);
      if (ctx.lineTo) ctx.lineTo(camRight, y);
    }
    if (ctx.stroke) ctx.stroke();

    // Floor Decorative Patterns per Biome
    this.renderFloorPatterns(ctx, currentBiome, startX, endX, startY, endY);

    // Technical Crosshair Markers at Grid Junctions (+)
    ctx.strokeStyle = currentBiome.crosshairColor;
    ctx.lineWidth = 1;
    if (ctx.beginPath) ctx.beginPath();
    const crossSize = 4;
    for (let x = startX; x <= endX; x += this.gridSpacing) {
      for (let y = startY; y <= endY; y += this.gridSpacing) {
        if (ctx.moveTo) {
          ctx.moveTo(x - crossSize, y);
          if (ctx.lineTo) ctx.lineTo(x + crossSize, y);
          ctx.moveTo(x, y - crossSize);
          if (ctx.lineTo) ctx.lineTo(x, y + crossSize);
        }
      }
    }
    if (ctx.stroke) ctx.stroke();

    // Technical Sector Coordinates printed on the arena floor every 900px
    ctx.fillStyle = currentBiome.sectorTextColor;
    ctx.font = '9px "JetBrains Mono", "Orbitron", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const sectorSpacing = this.gridSpacing * 10;
    const sStartX = Math.floor(camLeft / sectorSpacing) * sectorSpacing;
    const sEndX = Math.ceil(camRight / sectorSpacing) * sectorSpacing;
    const sStartY = Math.floor(camTop / sectorSpacing) * sectorSpacing;
    const sEndY = Math.ceil(camBottom / sectorSpacing) * sectorSpacing;
    for (let sx = sStartX; sx <= sEndX; sx += sectorSpacing) {
      for (let sy = sStartY; sy <= sEndY; sy += sectorSpacing) {
        const secX = Math.round(sx / sectorSpacing);
        const secY = Math.round(sy / sectorSpacing);
        ctx.fillText(`[${currentBiome.name.slice(0, 9)} // ${secX >= 0 ? '+' : ''}${secX},${secY >= 0 ? '+' : ''}${secY}]`, sx + 8, sy + 8);
      }
    }

    // 3. Glowing Cybernetic Circuit Pathways running through the arena floor
    ctx.strokeStyle = currentBiome.circuitColor;
    ctx.lineWidth = 1.5;
    if (ctx.setLineDash) ctx.setLineDash(currentBiome.circuitDash || [12, 18]);
    ctx.lineDashOffset = -this.circuitPulse * 15;
    if (ctx.beginPath) ctx.beginPath();
    for (let x = startX; x <= endX; x += this.gridSpacing * 3) {
      if (ctx.moveTo) ctx.moveTo(x, camTop);
      if (ctx.lineTo) ctx.lineTo(x, camBottom);
    }
    if (ctx.stroke) ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]); // reset dash

    // 4. Render Obstacles
    const renderObstacle = (obs) => {
      // Drop shadow around pillar
      ctx.shadowColor = currentBiome.obstacleDropShadow || currentBiome.accentColor;
      ctx.shadowBlur = 10;

      // Heavy Gunmetal Housing
      ctx.fillStyle = '#0a0e1c';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      ctx.strokeStyle = obs.type === 'beacon' ? '#ffd700' : currentBiome.obstacleBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.shadowBlur = 0;

      // Server Rack Server Blades
      const bladeH = 7;
      const leds = currentBiome.ledColors || ['#05ffa1', '#ff0055'];
      for (let b = 0; b < 4; b++) {
        const by = obs.y + 6 + b * 11;
        ctx.fillStyle = '#111827';
        ctx.fillRect(obs.x + 6, by, obs.w - 12, bladeH);

        // Blinking Status LEDs
        const isBlinking = Math.sin(this.circuitPulse * 4 + (obs.ledSeed || 1) + b) > 0;
        ctx.fillStyle = isBlinking ? (b % 2 === 0 ? leds[0] : leds[1]) : '#1e293b';
        ctx.fillRect(obs.x + obs.w - 14, by + 2, 4, 3);
      }

      // Tech Hazard Stripe on top and bottom edges
      ctx.fillStyle = currentBiome.hazardStripe || 'rgba(255, 230, 0, 0.4)';
      ctx.fillRect(obs.x + 2, obs.y + 2, obs.w - 4, 2);
      ctx.fillRect(obs.x + 2, obs.y + obs.h - 4, obs.w - 4, 2);
    };

    // Render finite obstacles if defined
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (
        obs.x + obs.w >= camLeft &&
        obs.x <= camRight &&
        obs.y + obs.h >= camTop &&
        obs.y <= camBottom
      ) {
        renderObstacle(obs);
      }
    }

    // Render Procedural Chunks for Infinite Map
    if (this.isInfinite) {
      const chunkSize = 480;
      const minCx = Math.floor(camLeft / chunkSize);
      const maxCx = Math.ceil(camRight / chunkSize);
      const minCy = Math.floor(camTop / chunkSize);
      const maxCy = Math.ceil(camBottom / chunkSize);

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) continue;

          const roll = hash2D(cx, cy);
          if (roll > 0.64) {
            const obsX = cx * chunkSize + 60 + Math.floor((roll * 1000) % (chunkSize - 150));
            const obsY = cy * chunkSize + 60 + Math.floor((roll * 2400) % (chunkSize - 150));
            if (
              obsX + 52 >= camLeft &&
              obsX <= camRight &&
              obsY + 52 >= camTop &&
              obsY <= camBottom
            ) {
              renderObstacle({
                x: obsX,
                y: obsY,
                w: 52,
                h: 52,
                type: roll > 0.85 ? 'beacon' : ((cx + cy) % 2 === 0 ? 'server' : 'relay'),
                ledSeed: roll * 100,
              });
            }
          }
        }
      }
    }

    // 5. Visual Holographic Reconfiguration Sweep during Biome Transition
    if (inTransition) {
      this.renderTransitionSweep(ctx, camLeft, camRight, camTop, camBottom, currentBiome);
    }

    ctx.restore();
  }

  renderFloorPatterns(ctx, biome, startX, endX, startY, endY) {
    const pattern = biome.floorPattern || 'tech_cross';
    ctx.save();

    if (pattern === 'bio_hex') {
      // Hexagonal bio nodes at alternating grid points
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.16)';
      ctx.lineWidth = 1;
      for (let x = startX; x <= endX; x += this.gridSpacing * 2) {
        for (let y = startY; y <= endY; y += this.gridSpacing * 2) {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const hx = x + Math.cos(angle) * 14;
            const hy = y + Math.sin(angle) * 14;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else if (pattern === 'hazard_bars') {
      // Diagonal industrial warning hashes
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.lineWidth = 1.5;
      for (let x = startX; x <= endX; x += this.gridSpacing * 3) {
        for (let y = startY; y <= endY; y += this.gridSpacing * 3) {
          ctx.beginPath();
          ctx.moveTo(x - 12, y - 12);
          ctx.lineTo(x + 12, y + 12);
          ctx.moveTo(x + 12, y - 12);
          ctx.lineTo(x - 12, y + 12);
          ctx.stroke();
        }
      }
    } else if (pattern === 'quantum_ring') {
      // Concentric subatomic pulse rings
      const pulseR = 10 + Math.sin(this.circuitPulse * 3) * 4;
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.18)';
      ctx.lineWidth = 1;
      for (let x = startX; x <= endX; x += this.gridSpacing * 3) {
        for (let y = startY; y <= endY; y += this.gridSpacing * 3) {
          ctx.beginPath();
          ctx.arc(x, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (pattern === 'solar_diamonds') {
      // Solar rhombic photovoltaic tiles
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.lineWidth = 1;
      for (let x = startX; x <= endX; x += this.gridSpacing * 2) {
        for (let y = startY; y <= endY; y += this.gridSpacing * 2) {
          ctx.beginPath();
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x + 12, y);
          ctx.moveTo(x + 12, y);
          ctx.lineTo(x, y + 12);
          ctx.moveTo(x, y + 12);
          ctx.lineTo(x - 12, y);
          ctx.moveTo(x - 12, y);
          ctx.lineTo(x, y - 12);
          ctx.stroke();
        }
      }
    } else if (pattern === 'glitch_data') {
      // High-frequency digital glitch hashes
      ctx.fillStyle = 'rgba(255, 0, 85, 0.18)';
      for (let x = startX; x <= endX; x += this.gridSpacing * 2) {
        for (let y = startY; y <= endY; y += this.gridSpacing * 2) {
          const shift = Math.sin(this.circuitPulse * 8 + x) * 6;
          ctx.fillRect(x + shift - 6, y - 1, 12, 2);
        }
      }
    }

    ctx.restore();
  }

  renderTransitionSweep(ctx, left, right, top, bottom, targetBiome) {
    ctx.save();
    const width = right - left;
    const height = bottom - top;
    const sweepProgress = this.transitionProgress; // 0 to 1
    const sweepY = top + height * sweepProgress;

    // Laser scanline sweeping across the battlefield
    const grad = ctx.createLinearGradient(left, sweepY - 40, left, sweepY + 40);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.5, targetBiome.accentColor || '#00f0ff');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.globalAlpha = (1 - sweepProgress) * 0.45;
    ctx.fillStyle = grad;
    ctx.fillRect(left, sweepY - 40, width, 80);

    // Glowing crisp center beam
    ctx.globalAlpha = (1 - sweepProgress) * 0.8;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, sweepY);
    ctx.lineTo(right, sweepY);
    ctx.stroke();

    ctx.restore();
  }

  renderDynamicLighting(ctx, lights) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const grad = ctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        light.radius
      );
      grad.addColorStop(0, light.color);
      grad.addColorStop(0.5, light.color.replace(/[\d\.]+\)$/, '0.15)'));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
