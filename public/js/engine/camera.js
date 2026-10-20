import { vfxConfig } from '../config/vfxConfig.js';

/**
 * 2D Game Camera with smooth Lerp interpolation and Trauma-based Screen Shake.
 */
export class Camera {
  constructor(viewportWidth, viewportHeight, worldWidth = Infinity, worldHeight = Infinity) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.isInfinite = !Number.isFinite(worldWidth) || !Number.isFinite(worldHeight);
    this.x = this.isInfinite ? 0 : worldWidth / 2;
    this.y = this.isInfinite ? 0 : worldHeight / 2;

    const camCfg = vfxConfig.getCameraConfig();
    this.trauma = 0; // 0 to 1
    this.maxShakeAngle = camCfg.maxShakeAngle ?? 0.05; // radians
    this.maxShakeOffset = camCfg.maxShakeOffset ?? 25; // pixels
    this.traumaDecay = camCfg.traumaDecay ?? 1.2; // decay per second
    this.shakeTime = 0;
    this.shakeMultiplier = camCfg.shakeMultiplier ?? 1.0; // configurable screen shake factor (0.0 to 1.5)

    // Dynamic Zoom & FOV Punch Engine (Module 3)
    this.zoom = camCfg.zoom?.defaultZoom ?? 1.0;
    this.targetZoom = camCfg.zoom?.defaultZoom ?? 1.0;
    this.zoomReturnSpeed = camCfg.zoom?.defaultReturnSpeed ?? 7.0;

    // Directional Recoil Kickback
    this.kickX = 0;
    this.kickY = 0;
    this.kickDecay = camCfg.kickback?.defaultDecay ?? 15.0;

