/**
 * High-performance Object-Pooled Particle & Floating Text System.
 */
export class ParticleSystem {
  constructor(maxParticles = 800) {
    this.maxParticles = maxParticles;
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.ghosts = [];
    this.shellCasings = [];
    this.scorchMarks = [];
    this.dustEmbers = [];
    this.telegraphs = [];

    // Object Pools for zero GC allocation during intense horde combat
    this.particlePool = [];
    this.floatingTextPool = [];
    this.shockwavePool = [];
    this.ghostPool = [];
    this.shellCasingPool = [];
    this.telegraphPool = [];

    this.initAmbientEmbers();
  }

  recycleParticle(p) {
    if (this.particlePool.length < this.maxParticles) {
      this.particlePool.push(p);
    }
  }

  recycleFloatingText(t) {
    if (this.floatingTextPool.length < 150) {
      this.floatingTextPool.push(t);
    }
  }

  recycleShockwave(s) {
    if (this.shockwavePool.length < 50) {
      this.shockwavePool.push(s);
    }
  }

  recycleGhost(g) {
    if (this.ghostPool.length < 50) {
      this.ghostPool.push(g);
    }
  }

  recycleShellCasing(c) {
    if (this.shellCasingPool.length < 100) {
      this.shellCasingPool.push(c);
    }
  }

  recycleTelegraph(t) {
    if (this.telegraphPool.length < 50) {
      this.telegraphPool.push(t);
    }
  }

  clear() {
    this.particles.length = 0;
    this.floatingTexts.length = 0;
    this.shockwaves.length = 0;
    this.ghosts.length = 0;
    this.shellCasings.length = 0;
    this.scorchMarks.length = 0;
    this.telegraphs.length = 0;
  }

  initAmbientEmbers(count = 60) {
    for (let i = 0; i < count; i++) {
      this.dustEmbers.push({
        x: (Math.random() - 0.5) * 3600,
        y: (Math.random() - 0.5) * 3600,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 20,
        speedY: -15 - Math.random() * 25,
        alpha: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.4 ? '#00f0ff' : '#ff007f',
      });
    }
  }

  addShellCasing(x, y, angle, speed = 160, color = '#ffd700') {
    if (this.shellCasings.length >= 70) {
      const oldest = this.shellCasings[0];
      const last = this.shellCasings.pop();
      if (this.shellCasings.length > 0) {
        this.shellCasings[0] = last;
      }
      this.recycleShellCasing(oldest);
    }
    // Eject perpendicular to firing angle with variance
    const ejectAngle = angle + (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1) + (Math.random() - 0.5) * 0.4;
    const spd = speed * (0.8 + Math.random() * 0.4);

    const c = this.shellCasingPool.pop() || {};
    c.x = x;
    c.y = y;
    c.vx = Math.cos(ejectAngle) * spd;
    c.vy = Math.sin(ejectAngle) * spd;
    c.angle = Math.random() * Math.PI * 2;
    c.vRot = (Math.random() - 0.5) * 18;
    c.color = color;
    c.life = 2.2;
    c.maxLife = 2.2;
    c.width = 4;
    c.height = 2;

    this.shellCasings.push(c);
  }

  addScorchMark(x, y, radius = 24, color = 'rgba(5, 7, 15, 0.75)') {
    if (this.scorchMarks.length > 90) {
      this.scorchMarks.shift();
    }
    this.scorchMarks.push({
      x,
      y,
      radius,
      color,
      life: 8.0,
      maxLife: 8.0,
      rotation: Math.random() * Math.PI * 2,
      spikes: 5 + Math.floor(Math.random() * 4),
    });
  }