    // Post-Processing Screen FX Engine (Module 3)
    this.glitchIntensity = 0; // 0.0 to 1.0
    this.glitchTimer = 0;
    this.flashColor = null;
    this.flashAlpha = 0;
    this.flashDuration = 0.35;
  }

  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Adds temporary FOV / Zoom Punch (e.g. on dash, heavy hit, explosion)
   * @param {number} amount Zoom change (e.g. +0.08 for zoom in, -0.05 for zoom out)
   * @param {number} returnSpeed Speed of returning back to targetZoom
   */
  punchZoom(amount = 0.08, returnSpeed = 7.0) {
    this.zoom = Math.max(0.6, Math.min(1.8, this.zoom + amount));
    this.zoomReturnSpeed = returnSpeed;
  }

  /**
   * Applies directional impulse kickback to the camera (e.g. weapon recoil, blast shockwave)
   * @param {number} angle Direction of kick in radians
   * @param {number} strength Pixel offset displacement
   */
  addKickback(angle, strength = 14) {
    this.kickX += Math.cos(angle) * strength;
    this.kickY += Math.sin(angle) * strength;
  }

  /**
   * Triggers cybernetic screen glitch / slicing artifacts
   * @param {number} intensity 0.0 to 1.0
   * @param {number} duration Duration in seconds
   */
  triggerGlitch(intensity = 0.6, duration = 0.25) {
    this.glitchIntensity = Math.min(1.0, Math.max(this.glitchIntensity, intensity));
    this.glitchTimer = Math.max(this.glitchTimer, duration);
  }

  /**
   * Triggers full-screen atmospheric flash wash (EMP, Boss defeat, Sector transition)
   * @param {string} color RGBA or hex color
   * @param {number} duration Fade duration in seconds
   */
  triggerFlash(color = 'rgba(0, 240, 255, 0.45)', duration = 0.35) {
    this.flashColor = color;
    this.flashAlpha = 1.0;
    this.flashDuration = Math.max(0.05, duration);
  }

  getVisibleBounds(margin = 80) {
    const currentZoom = this.zoom || 1.0;
    const halfW = (this.viewportWidth / 2) / currentZoom;
    const halfH = (this.viewportHeight / 2) / currentZoom;
    return {
      minX: this.x - halfW - margin,
      maxX: this.x + halfW + margin,
      minY: this.y - halfH - margin,
      maxY: this.y + halfH + margin,
    };
  }

  isVisible(x, y, radius = 0, margin = 80) {
    const currentZoom = this.zoom || 1.0;
    const halfW = (this.viewportWidth / 2) / currentZoom;
    const halfH = (this.viewportHeight / 2) / currentZoom;
    return (
      x + radius >= this.x - halfW - margin &&
      x - radius <= this.x + halfW + margin &&
      y + radius >= this.y - halfH - margin &&
      y - radius <= this.y + halfH + margin
    );
  }

  update(targetX, targetY, dt) {
    // Frame-rate independent exponential smoothing (consistent at 60Hz, 120Hz, 144Hz+)
    const lerpSpeed = 9;
    const factor = 1 - Math.exp(-lerpSpeed * Math.max(0.0001, dt));
    this.x += (targetX - this.x) * factor;
    this.y += (targetY - this.y) * factor;

    // Keep camera within world bounds only if bounded
    if (!this.isInfinite && Number.isFinite(this.worldWidth) && Number.isFinite(this.worldHeight)) {
      const currentZoom = this.zoom || 1.0;
      const halfW = (this.viewportWidth / 2) / currentZoom;
      const halfH = (this.viewportHeight / 2) / currentZoom;
      this.x = Math.max(halfW, Math.min(this.worldWidth - halfW, this.x));
      this.y = Math.max(halfH, Math.min(this.worldHeight - halfH, this.y));
    }

    // Decay trauma and advance shake harmonic phase
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      this.shakeTime += dt * 35; // organic harmonic oscillation frequency
    }

    // Dynamic Zoom spring interpolation back to targetZoom
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      const zFactor = 1 - Math.exp(-this.zoomReturnSpeed * Math.max(0.0001, dt));
      this.zoom += (this.targetZoom - this.zoom) * zFactor;
    } else {
      this.zoom = this.targetZoom;
    }

    // Directional Kickback spring decay
    if (Math.abs(this.kickX) > 0.02 || Math.abs(this.kickY) > 0.02) {
      const kickFactor = Math.exp(-this.kickDecay * Math.max(0.0001, dt));
      this.kickX *= kickFactor;
      this.kickY *= kickFactor;
    } else {
      this.kickX = 0;
      this.kickY = 0;
    }

    // Screen Flash decay
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - (1 / this.flashDuration) * dt);
    }

    // Glitch distortion decay
    if (this.glitchTimer > 0) {
      this.glitchTimer = Math.max(0, this.glitchTimer - dt);
      this.glitchIntensity = Math.max(0, this.glitchIntensity - dt * 2.5);
      if (this.glitchTimer <= 0) {
        this.glitchIntensity = 0;
      }
    } else {
      this.glitchIntensity = 0;
    }
  }

  apply(ctx) {
    ctx.save();

    // Center on target
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;

    ctx.translate(centerX, centerY);

    // Apply Zoom Punch / FOV scale if zoom !== 1.0
    if (this.zoom !== 1.0) {
      ctx.scale(this.zoom, this.zoom);
    }

    // Apply Non-linear Screen Shake (Trauma^2) with harmonic noise
    if (this.trauma > 0 && this.shakeMultiplier > 0) {
      const shake = this.trauma * this.trauma * this.shakeMultiplier;
      const sin1 = Math.sin(this.shakeTime * 1.3);
      const cos1 = Math.cos(this.shakeTime * 1.7);
      const sin2 = Math.sin(this.shakeTime * 2.9);

      // 70% coherent wave + 30% micro-noise prevents jarring single-frame flicker at 144Hz
      const offsetX = (sin1 * 0.7 + (Math.random() * 2 - 1) * 0.3) * this.maxShakeOffset * shake;
      const offsetY = (cos1 * 0.7 + (Math.random() * 2 - 1) * 0.3) * this.maxShakeOffset * shake;
      const angle = (sin2 * 0.7 + (Math.random() * 2 - 1) * 0.3) * this.maxShakeAngle * shake;

      ctx.translate(offsetX + this.kickX, offsetY + this.kickY);
      ctx.rotate(angle);
    } else if (this.kickX !== 0 || this.kickY !== 0) {
      ctx.translate(this.kickX, this.kickY);
    }

    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  screenToWorld(screenX, screenY) {
    const halfW = this.viewportWidth / 2;
    const halfH = this.viewportHeight / 2;
    const z = this.zoom || 1.0;
    return {
      x: (screenX - halfW) / z + this.x,
      y: (screenY - halfH) / z + this.y,
    };
  }

  worldToScreen(worldX, worldY) {
    const halfW = this.viewportWidth / 2;
    const halfH = this.viewportHeight / 2;
    const z = this.zoom || 1.0;
    return {
      x: (worldX - this.x) * z + halfW,
      y: (worldY - this.y) * z + halfH,
    };
  }

  /**
   * Render cyberpunk post-processing passes directly onto canvas viewport
   * @param {CanvasRenderingContext2D} ctx Viewport 2D rendering context
   * @param {number} width Viewport width
   * @param {number} height Viewport height
   * @param {Object} options Options containing player, isBulletTime, etc.
   */
  renderScreenFX(ctx, width = this.viewportWidth, height = this.viewportHeight, options = {}) {
    if (!ctx) return;
    const player = options.player;
    const isBulletTime = options.isBulletTime || false;
    const fxCfg = vfxConfig.getScreenFxConfig() || {};

    ctx.save();

    // 1. Low-Health Emergency Heartbeat Pulse Vignette
    const lhCfg = fxCfg.lowHealthVignette || {};
    if (lhCfg.enabled !== false && player && typeof player.health === 'number' && typeof player.maxHealth === 'number') {
      const threshold = lhCfg.threshold || 0.35;
      const hpRatio = Math.max(0, player.health / player.maxHealth);
      if (hpRatio < threshold && player.health > 0) {
        const severity = (threshold - hpRatio) / threshold; // 0 to 1
        const heartbeat = (Math.sin(Date.now() * (lhCfg.heartbeatFrequency || 0.009)) + 1) * 0.5;
        const minA = lhCfg.minAlpha || 0.2;
        const maxA = lhCfg.maxAlpha || 0.55;
        const vignetteAlpha = (minA + heartbeat * (maxA - minA)) * severity;

        if (ctx.createRadialGradient) {
          const maxRad = Math.hypot(width / 2, height / 2);
          const grad = ctx.createRadialGradient(width / 2, height / 2, maxRad * 0.4, width / 2, height / 2, maxRad);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.65, `${lhCfg.secondaryColor || 'rgba(180, 0, 40, '}${vignetteAlpha * 0.45})`);
          grad.addColorStop(1, `${lhCfg.primaryColor || 'rgba(255, 0, 60, '}${vignetteAlpha})`);

          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }

        // Chromatic danger perimeter border
        if (lhCfg.edgeDangerBorder !== false && severity > 0.4 && ctx.strokeRect) {
          ctx.strokeStyle = `rgba(255, 0, 70, ${heartbeat * 0.55})`;
          ctx.lineWidth = lhCfg.dangerBorderWidth || 3;
          ctx.strokeRect(3, 3, width - 6, height - 6);
        }
      }
    }

    // 2. Bullet-Time Cyberpunk Chrono-Focus Edge Tint
    const btCfg = fxCfg.bulletTimeFocus || {};
    if (btCfg.enabled !== false && isBulletTime && ctx.createRadialGradient) {
      const maxRad = Math.hypot(width / 2, height / 2);
      const btGrad = ctx.createRadialGradient(width / 2, height / 2, width * (btCfg.innerRatio || 0.25), width / 2, height / 2, maxRad);
      btGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      btGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.08)');
      btGrad.addColorStop(1, btCfg.coronaColor || 'rgba(0, 240, 255, 0.22)');
      ctx.fillStyle = btGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Screen Glitch Redline Slice Distortion
    const glCfg = fxCfg.glitchSlicing || {};
    if (glCfg.enabled !== false && this.glitchIntensity > 0) {
      const sliceCount = Math.floor(this.glitchIntensity * (glCfg.sliceMultiplier || 7)) + (glCfg.baseSlices || 2);
      ctx.fillStyle = glCfg.primaryColor || 'rgba(255, 0, 85, 0.15)';
      for (let i = 0; i < sliceCount; i++) {
        const sliceY = (Math.random() * height);
        const sliceH = Math.random() * (glCfg.maxSliceHeight || 16) + 4;
        const shiftX = (Math.random() - 0.5) * this.glitchIntensity * (glCfg.displacementX || 28);
        ctx.fillRect(shiftX, sliceY, width, sliceH);
      }

      // Neon cyan counter-displacement slice
      ctx.fillStyle = glCfg.counterColor || 'rgba(0, 240, 255, 0.12)';
      for (let i = 0; i < Math.floor(sliceCount / 2); i++) {
        const sliceY = (Math.random() * height);
        const sliceH = Math.random() * 12 + 3;
        const shiftX = (Math.random() - 0.5) * this.glitchIntensity * 20;
        ctx.fillRect(-shiftX, sliceY, width, sliceH);
      }
    }

    // 4. Fullscreen Atmospheric EMP / Flash Wash
    const flCfg = fxCfg.fullscreenFlash || {};
    if (flCfg.enabled !== false && this.flashAlpha > 0 && this.flashColor) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = Math.min(1.0, this.flashAlpha);
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }
}