  emitSparks(x, y, color = '#00ffff', count = 12, speed = 200) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        const oldest = this.particles[0];
        const last = this.particles.pop();
        if (this.particles.length > 0) {
          this.particles[0] = last;
        }
        this.recycleParticle(oldest);
      }

      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      const life = Math.random() * 0.3 + 0.2;

      const p = this.particlePool.pop() || {};
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color = color;
      p.size = Math.random() * 3 + 2;
      p.life = life;
      p.maxLife = life;

      this.particles.push(p);
    }
  }

  emitShockwave(x, y, color = '#ff007f', maxRadius = 120, duration = 0.4) {
    if (this.shockwaves.length >= 40) {
      const oldest = this.shockwaves[0];
      const last = this.shockwaves.pop();
      if (this.shockwaves.length > 0) {
        this.shockwaves[0] = last;
      }
      this.recycleShockwave(oldest);
    }
    const s = this.shockwavePool.pop() || {};
    s.x = x;
    s.y = y;
    s.radius = 5;
    s.maxRadius = maxRadius;
    s.color = color;
    s.life = duration;
    s.maxLife = duration;
    this.shockwaves.push(s);
  }

  /**
   * Emits floating toxic bubbles for Acid Pool hazard
   */
  emitAcidBubbles(x, y, radius = 50, color = '#34d399', count = 3) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        const oldest = this.particles[0];
        const last = this.particles.pop();
        if (this.particles.length > 0) {
          this.particles[0] = last;
        }
        this.recycleParticle(oldest);
      }
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const life = Math.random() * 0.4 + 0.3;

      const p = this.particlePool.pop() || {};
      p.x = x + Math.cos(ang) * r;
      p.y = y + Math.sin(ang) * r;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -Math.random() * 35 - 15;
      p.color = color;
      p.size = Math.random() * 3 + 2;
      p.life = life;
      p.maxLife = life;
      this.particles.push(p);
    }
  }

  /**
   * Emits high-velocity flame eruption for Magma Vent hazard
   */
  emitFireEruption(x, y, color = '#f97316', count = 16, speed = 240) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        const oldest = this.particles[0];
        const last = this.particles.pop();
        if (this.particles.length > 0) {
          this.particles[0] = last;
        }
        this.recycleParticle(oldest);
      }
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      const life = Math.random() * 0.45 + 0.25;

      const p = this.particlePool.pop() || {};
      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y + (Math.random() - 0.5) * 16;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.color = Math.random() > 0.4 ? color : '#ff0055';
      p.size = Math.random() * 4 + 2;
      p.life = life;
      p.maxLife = life;
      this.particles.push(p);
    }
  }

  /**
   * Emits inward vortex swirl particles for Quantum Singularity hazard
   */
  emitVortexSwirl(x, y, radius = 100, color = '#c084fc', count = 4) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        const oldest = this.particles[0];
        const last = this.particles.pop();
        if (this.particles.length > 0) {
          this.particles[0] = last;
        }
        this.recycleParticle(oldest);
      }
      const ang = Math.random() * Math.PI * 2;
      const p = this.particlePool.pop() || {};
      p.x = x + Math.cos(ang) * radius;
      p.y = y + Math.sin(ang) * radius;
      p.vx = -Math.sin(ang) * 90 - Math.cos(ang) * 100;
      p.vy = Math.cos(ang) * 90 - Math.sin(ang) * 100;
      p.color = color;
      p.size = Math.random() * 3 + 1.5;
      p.life = 0.45;
      p.maxLife = 0.45;
      this.particles.push(p);
    }
  }

  /**
   * Renders high-voltage electric arc between two nodes with branching
   */
  emitLightningArc(ctx, x1, y1, x2, y2, color = '#00f0ff', branches = 2) {
    if (!ctx || !ctx.beginPath) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    if (ctx.shadowBlur !== undefined) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }

    const drawBolt = (sx, sy, ex, ey, depth) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const segs = 5;
      const dx = (ex - sx) / segs;
      const dy = (ey - sy) / segs;
      const nx = -dy;
      const ny = dx;

      for (let i = 1; i < segs; i++) {
        const offset = (Math.random() - 0.5) * 20;
        const px = sx + dx * i + nx * offset;
        const py = sy + dy * i + ny * offset;
        ctx.lineTo(px, py);

        if (depth > 0 && Math.random() < 0.35) {
          const branchEx = px + (Math.random() - 0.5) * 45;
          const branchEy = py + (Math.random() - 0.5) * 45;
          drawBolt(px, py, branchEx, branchEy, depth - 1);
        }
      }
      ctx.lineTo(ex, ey);
      ctx.stroke();
    };

    drawBolt(x1, y1, x2, y2, branches);

    // Inner bright core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.0;
    if (ctx.shadowBlur !== undefined) ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders intense focused laser beam with corona aura
   */
  emitLaserBeam(ctx, x1, y1, x2, y2, color = '#facc15', width = 6) {
    if (!ctx || !ctx.beginPath) return;
    ctx.save();
    // Outer corona glow
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 2.2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Main laser beam
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.85;
    ctx.stroke();

    // Center laser core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, width * 0.35);
    ctx.globalAlpha = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  addFloatingText(x, y, text, color = '#ffffff', isCrit = false) {
    if (this.floatingTexts.length >= 120) {
      const oldest = this.floatingTexts[0];
      const last = this.floatingTexts.pop();
      if (this.floatingTexts.length > 0) {
        this.floatingTexts[0] = last;
      }
      this.recycleFloatingText(oldest);
    }
    const t = this.floatingTextPool.pop() || {};
    t.x = x + (Math.random() * 20 - 10);
    t.y = y - 10;
    t.vy = isCrit ? -110 : -70;
    t.text = text;
    t.color = color;
    t.isCrit = isCrit;
    t.life = isCrit ? 0.9 : 0.65;
    t.maxLife = isCrit ? 0.9 : 0.65;
    t.scale = isCrit ? 1.6 : 1.0;
    this.floatingTexts.push(t);
  }

  addGhost(x, y, angle, radius, color = '#00ffff') {
    if (this.ghosts.length >= 45) {
      const oldest = this.ghosts[0];
      const last = this.ghosts.pop();
      if (this.ghosts.length > 0) {
        this.ghosts[0] = last;
      }
      this.recycleGhost(oldest);
    }
    const g = this.ghostPool.pop() || {};
    g.x = x;
    g.y = y;
    g.angle = angle;
    g.radius = radius;
    g.color = color;
    g.life = 0.3;
    g.maxLife = 0.3;
    this.ghosts.push(g);
  }

  addTelegraph(x, y, radius = 55, duration = 1.3, color = '#ff0055', options = {}) {
    if (this.telegraphs.length >= 40) {
      const oldest = this.telegraphs[0];
      const last = this.telegraphs.pop();
      if (this.telegraphs.length > 0) {
        this.telegraphs[0] = last;
      }
      this.recycleTelegraph(oldest);
    }
    const t = this.telegraphPool.pop() || {};
    t.x = x;
    t.y = y;
    t.radius = radius;
    t.life = duration;
    t.maxLife = duration;
    t.color = color;
    t.type = options.type || 'artillery';
    t.damage = options.damage || 35;
    t.onDetonate = options.onDetonate || null;
    t.rotation = 0;
    this.telegraphs.push(t);
    return t;
  }

  addDangerZone(x, y, radius = 75, duration = 1.8, options = {}) {
    const color = options.color || '#ff0055';
    return this.addTelegraph(x, y, radius, duration, color, options);
  }

  emitBossPhaseShockwave(x, y, phase = 2, color = '#ff0055') {
    // Multi-layered expanding shockwave
    this.emitShockwave(x, y, '#ffffff', 140, 0.35);
    this.emitShockwave(x, y, color, 240, 0.6);
    this.emitShockwave(x, y, phase === 3 ? '#ff0055' : '#00f0ff', 340, 0.85);

    // High velocity sparks
    this.emitSparks(x, y, color, 35, 340);
    this.emitSparks(x, y, '#ffffff', 15, 200);

    // Floating Arcade Warning Text
    const bannerText = phase === 3 ? '⚡ ENRAGED OVERCLOCK [PHASE 3] ⚡' : '⚠️ BARRAGE OVERDRIVE [PHASE 2] ⚠️';
    this.addFloatingText(x, y - 60, bannerText, color, true);
  }

  emitMutationEffect(x, y, color = '#d946ef') {
    // Bio-synthetic swirling shockwave & purple plasma burst
    this.emitShockwave(x, y, color, 160, 0.45);
    this.emitShockwave(x, y, '#ffffff', 80, 0.25);
    this.emitSparks(x, y, color, 24, 220);
    this.addFloatingText(x, y - 45, '⚡ GENETIC MUTATION! ⚡', color, true);
  }

  update(dt) {
    // 0. Update Danger Zone Telegraphs with visual Detonation & Object Pooling
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.life -= dt;
      t.rotation = (t.rotation || 0) + dt * 2.5;
      if (t.life <= 0) {
        // Detonate VFX
        this.emitShockwave(t.x, t.y, t.color, t.radius * 1.4, 0.45);
        this.emitSparks(t.x, t.y, t.color, 16, 260);
        this.addScorchMark(t.x, t.y, t.radius * 0.7, 'rgba(12, 4, 8, 0.85)');

        if (typeof t.onDetonate === 'function') {
          t.onDetonate(t);
        }

        this.recycleTelegraph(t);
        const last = this.telegraphs.pop();
        if (i < this.telegraphs.length) {
          this.telegraphs[i] = last;
        }
      }
    }

    // 1. Update Particles with O(1) swap-and-pop & pooling
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95; // drag
      p.vy *= 0.95;
      p.life -= dt;
      if (p.life <= 0) {
        this.recycleParticle(p);
        const last = this.particles.pop();
        if (i < this.particles.length) {
          this.particles[i] = last;
        }
      }
    }

    // 2. Update Shockwaves with O(1) swap-and-pop & pooling
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const progress = 1 - s.life / s.maxLife;
      s.radius = 5 + progress * (s.maxRadius - 5);
      if (s.life <= 0) {
        this.recycleShockwave(s);
        const last = this.shockwaves.pop();
        if (i < this.shockwaves.length) {
          this.shockwaves[i] = last;
        }
      }
    }

    // 3. Update Floating Texts with O(1) swap-and-pop & pooling
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) {
        this.recycleFloatingText(t);
        const last = this.floatingTexts.pop();
        if (i < this.floatingTexts.length) {
          this.floatingTexts[i] = last;
        }
      }
    }

    // 4. Update Ghost Afterimages with O(1) swap-and-pop & pooling
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      if (g.life <= 0) {
        this.recycleGhost(g);
        const last = this.ghosts.pop();
        if (i < this.ghosts.length) {
          this.ghosts[i] = last;
        }
      }
    }

    // 5. Update Shell Casings with O(1) swap-and-pop & pooling
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.88;
      c.vy *= 0.88;
      c.angle += c.vRot * dt;
      c.vRot *= 0.92;
      c.life -= dt;
      if (c.life <= 0) {
        this.recycleShellCasing(c);
        const last = this.shellCasings.pop();
        if (i < this.shellCasings.length) {
          this.shellCasings[i] = last;
        }
      }
    }

    // 6. Update Scorch Marks Decals
    for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
      const s = this.scorchMarks[i];
      s.life -= dt;
      if (s.life <= 0) {
        const last = this.scorchMarks.pop();
        if (i < this.scorchMarks.length) {
          this.scorchMarks[i] = last;
        }
      }
    }

    // 7. Update Ambient Cyber Dust Embers
    const emberCount = this.dustEmbers.length;
    for (let i = 0; i < emberCount; i++) {
      const e = this.dustEmbers[i];
      e.y += e.speedY * dt;
      e.x += e.speedX * dt + Math.sin(e.phase + e.y * 0.02) * 12 * dt;
      e.phase += dt * 1.5;
      if (e.y < -1900) e.y = 1900;
      if (e.y > 1900) e.y = -1900;
      if (e.x < -1900) e.x = 1900;
      if (e.x > 1900) e.x = -1900;
    }
  }

  renderFloorDecals(ctx, bounds) {
    ctx.save();

    // A. Render Ground Scorch Marks & Blast Craters
    for (let i = 0; i < this.scorchMarks.length; i++) {
      const s = this.scorchMarks[i];
      if (bounds && (s.x + s.radius < bounds.minX || s.x - s.radius > bounds.maxX || s.y + s.radius < bounds.minY || s.y - s.radius > bounds.maxY)) {
        continue;
      }
      const alpha = Math.min(1, s.life / 2.0) * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);

      // Outer irregular charred boundary
      ctx.fillStyle = '#020307';
      ctx.beginPath();
      for (let j = 0; j < s.spikes; j++) {
        const a = (j * Math.PI * 2) / s.spikes;
        const rad = j % 2 === 0 ? s.radius : s.radius * 0.65;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Inner glowing slag center
      if (s.life > s.maxLife * 0.5) {
        const glowAlpha = (s.life - s.maxLife * 0.5) / (s.maxLife * 0.5);
        ctx.fillStyle = `rgba(255, 60, 0, ${glowAlpha * 0.45})`;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // B. Render Brass Shell Casings on Floor
    for (let i = 0; i < this.shellCasings.length; i++) {
      const c = this.shellCasings[i];
      if (bounds && (c.x + 10 < bounds.minX || c.x - 10 > bounds.maxX || c.y + 10 < bounds.minY || c.y - 10 > bounds.maxY)) {
        continue;
      }
      const alpha = Math.min(1, c.life / 0.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // Brass casing body with highlight
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-c.width / 2 + 1, -c.height / 2, c.width - 2, 1);
      ctx.restore();
    }

    ctx.restore();
  }

  render(ctx) {
    ctx.save();

    // 1. Render Ghost Shadows
    for (const g of this.ghosts) {
      const alpha = (g.life / g.maxLife) * 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(-g.radius, -g.radius, g.radius * 2, g.radius * 2);
      ctx.restore();
    }

    // 2. Render Shockwaves
    for (const s of this.shockwaves) {
      const alpha = (s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4 * alpha;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2.5. Render Danger Zone Artillery Telegraphs
    for (let i = 0; i < this.telegraphs.length; i++) {
      const t = this.telegraphs[i];
      const progress = 1 - (t.life / t.maxLife); // 0 to 1
      ctx.save();

      // Outer Warning Ring with dashed pattern
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating Hazard perimeter ticks
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation || 0);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const tickAngle = (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(tickAngle) * (t.radius - 5), Math.sin(tickAngle) * (t.radius - 5));
        ctx.lineTo(Math.cos(tickAngle) * (t.radius + 5), Math.sin(tickAngle) * (t.radius + 5));
        ctx.stroke();
      }
      ctx.restore();

      // Expanding Danger Fill (pulsing neon glow)
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.15 + progress * 0.45;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * progress, 0, Math.PI * 2);
      ctx.fill();

      // Inner shrinking countdown ring
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(0, t.radius * (1 - progress)), 0, Math.PI * 2);
      ctx.stroke();

      // Pulsing Center Crosshair
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(t.x - 9, t.y); ctx.lineTo(t.x + 9, t.y);
      ctx.moveTo(t.x, t.y - 9); ctx.lineTo(t.x, t.y + 9);
      ctx.stroke();

      // Tactical Countdown Label
      ctx.font = 'bold 10px "Chakra Petch", "VT323", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 6;
      ctx.fillText(`${Math.max(0, t.life).toFixed(1)}s`, t.x, t.y - t.radius - 4);

      ctx.restore();
    }

    // 3. Render Atmospheric Ambient Cyber Embers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.dustEmbers.length; i++) {
      const e = this.dustEmbers[i];
      const pulseAlpha = e.alpha * (0.6 + Math.sin(e.phase) * 0.4);
      ctx.fillStyle = e.color;
      ctx.globalAlpha = pulseAlpha;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Render Particles with High-Speed Additive Neon Glow
    ctx.globalCompositeOperation = 'lighter';
    const pCount = this.particles.length;
    for (let i = 0; i < pCount; i++) {
      const p = this.particles[i];
      const alpha = p.life / p.maxLife;
      const r = p.size * alpha;
      if (r <= 0.2) continue;

      ctx.fillStyle = p.color;

      // Soft outer neon aura (zero cost compared to shadowBlur)
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Sharp bright core
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Render Floating Damage Numbers with Arcade Styling
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const t = this.floatingTexts[i];
      const alpha = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.globalAlpha = alpha;
      ctx.font = t.isCrit
        ? '900 24px "VT323", "Chakra Petch", monospace'
        : 'bold 18px "VT323", "Chakra Petch", monospace';

      // Crisp contrast black shadow outline for arcade readability
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x + 1.5, t.y + 1.5);

      ctx.fillStyle = t.color;
      if (t.isCrit) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore();
  }
}

export const particleSystem = new ParticleSystem();
