import { Camera } from './engine/camera.js';
import { SpatialHashGrid } from './engine/spatialGrid.js';
import { LightingEngine } from './vfx/lighting.js';
import { particleSystem } from './vfx/particles.js';
import { soundEngine } from './audio/soundEngine.js';
import { Player } from './entities/player.js';
import { WeaponManager } from './entities/weapons.js';
import { Enemy } from './entities/enemies.js';
import { Boss } from './entities/boss.js';
import { CollectibleDrop, calculateEnemyDrop, calculatePerkDrop, calculateBossDrops } from './entities/drops.js';
import { WorldObjectManager } from './entities/worldObjects.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }

    // Infinite Procedural Cyberpunk Arena (No Map Borders)
    this.worldWidth = Infinity;
    this.worldHeight = Infinity;

    // Subsystems
    const initialW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const initialH = typeof window !== 'undefined' ? window.innerHeight : 720;
    this.camera = new Camera(initialW, initialH, this.worldWidth, this.worldHeight);
    this.spatialGrid = new SpatialHashGrid(120);
    this.lighting = new LightingEngine(this.worldWidth, this.worldHeight);
    this.weapons = new WeaponManager();
    this.player = new Player(0, 0); // Origin in infinite arena
    this.worldObjects = new WorldObjectManager();

    // Game Entities
    this.enemies = [];
    this.bosses = [];
    this.bossSpawnedWave = 0;
    this.hazards = [];
    this.xpGems = [];
    this.drops = [];
    this.medkitsCollected = 0;
    this.ammoBoxesCollected = 0;
    this.damageFlashTimer = 0;
    this.weaponDegradeCooldownTimer = 0;

    // Game Feel & Special Mechanics
    this.hitStopTimer = 0;
    this.weaponOverchargeTimer = 0;

    // Mode & Victory Progression (Story Extraction Mode vs Endless)
    this.gameMode = 'story'; // 'story' (Extraction at Wave 20) | 'endless'
    this.isExtractionActive = false;
    this.extractionTimer = 60.0;
    this.extractionLandingZone = null;
    this.isVictory = false;

    // State & Wave Progression
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    this.waveTimer = 0;
    this.waveDuration = 35; // seconds per wave before next
    this.spawnTimer = 0;

    this.isPaused = false;
    this.wasAutoPausedByVisibility = false;
    this.isGameOver = false;
    this.lastTime = performance.now();

    // Native 3x Retina DPR & Hardware Pixel Scaling for ultra-sharp OLED/Retina mobile displays (Module 1)
    this.dpr = typeof window !== 'undefined' ? Math.max(1, Math.min(window.devicePixelRatio || 1, 3)) : 1;

    // High Refresh Rate & Fixed Timestep Loop settings (Module 1)
    this.targetFps = 0; // 0 = Uncapped (Native monitor refresh rate: 120Hz/144Hz/240Hz+), 60, 120, 144
    this.physicsStep = 1 / 120; // 120Hz fixed-rate physics simulation for silky smooth movement
    this.accumulator = 0;
    this.currentFps = 60;
    this.frameTimeMs = 16.6;
    this.fpsLastCheck = performance.now();
    this.frameCount = 0;
    this.fpsLimiterAccumulator = 0;
    this.onFpsUpdate = null;

    // Input Tracking
    this.keys = {};
    this.isMouseDown = false;
    this.manualFireTimer = 0;
    this.mouse = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 640, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 360 };
    this.mouseWorld = { x: this.player.x, y: this.player.y };

    // Mobile Touch & Auto-Aim Support
    this.isAutoAim = true; // Auto-aim nearest hostile on mobile for smooth survivor gameplay
    this.touchControlMode = 'auto'; // 'auto' (detect touch), 'always', 'never'

    this.setupListeners();
    this.resizeCanvas();
  }

  get boss() {
    return this.bosses && this.bosses.length > 0 ? this.bosses[0] : null;
  }

  set boss(val) {
    if (!this.bosses) this.bosses = [];
    if (!val) {
      this.bosses = [];
    } else {
      this.bosses = [val];
    }
  }

  setTargetFps(fps) {
    this.targetFps = Math.max(0, fps);
    this.fpsLimiterAccumulator = 0;
  }

  setDpr(dpr) {
    this.dpr = Math.max(1, Math.min(dpr || 1, 3));
    this.resizeCanvas();
  }

  resizeCanvas() {
    const w = typeof window !== 'undefined'
      ? (window.visualViewport && typeof window.visualViewport.width === 'number'
          ? window.visualViewport.width
          : (typeof window.innerWidth === 'number' ? window.innerWidth : 1280))
      : 1280;
    const h = typeof window !== 'undefined'
      ? (window.visualViewport && typeof window.visualViewport.height === 'number'
          ? window.visualViewport.height
          : (typeof window.innerHeight === 'number' ? window.innerHeight : 720))
      : 720;
    if (typeof window !== 'undefined' && window.devicePixelRatio && !this.dpr) {
      // Support native 3x Retina/OLED mobile displays for crystal-clear HD graphics
      this.dpr = Math.max(1, Math.min(window.devicePixelRatio, 3));
    } else if (!this.dpr) {
      this.dpr = 1;
    }

    // Physical backbuffer resolution scaled for razor-sharp Retina/HiDPI rendering
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // CSS display size matches viewport
    if (this.canvas.style) {
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }

    // Synchronize CSS Custom Properties for 100dvh & Anti-Notch Safe Area Bounds
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      document.documentElement.style.setProperty('--app-width', `${w}px`);
    }

    // Camera viewport maintains CSS logical coordinates
    this.camera.resize(w, h);

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  resetInput() {
    this.keys = {};
    this.isMouseDown = false;
    if (this.player) {
      this.player.isManualAiming = false;
      this.player.vx = 0;
      this.player.vy = 0;
    }
  }

  handleVisibilityHidden() {
    if (!this.isPaused && !this.isGameOver) {
      this.isPaused = true;
      this.wasAutoPausedByVisibility = true;
    }
    this.resetInput();
  }

  handleVisibilityVisible() {
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fpsLimiterAccumulator = 0;
    if (this.wasAutoPausedByVisibility) {
      this.isPaused = false;
      this.wasAutoPausedByVisibility = false;
    }
  }

  setupListeners() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resizeCanvas(), 100);
      setTimeout(() => this.resizeCanvas(), 300);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resizeCanvas());
      window.visualViewport.addEventListener('scroll', () => {
        // Prevent accidental scroll shifts on mobile browsers
        if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
      });
    }

    // Touch Support on Canvas for Aiming and Shooting on Mobile
    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      const handleAimTouch = (e) => {
        if (!e.changedTouches) return;
        const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          // If touch is on right 55% of the screen, aim and fire manually
          if (t.clientX > window.innerWidth * 0.45) {
            const canvasX = t.clientX - rect.left;
            const canvasY = t.clientY - rect.top;
            this.mouse.x = canvasX;
            this.mouse.y = canvasY;
            this.mouseWorld = this.camera.screenToWorld(canvasX, canvasY);
            this.player.isManualAiming = true;
            this.isMouseDown = true;
            if (e.type === 'touchstart') {
              this.weapons.fireWeapon('homing', this.player, this.enemies);
            }
          }
        }
      };

      this.canvas.addEventListener('touchstart', (e) => {
        soundEngine.init();
        handleAimTouch(e);
      }, { passive: true });

      this.canvas.addEventListener('touchmove', handleAimTouch, { passive: true });

      const handleTouchEndOrCancel = (e) => {
        let rightTouchRemaining = false;
        if (e.touches) {
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].clientX > window.innerWidth * 0.45) {
              rightTouchRemaining = true;
            }
          }
        }
        if (!rightTouchRemaining) {
          this.isMouseDown = false;
          if (this.player) this.player.isManualAiming = false;
        }
      };

      this.canvas.addEventListener('touchend', handleTouchEndOrCancel, { passive: true });
      this.canvas.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: true });
    }

    // Auto-Pause when switching tabs or minimizing, re-sync clock when returning
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.handleVisibilityHidden();
        } else {
          this.handleVisibilityVisible();
        }
      });
    }

    // Auto-reset all inputs (WASD, Dash, mouse clicks) when window loses focus to eliminate stuck keys / ship drifting
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => this.resetInput());
      window.addEventListener('focusout', () => this.resetInput());
    }

    // Block right-click context menu so Right-Click Dash is completely unhindered
    const preventContextMenu = (e) => e.preventDefault();
    if (typeof window !== 'undefined') window.addEventListener('contextmenu', preventContextMenu);
    if (typeof document !== 'undefined') document.addEventListener('contextmenu', preventContextMenu);
    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('contextmenu', preventContextMenu);
    }

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      soundEngine.init(); // unlock audio context on user gesture

      // Toggle Pause: KeyP
      if (e.code === 'KeyP') {
        if (!this.isGameOver) {
          this.isPaused = !this.isPaused;
          if (!this.isPaused) {
            this.lastTime = performance.now();
            this.accumulator = 0;
          }
        }
      }

      // Quick Injector: Key E to consume stored Nano-Medkit
      if (e.code === 'KeyE') {
        if (this.player.storedMedkits > 0 && this.player.health < this.player.maxHealth) {
          const res = this.player.useStoredMedkit();
          if (res) {
            soundEngine.playMedkitPickup();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas && this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    window.addEventListener('mousedown', (e) => {
      soundEngine.init();
      if (e.button === 0) {
        this.isMouseDown = true;
        this.weapons.fireWeapon('homing', this.player, this.enemies);
      }
      if (e.button === 2) {
        // Right click dash (prevent context menu interference)
        e.preventDefault();
        this.keys['Space'] = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
      if (e.button === 2) {
        e.preventDefault();
        this.keys['Space'] = false;
      }
    });
  }

  start() {
    this.lastTime = performance.now();
    this.fpsLastCheck = performance.now();
    this.frameCount = 0;
    this.lighting.setBiomeByIndex(0, true);

    for (let i = 0; i < 5; i++) {
      this.spawnEnemy(450 + i * 40);
    }

    const frameStep = (t) => {
      this.loop(t);
      this.rafId = requestAnimationFrame(frameStep);
    };
    this.rafId = requestAnimationFrame(frameStep);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  loop(currentTime) {
    const time = currentTime || performance.now();
    let rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Guard against spiral of death or negative time jumps
    if (rawDt > 0.1) rawDt = 0.1;
    if (rawDt < 0) rawDt = 0.001;

    // Optional Frame Limiter if user explicitly selected a target FPS
    if (this.targetFps > 0) {
      const minInterval = 1 / this.targetFps;
      this.fpsLimiterAccumulator += rawDt;
      if (this.fpsLimiterAccumulator < minInterval) {
        return;
      }
      rawDt = this.fpsLimiterAccumulator;
      this.fpsLimiterAccumulator = 0;
    }

    // Real-time FPS & Frame-time monitoring
    this.frameCount++;
    this.frameTimeMs = rawDt * 1000;
    if (time - this.fpsLastCheck >= 400) {
      this.currentFps = Math.round((this.frameCount * 1000) / (time - this.fpsLastCheck));
      this.frameCount = 0;
      this.fpsLastCheck = time;
      if (this.onFpsUpdate) {
        this.onFpsUpdate(this.currentFps, this.frameTimeMs);
      }
    }

    // Fixed-timestep Accumulator for deterministic, ultra-smooth physics
    if (!this.isPaused && !this.isGameOver) {
      this.accumulator += rawDt;
      const step = this.physicsStep; // 120Hz physics sub-step
      let updates = 0;
      const maxSubSteps = 4; // prevent spiral of death during temporary system lag

      while (this.accumulator >= step && updates < maxSubSteps) {
        this.update(step);
        this.accumulator -= step;
        updates++;
      }
      if (updates >= maxSubSteps) {
        this.accumulator = 0;
      }
    }

    this.render();
  }

  update(dt) {
    // 0. Hit-Stop Micro-Freeze Frame
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.render();
      return;
    }

    // 1. Time Dilation Factor (Bullet-Time OR Sandevistan Overclock)
    const timeScale = (this.player.isBulletTime || this.player.isOverclockActive) ? 0.35 : 1.0;
    const effectiveDt = dt * timeScale;

    if (this.weaponDegradeCooldownTimer > 0) {
      this.weaponDegradeCooldownTimer -= dt;
    }

    // 2. Mouse World Coordinates
    this.mouseWorld = this.camera.screenToWorld(this.mouse.x, this.mouse.y);

    // Auto-Aiming Support for Mobile & Casual Controls
    if (this.isAutoAim && this.enemies && this.enemies.length > 0) {
      let nearestDist = 650;
      let nearestEnemy = null;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.health > 0) {
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = e;
          }
        }
      }
      if (nearestEnemy) {
        this.player.isAutoAiming = true;
        if (!this.player.isManualAiming) {
          this.player.angle = Math.atan2(nearestEnemy.y - this.player.y, nearestEnemy.x - this.player.x);
        }
        // Auto-firing on mobile / auto-aim mode
        this.manualFireTimer = (this.manualFireTimer || 0) - effectiveDt;
        if (this.manualFireTimer <= 0) {
          this.weapons.fireWeapon('homing', this.player, this.enemies);
          this.manualFireTimer = 0.22;
        }
      } else {
        this.player.isAutoAiming = false;
      }
    } else {
      this.player.isAutoAiming = false;
    }

    // 3. Update Player
    this.player.handleInput(this.keys, this.mouseWorld, dt);
    this.player.update(dt, this.worldWidth, this.worldHeight);

    // Screen FX: Camera Zoom Punch & Recoil on Dash activation
    if (this.player.isDashing && !this.wasDashing) {
      this.camera.punchZoom(0.06, 8.0);
      this.camera.addKickback(this.player.angle, 10);
    }
    this.wasDashing = this.player.isDashing;

    // 4. Update Camera Lerp
    this.camera.update(this.player.x, this.player.y, dt);

    // 5. Update Weapons & Projectiles
    if (this.isMouseDown) {
      this.manualFireTimer = (this.manualFireTimer || 0) - effectiveDt;
      if (this.manualFireTimer <= 0) {
        this.weapons.fireWeapon('homing', this.player, this.enemies);
        this.manualFireTimer = 0.22;
      }
    }
    this.weapons.update(effectiveDt, this.player, this.enemies, this.worldWidth, this.worldHeight);
    if (this.weaponOverchargeTimer > 0) {
      this.weaponOverchargeTimer -= dt;
      this.weapons.update(effectiveDt, this.player, this.enemies, this.worldWidth, this.worldHeight);
    }

    // 5.5. Update Interactive World Objects (Terminals, Barrels, Shrines)
    this.worldObjects.update(effectiveDt, this.player, this);
    this.worldObjects.checkProjectileCollisions(this.weapons.projectiles, this);

    // 5.6. Update Extraction Landing Zone (Story Mode)
    this.updateExtractionProtocol(dt);

    // 6. Wave & Spawning Director
    this.updateWaveSpawner(effectiveDt);

    // 7. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(effectiveDt, this.player, this.enemies, this);
    }

    // 7.5. Update Artillery Hazards & Detonations
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.timer -= effectiveDt;
      if (h.timer <= 0) {
        particleSystem.emitShockwave(h.x, h.y, h.color || '#f59e0b', (h.radius || 65) * 1.5, 0.45);
        particleSystem.emitSparks(h.x, h.y, h.color || '#f59e0b', 16, 240);
        particleSystem.addScorchMark(h.x, h.y, (h.radius || 65) * 0.75, 'rgba(8, 4, 12, 0.85)');
        soundEngine.playArtilleryExplosion();
        this.camera.addTrauma(0.35);

        const dist = Math.hypot(this.player.x - h.x, this.player.y - h.y);
        if (dist < (h.radius || 65) + this.player.radius) {
          if (this.player.isDashing) {
            particleSystem.addFloatingText(this.player.x, this.player.y - 20, 'PERFECT EVADE!', '#00f0ff');
          } else {
            this.player.takeDamage(h.damage || 35);
            this.triggerWeaponDegradeOnHit();
            particleSystem.addFloatingText(this.player.x, this.player.y - 20, `-${h.damage || 35} ARTILLERY!`, '#ff0055', true);
          }
        }

        // Friendly fire damage to nearby hostiles caught in orbital blast
        for (const e of this.enemies) {
          const eDist = Math.hypot(e.x - h.x, e.y - h.y);
          if (eDist < (h.radius || 65) + e.radius) {
            e.takeDamage(Math.round((h.damage || 35) * 1.5));
          }
        }

        this.hazards.splice(i, 1);
      }
    }

    // 8. Update Bosses
    for (let i = this.bosses.length - 1; i >= 0; i--) {
      this.bosses[i].update(effectiveDt, this.player, this.camera, this);
    }

    // 9. Spatial Collision Pipeline
    this.handleCollisions();

    // 10. Update XP Magnet Gems & Collectible Drops
    this.updateXPGems(effectiveDt);
    this.updateDrops(effectiveDt);

    // Damage flash vignette decay
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
    }

    // 11. Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // 12. Update VFX Particles & Map Biome Lighting
    particleSystem.update(dt);
    this.lighting.update(dt, this.player, this.enemies, this.weapons, this.drops, particleSystem, this.camera, soundEngine);

    // 13. Check Game Over
    if (this.player.health <= 0) {
      this.triggerGameOver();
    }
  }

  updateWaveSpawner(dt) {
    this.waveTimer += dt;
    this.spawnTimer += dt;

    // Endless Boss Wave Trigger: Every multiple of 5 (Wave 5, 10, 15, 20...)
    const isBossWave = this.wave % 5 === 0;
    if (isBossWave && this.bossSpawnedWave !== this.wave && this.bosses.length === 0) {
      this.spawnBossEncounter();
      this.bossSpawnedWave = this.wave;
    }

    // Wave Progression: Only advances when wave duration elapses AND all active bosses are eliminated!
    if (this.waveTimer >= this.waveDuration && this.bosses.length === 0) {
      this.wave += 1;
      this.waveTimer = 0;
      soundEngine.playLevelUp();
      particleSystem.emitShockwave(this.player.x, this.player.y, '#00f0ff', 240, 0.6);
      this.camera.addTrauma(0.3);
      this.checkMapBiomeProgression('WAVE');
    }

    // Spawn Interval & Density scales with BOTH wave and player level (Intense Difficulty Ramp)
    const levelFactor = Math.max(0, this.player.level - 1);
    const waveFactor = Math.max(0, this.wave - 1);
    const spawnRate = Math.max(0.08, 0.95 - waveFactor * 0.08 - levelFactor * 0.03);
    const maxEnemies = Math.min(140, 35 + waveFactor * 6 + levelFactor * 4);

    if (this.spawnTimer >= spawnRate && this.enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      // Spawn rapid cluster at higher difficulty
      const clusterCount = Math.min(4, 1 + Math.floor((this.wave + this.player.level) / 6));
      for (let i = 0; i < clusterCount && this.enemies.length < maxEnemies; i++) {
        this.spawnEnemy();
      }
    }

    // Dynamic Random Horde Invasions / Surge Events (Requires intense player focus)
    this.surgeTimer = (this.surgeTimer || 0) + dt;
    const nextSurge = this.nextSurgeInterval || 25;
    if (this.surgeTimer >= nextSurge) {
      this.surgeTimer = 0;
      this.nextSurgeInterval = 22 + Math.random() * 10;
      this.triggerRandomSurgeInvasion();
    }
  }

  triggerRandomSurgeInvasion() {
    if (this.isPaused || this.isGameOver) return;
    const roll = Math.random();
    let bannerMsg = '';

    if (roll < 0.35) {
      // Swarm Ambush Ring
      bannerMsg = 'CẢNH BÁO: ĐỘT KÍCH BAO VÂY (SWARM AMBUSH)!';
      const count = Math.min(10, 6 + Math.floor(this.wave * 0.5));
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const x = this.player.x + Math.cos(angle) * 520;
        const y = this.player.y + Math.sin(angle) * 520;
        const type = Math.random() < 0.45 ? 'kamikaze' : 'swarmer';
        this.enemies.push(new Enemy(x, y, type, this.wave, this.player.level, false));
      }
    } else if (roll < 0.70) {
      // Elite Vanguard Squadron
      bannerMsg = 'BÁO ĐỘNG ĐỎ: BIỆT ĐỘI TINH ANH (ELITE RAID)!';
      const eliteCount = Math.min(4, 2 + Math.floor(this.wave / 4));
      for (let i = 0; i < eliteCount; i++) {
        this.spawnEnemy(560 + i * 45, null, true);
      }
    } else {
      // Dreadnought Strike
      bannerMsg = 'NGUY HIỂM: DREADNOUGHT TIÊN PHONG INBOUND!';
      this.spawnEnemy(600, 'colossus', true);
      this.spawnEnemy(540, 'phantom', false);
      this.spawnEnemy(540, 'phantom', false);
    }

    this.camera.addTrauma(0.45);
    soundEngine.playBossAlert();
    particleSystem.emitShockwave(this.player.x, this.player.y, '#ffd700', 320, 0.7);

    // Event banner on HUD
    window.dispatchEvent(new CustomEvent('game:surge', { detail: { message: bannerMsg } }));
  }

  spawnEnemy(customDist, forceType = null, forceElite = false) {
    const angle = Math.random() * Math.PI * 2;
    const dist = customDist || (540 + Math.random() * 240);
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;

    let type = forceType || 'swarmer';
    if (!forceType) {
      const rand = Math.random();
      const colossusUnlocked = this.wave >= 4 || this.player.level >= 8;
      const phantomUnlocked = this.wave >= 3 || this.player.level >= 6;
      const enforcerUnlocked = this.wave >= 2 || this.player.level >= 4;
      const sniperUnlocked = this.wave >= 2 || this.player.level >= 2;

      if (colossusUnlocked && rand < 0.12) {
        type = 'colossus';
      } else if (phantomUnlocked && rand < 0.28) {
        type = 'phantom';
      } else if (enforcerUnlocked && rand < 0.48) {
        type = 'enforcer';
      } else if (sniperUnlocked && rand < 0.70) {
        type = 'sniper';
      } else if (rand < 0.86) {
        type = 'kamikaze';
      } else {
        type = 'swarmer';
      }
    }

    const eliteChance = Math.min(0.40, 0.04 + (this.wave - 1) * 0.025 + (this.player.level - 1) * 0.015);
    const isElite = forceElite || (Math.random() < eliteChance);

    const enemy = new Enemy(x, y, type, this.wave, this.player.level, isElite);
    if (this.wave >= 3 && Math.random() < 0.08) {
      enemy.mutate(1.35);
    }
    this.enemies.push(enemy);
  }

  spawnBoss(archetypeIndex = -1) {
    this.spawnBossEncounter(archetypeIndex);
  }

  spawnBossEncounter(forcedArchetype = -1) {
    if (this.wave >= 15 && forcedArchetype < 0) {
      // Twin Bosses at wave 15+!
      const boss1 = new Boss(this.player.x - 280, this.player.y - 450, this.wave, 0);
      const boss2 = new Boss(this.player.x + 280, this.player.y - 450, this.wave, 1);
      this.bosses.push(boss1, boss2);
    } else {
      const b = new Boss(this.player.x, this.player.y - 450, this.wave, forcedArchetype);
      this.bosses.push(b);
    }

    this.camera.addTrauma(0.7);
    soundEngine.playBossAlert();
    soundEngine.playExplosion();
    for (const b of this.bosses) {
      particleSystem.emitShockwave(b.x, b.y, '#ff0055', 320, 0.9);
    }
  }

  handleCollisions() {
    // 1. Rebuild Spatial Grid for Enemies
    this.spatialGrid.clear();
    for (const e of this.enemies) {
      this.spatialGrid.insert(e);
    }

    // 2. Check Player Projectiles vs Enemies
    for (let i = this.weapons.projectiles.length - 1; i >= 0; i--) {
      const p = this.weapons.projectiles[i];
      const candidates = this.spatialGrid.query(p);

      for (const enemy of candidates) {
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < enemy.radius + p.radius) {
          this.applyDamageToEnemy(enemy, p.damage);

          // Superconductor Flak Overdrive: Chain Lightning Arcs
          if (p.isSuperconductor && this.enemies.length > 1) {
            let arcs = 0;
            for (const other of candidates) {
              if (other !== enemy && arcs < 2) {
                const od = Math.hypot(other.x - enemy.x, other.y - enemy.y);
                if (od < 130) {
                  arcs++;
                  this.applyDamageToEnemy(other, Math.round(p.damage * 0.7));
                  particleSystem.emitSparks(other.x, other.y, '#00f0ff', 4, 110);
                }
              }
            }
          }

          if (!p.isLaser || p.pierceCount-- <= 0) {
            this.weapons.projectiles.splice(i, 1);
          }
          break;
        }
      }

      // Check Boss Hit (All active bosses and their Overdrive Drones)
      if (this.bosses && this.bosses.length > 0 && this.weapons.projectiles[i]) {
        for (const b of this.bosses) {
          // Check Overdrive Drones first (escort shield interception)
          let droneIntercepted = false;
          if (b.drones && b.drones.length > 0) {
            for (let di = b.drones.length - 1; di >= 0; di--) {
              const drone = b.drones[di];
              const dd = Math.hypot(drone.x - p.x, drone.y - p.y);
              if (dd < drone.radius + p.radius) {
                const isDead = drone.takeDamage(p.damage);
                this.weapons.projectiles.splice(i, 1);
                droneIntercepted = true;
                if (isDead) {
                  b.drones.splice(di, 1);
                  this.score += 750;
                  particleSystem.addFloatingText(drone.x, drone.y, 'DRONE DESTROYED', '#00f0ff', true);
                  soundEngine.playExplosion();
                }
                break;
              }
            }
          }
          if (droneIntercepted) break;

          const bd = Math.hypot(b.x - p.x, b.y - p.y);
          if (bd < b.radius + p.radius) {
            this.applyDamageToBoss(b, p.damage);
            this.weapons.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // 3. Check Orbit Shield vs Enemies
    const orbs = this.weapons.getOrbitOrbs(this.player);
    for (const orb of orbs) {
      const candidates = this.spatialGrid.query(orb);
      for (const enemy of candidates) {
        const d = Math.hypot(enemy.x - orb.x, enemy.y - orb.y);
        if (d < enemy.radius + orb.radius) {
          this.applyDamageToEnemy(enemy, orb.damage * 0.1);
        }
      }
    }

    // 4. Check Enemies vs Player
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (dist < e.radius + this.player.radius) {
        if (e.type === 'kamikaze') {
          particleSystem.emitShockwave(e.x, e.y, '#f97316', 100, 0.4);
          this.player.takeDamage(e.damage);
          this.camera.addTrauma(0.3);
          soundEngine.playExplosion();
          this.triggerWeaponDegradeOnHit();
          this.killEnemy(i);
        } else {
          const overflow = this.player.takeDamage(e.damage * 0.05); // continuous contact
          if (overflow > 0) {
            this.triggerWeaponDegradeOnHit();
          }
        }
      }

      // Enemy Bullets vs Player (with Perfect Dash / Hyper Boost graze mechanic)
      for (let bi = e.enemyBullets.length - 1; bi >= 0; bi--) {
        const b = e.enemyBullets[bi];
        const bd = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        if (bd < b.radius + this.player.radius + 12) {
          if (this.player.isDashing) {
            // Perfect Dash: Absorb bullet, neutralize it and trigger Hyper Boost!
            e.enemyBullets.splice(bi, 1);
            particleSystem.emitSparks(b.x, b.y, '#00f0ff', 4, 110);
            this.player.triggerHyperBoost(2.5);
          } else if (bd < b.radius + this.player.radius) {
            const dmg = b.damage || 15;
            this.player.takeDamage(dmg);
            this.damageFlashTimer = 0.28;
            this.camera.addTrauma(0.35);
            this.triggerWeaponDegradeOnHit();
            e.enemyBullets.splice(bi, 1);
          }
        }
      }
    }

    // 5. Boss Bullets vs Player (with Perfect Dash graze)
    if (this.bosses && this.bosses.length > 0) {
      for (const bTarget of this.bosses) {
        for (let bi = bTarget.bullets.length - 1; bi >= 0; bi--) {
          const b = bTarget.bullets[bi];
          const bd = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (bd < b.radius + this.player.radius + 14) {
            if (this.player.isDashing) {
              // Perfect Dash through boss bullet barrage!
              bTarget.bullets.splice(bi, 1);
              particleSystem.emitSparks(b.x, b.y, '#ffe600', 6, 140);
              this.player.triggerHyperBoost(2.5);
            } else if (bd < b.radius + this.player.radius) {
              const dmg = b.damage || 30;
              this.player.takeDamage(dmg);
              this.damageFlashTimer = 0.35;
              this.camera.addTrauma(0.45);
              this.triggerWeaponDegradeOnHit();
              bTarget.bullets.splice(bi, 1);
            }
          }
        }

        // Check Overdrive Drone Bullets vs Player
        if (bTarget.drones && bTarget.drones.length > 0) {
          for (const drone of bTarget.drones) {
            for (let dbi = drone.bullets.length - 1; dbi >= 0; dbi--) {
              const db = drone.bullets[dbi];
              const dbd = Math.hypot(db.x - this.player.x, db.y - this.player.y);
              if (dbd < db.radius + this.player.radius + 14) {
                if (this.player.isDashing) {
                  drone.bullets.splice(dbi, 1);
                  particleSystem.emitSparks(db.x, db.y, '#00f0ff', 5, 120);
                  this.player.triggerHyperBoost(2.0);
                } else if (dbd < db.radius + this.player.radius) {
                  const dmg = db.damage || 15;
                  this.player.takeDamage(dmg);
                  this.damageFlashTimer = 0.25;
                  this.camera.addTrauma(0.3);
                  this.triggerWeaponDegradeOnHit();
                  drone.bullets.splice(dbi, 1);
                }
              }
            }
          }
        }
      }
    }
  }

  triggerWeaponDegradeOnHit() {
    if (this.player.isDashing) return null;
    this.camera.punchZoom(0.06, 9.0);
    this.camera.triggerGlitch(0.5, 0.22);
    if (this.weaponDegradeCooldownTimer <= 0) {
      const result = this.weapons.degradeOnHit(this.player);
      if (result) {
        this.weaponDegradeCooldownTimer = 1.0; // 1s grace cooldown between degradations
        this.camera.addTrauma(0.35);
      }
      return result;
    }
    return null;
  }

  applyDamageToEnemy(enemy, baseDamage) {
    const isCrit = Math.random() < this.player.critChance;
    const finalDamage = Math.round(
      baseDamage * this.player.damageMultiplier * (isCrit ? this.player.critMultiplier : 1.0)
    );

    if (isCrit && enemy.isElite) {
      this.triggerHitStop(0.025);
    }

    particleSystem.addFloatingText(
      enemy.x,
      enemy.y,
      isCrit ? `CRIT ${finalDamage}!` : `${finalDamage}`,
      isCrit ? '#ffff00' : '#ffffff',
      isCrit
    );

    const isDead = enemy.takeDamage(finalDamage);
    if (isDead) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        this.killEnemy(idx);
      }
    }
  }

  applyDamageToBoss(targetOrDmg, baseDamage) {
    let target = this.boss;
    let dmg = targetOrDmg;
    if (targetOrDmg && typeof targetOrDmg === 'object') {
      target = targetOrDmg;
      dmg = baseDamage;
    }
    if (!target) return;

    const isCrit = Math.random() < this.player.critChance;
    const finalDamage = Math.round(
      dmg * this.player.damageMultiplier * (isCrit ? this.player.critMultiplier : 1.0)
    );

    if (isCrit) {
      this.triggerHitStop(0.03);
    }

    particleSystem.addFloatingText(
      target.x,
      target.y,
      isCrit ? `CRIT ${finalDamage}!` : `${finalDamage}`,
      isCrit ? '#ffff00' : '#ff0055',
      isCrit
    );

    const isDead = target.takeDamage(finalDamage);
    if (isDead) {
      const idx = this.bosses.indexOf(target);
      if (idx !== -1) {
        this.bosses.splice(idx, 1);
      }

      this.triggerHitStop(0.06);
      if (typeof this.player.chargeOverclock === 'function') {
        this.player.chargeOverclock(40);
      }

      this.camera.addTrauma(0.85);
      this.camera.punchZoom(0.12, 5.0);
      this.camera.triggerFlash('rgba(255, 0, 85, 0.45)', 0.5);
      soundEngine.playExplosion();
      particleSystem.emitShockwave(target.x, target.y, '#ff0055', 420, 1.3);
      if (particleSystem.addScorchMark) {
        particleSystem.addScorchMark(target.x, target.y, 52);
      }

      const bossScore = 15000 * Math.max(1, Math.floor(this.wave / 5));
      this.score += bossScore;

      // Boss Guaranteed Drops: Medkit + Specialized Ammo Crates
      const bossDrops = calculateBossDrops(target.x, target.y);
      this.drops.push(...bossDrops);

      // Trigger Hyper Boost surge for player!
      this.player.triggerHyperBoost(4.0);

      // If in Story Mode and Wave 20 reached/surpassed, activate Extraction Protocol!
      if (this.gameMode === 'story' && this.wave >= 20 && !this.isExtractionActive) {
        this.startExtractionProtocol();
      }
    }
  }

  killEnemy(index) {
    const enemy = this.enemies[index];
    if (!enemy) return;

    this.enemies.splice(index, 1);
    this.kills += 1;

    // Charge Cyber Overclock Ultimate
    if (typeof this.player.chargeOverclock === 'function') {
      const chargeAmt = enemy.isElite ? 6 : (enemy.type === 'colossus' ? 5 : 2);
      this.player.chargeOverclock(chargeAmt);
    }

    // Combo system
    this.combo += 1;
    this.comboTimer = 2.2;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const points = Math.round(enemy.xpValue * 10 * Math.min(10, 1 + this.combo * 0.15));
    this.score += points;

    // 1. Drop XP Gem (Scaled with extra gems for Elites)
    const gemCount = enemy.isElite ? 3 : 1;
    for (let g = 0; g < gemCount; g++) {
      const offsetX = (Math.random() - 0.5) * 24;
      const offsetY = (Math.random() - 0.5) * 24;
      this.xpGems.push({
        x: enemy.x + offsetX,
        y: enemy.y + offsetY,
        xp: Math.round(enemy.xpValue / gemCount),
        color: enemy.isElite ? '#ffd700' : '#00f0ff',
        radius: enemy.isElite ? 8 : 6,
      });
    }

    if (enemy.isElite) {
      this.camera.addTrauma(0.35);
      this.camera.punchZoom(0.06, 7.0);
      this.camera.triggerFlash('rgba(255, 215, 0, 0.3)', 0.25);
      soundEngine.playExplosion();
      particleSystem.emitShockwave(enemy.x, enemy.y, '#ffd700', 160, 0.5);
      particleSystem.addFloatingText(enemy.x, enemy.y - 20, '★ ELITE PURGED!', '#ffd700', true);
      if (particleSystem.addScorchMark) {
        particleSystem.addScorchMark(enemy.x, enemy.y, 38);
      }
    } else if (enemy.type === 'kamikaze' && particleSystem.addScorchMark) {
      particleSystem.addScorchMark(enemy.x, enemy.y, 32);
    }

    // 2. Drop Ammo Crates or Nano Medkits (Higher chances for Elites and Heavy mechs)
    const isSpecial = enemy.isElite || enemy.type === 'kamikaze' || enemy.type === 'sniper' || enemy.type === 'enforcer' || enemy.type === 'phantom' || enemy.type === 'colossus';
    const canRollAmmo = isSpecial || Math.random() < 0.35;
    if (canRollAmmo && this.drops.length < 16) {
      const dropKey = calculateEnemyDrop(enemy.type);
      if (dropKey) {
        this.drops.push(new CollectibleDrop(enemy.x, enemy.y, dropKey));
      }
    }

    // 3. Drop Rare Upgrade Perk Modules (Speed, Crit, Hull, Energy, Nuke, Magnet)
    if (this.drops.length < 16) {
      const perkKey = calculatePerkDrop(enemy.type);
      if (perkKey) {
        const offsetX = (Math.random() - 0.5) * 36;
        const offsetY = (Math.random() - 0.5) * 36;
        this.drops.push(new CollectibleDrop(enemy.x + offsetX, enemy.y + offsetY, perkKey));
      }
    }

    soundEngine.playShoot(0.4);
  }

  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const alive = drop.update(dt, this.player);

      if (!alive) {
        this.drops.splice(i, 1);
        continue;
      }

      const d = Math.hypot(this.player.x - drop.x, this.player.y - drop.y);
      if (d < this.player.radius + drop.radius) {
        this.collectDrop(drop, i);
      }
    }
  }

  collectDrop(drop, index) {
    this.drops.splice(index, 1);

    if (drop.config.type === 'health') {
      this.medkitsCollected = (this.medkitsCollected || 0) + 1;
      this.score += 150;

      // Store in emergency reserve if player is full health
      if (this.player.health >= this.player.maxHealth && this.player.storedMedkits < this.player.maxStoredMedkits) {
        this.player.storedMedkits++;
        soundEngine.playMedkitPickup();
        particleSystem.emitShockwave(drop.x, drop.y, '#10b981', 120, 0.4);
        particleSystem.addFloatingText(this.player.x, this.player.y - 25, '+1 MEDKIT DỰ TRỮ [E]!', '#10b981', true);
      } else {
        this.player.heal(drop.config.healAmount);
        soundEngine.playMedkitPickup();
      }
    } else if (drop.config.type === 'ammo') {
      this.ammoBoxesCollected = (this.ammoBoxesCollected || 0) + 1;
      this.score += 300;
      this.weapons.upgradeWithAmmo(drop.config.weaponType, this.player);
      soundEngine.playAmmoBoxPickup(drop.config.weaponType);
    } else if (drop.config.type === 'buff') {
      this.score += 500;
      soundEngine.playLevelUp();
      particleSystem.emitShockwave(drop.x, drop.y, drop.config.color, 160, 0.5);

      switch (drop.config.buffType) {
        case 'speed':
          this.player.speed *= 1.12;
          this.player.dashCooldown = Math.max(0.4, this.player.dashCooldown * 0.9);
          particleSystem.addFloatingText(this.player.x, this.player.y - 30, '+12% TỐC ĐỘ & GIẢM HỒI DASH!', drop.config.color, true);
          break;
        case 'crit':
          this.player.critChance = Math.min(0.85, this.player.critChance + 0.08);
          this.player.critMultiplier += 0.35;
          particleSystem.addFloatingText(this.player.x, this.player.y - 30, '+8% CRIT & +35% CRIT DMG!', drop.config.color, true);
          break;
        case 'hull':
          this.player.maxHealth += 25;
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
          this.player.shield = this.player.maxShield;
          particleSystem.addFloatingText(this.player.x, this.player.y - 30, '+25 MÁU MAX & HỒI ĐẦY GIÁP!', drop.config.color, true);
          break;
        case 'energy':
          this.player.maxEnergy += 25;
          this.player.energy = this.player.maxEnergy;
          particleSystem.addFloatingText(this.player.x, this.player.y - 30, '+25 BULLET-TIME MAX & ĐẦY NĂNG LƯỢNG!', drop.config.color, true);
          break;
        case 'nuke':
          this.triggerNuke();
          break;
        case 'magnet':
          this.triggerSuperMagnet();
          break;
      }
    }

    window.dispatchEvent(
      new CustomEvent('game:dropcollected', {
        detail: {
          drop,
          medkitsCollected: this.medkitsCollected,
          ammoBoxesCollected: this.ammoBoxesCollected,
          player: this.player,
          weapons: this.weapons,
        },
      })
    );
  }

  triggerNuke() {
    soundEngine.playExplosion();
    this.camera.addTrauma(0.8);
    particleSystem.emitShockwave(this.player.x, this.player.y, '#ef4444', 500, 0.8);
    particleSystem.addFloatingText(this.player.x, this.player.y - 45, '[TACTICAL NUKE] DETONATED!', '#ef4444', true);

    // Eliminate all current enemies on the battlefield
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      particleSystem.emitSparks(e.x, e.y, '#ff0055', 12, 220);
      this.xpGems.push({ x: e.x, y: e.y, xp: e.xpValue, color: '#00f0ff', radius: 6 });
      this.score += e.xpValue * 15;
      this.kills++;
    }
    this.enemies = [];

    // Damage All Bosses if present
    if (this.bosses && this.bosses.length > 0) {
      for (const b of this.bosses) {
        b.takeDamage(600);
        particleSystem.addFloatingText(b.x, b.y - 50, '-600 NUKE DMG!', '#ff0055', true);
      }
    }
  }

  triggerSuperMagnet() {
    soundEngine.playLevelUp();
    particleSystem.emitShockwave(this.player.x, this.player.y, '#a855f7', 400, 0.6);
    particleSystem.addFloatingText(this.player.x, this.player.y - 45, '[VORTEX MAGNET] ACTIVE!', '#a855f7', true);

    // Instantly collect all XP gems
    for (const g of this.xpGems) {
      g.x = this.player.x;
      g.y = this.player.y;
    }
    // Pull all drops rapidly
    for (const d of this.drops) {
      d.x = this.player.x + (Math.random() - 0.5) * 30;
      d.y = this.player.y + (Math.random() - 0.5) * 30;
    }
  }

  updateXPGems(dt) {
    const magnetRadius = 160;
    for (let i = this.xpGems.length - 1; i >= 0; i--) {
      const g = this.xpGems[i];
      const d = Math.hypot(this.player.x - g.x, this.player.y - g.y);

      if (d < magnetRadius) {
        const pullSpeed = 450;
        const angle = Math.atan2(this.player.y - g.y, this.player.x - g.x);
        g.x += Math.cos(angle) * pullSpeed * dt;
        g.y += Math.sin(angle) * pullSpeed * dt;
      }

      if (d < this.player.radius + g.radius) {
        const leveledUp = this.player.addXP(g.xp);
        this.xpGems.splice(i, 1);
        if (leveledUp) {
          // Bỏ chọn thẻ nâng cấp: người chơi tăng cấp trực tiếp trên chiến trường không ngắt quãng
          this.player.maxHealth += 10;
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 10);
          this.player.maxShield += 5;
          this.player.shield = this.player.maxShield;
          this.player.damageMultiplier += 0.05;
          particleSystem.emitShockwave(this.player.x, this.player.y, '#00f0ff', 200, 0.5);
          particleSystem.addFloatingText(this.player.x, this.player.y - 35, `LEVEL UP! CẤP ${this.player.level} (+MÁU/+GIÁP/+CÔNG)`, '#00f0ff', true);
          soundEngine.playLevelUp();
          this.checkMapBiomeProgression('LEVEL');
        }
      }
    }
  }

  checkMapBiomeProgression(reason = 'LEVEL') {
    const newBiome = this.lighting.setProgression(this.player.level, this.wave);
    if (newBiome) {
      const accent = newBiome.accentColor || '#00f0ff';
      particleSystem.emitShockwave(this.player.x, this.player.y, accent, 380, 0.9);
      particleSystem.addFloatingText(
        this.player.x,
        this.player.y - 60,
        `SECTOR // ${newBiome.name}`,
        accent,
        true
      );
      this.camera.addTrauma(0.35);
      this.camera.punchZoom(0.08, 6.0);
      this.camera.triggerFlash(accent, 0.4);

      window.dispatchEvent(
        new CustomEvent('game:sectortransition', {
          detail: {
            biome: newBiome,
            level: this.player.level,
            wave: this.wave,
            reason,
          },
        })
      );
    }
    return newBiome;
  }

  triggerGameOver() {
    this.isGameOver = true;
    soundEngine.playExplosion();
    this.camera.addTrauma(0.8);
    window.dispatchEvent(
      new CustomEvent('game:gameover', {
        detail: {
          score: this.score,
          wave: this.wave,
          kills: this.kills,
          maxCombo: this.maxCombo,
        },
      })
    );
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    if (this.dpr && this.dpr !== 1) {
      this.ctx.scale(this.dpr, this.dpr);
    }
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Apply Camera
    this.camera.apply(this.ctx);

    const bounds = this.camera.getVisibleBounds(120);

    // 1. Procedural Background Grid & Pillars
    this.lighting.renderBackgroundGrid(this.ctx, this.camera);

    // 1b. Floor Decals (Scorch Blast Craters & Ejected Brass Shells)
    if (particleSystem.renderFloorDecals) {
      particleSystem.renderFloorDecals(this.ctx, bounds);
    }

    // 1c. Arena Hazards (Acid Pools, EMP Conduits, Magma Vents, Quantum Wells, Solar Lasers)
    if (this.lighting.renderHazards) {
      this.lighting.renderHazards(this.ctx, bounds);
    }

    // 2. Render Faceted Cyber Data Crystals (Itch.io Handcrafted Gem Sprites)
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.xpGems.length; i++) {
      const g = this.xpGems[i];
      if (
        g.x + g.radius < bounds.minX ||
        g.x - g.radius > bounds.maxX ||
        g.y + g.radius < bounds.minY ||
        g.y - g.radius > bounds.maxY
      ) {
        continue;
      }

      this.ctx.save();
      this.ctx.translate(g.x, g.y);
      const gr = g.radius * 1.15;

      // Outer Corona Glow
      this.ctx.fillStyle = g.color + '44';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, gr + 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Rhombus / Faceted Crystal Body
      this.ctx.fillStyle = g.color;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -gr);
      this.ctx.lineTo(gr * 0.75, 0);
      this.ctx.lineTo(0, gr);
      this.ctx.lineTo(-gr * 0.75, 0);
      this.ctx.closePath();
      this.ctx.fill();

      // Top Specular Highlight Facet
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(0, -gr);
      this.ctx.lineTo(gr * 0.35, -gr * 0.3);
      this.ctx.lineTo(0, 0);
      this.ctx.lineTo(-gr * 0.35, -gr * 0.3);
      this.ctx.closePath();
      this.ctx.fill();

      // Fine Bevel Stroke
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      this.ctx.restore();
    }
    this.ctx.restore();

    // 2b. Render Collectible Drops (Ammo Crates & Nano Medkits)
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (
        d.x + d.radius < bounds.minX ||
        d.x - d.radius > bounds.maxX ||
        d.y + d.radius < bounds.minY ||
        d.y - d.radius > bounds.maxY
      ) {
        continue;
      }
      d.render(this.ctx);
    }

    // 2c. Render Interactive World Objects (Terminals, Barrels, Shrines)
    this.worldObjects.render(this.ctx);

    // 2d. Render Extraction Landing Zone (Story Mode)
    if (this.isExtractionActive) {
      this.renderExtractionZone(this.ctx);
    }

    // 3. Render Enemies (Frustum Culled)
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (
        e.x + e.radius < bounds.minX ||
        e.x - e.radius > bounds.maxX ||
        e.y + e.radius < bounds.minY ||
        e.y - e.radius > bounds.maxY
      ) {
        continue;
      }
      e.render(this.ctx);
    }

    // 4. Render Bosses
    if (this.bosses && this.bosses.length > 0) {
      for (const b of this.bosses) {
        b.render(this.ctx);
      }
    }

    // 5. Render Weapons & Projectiles
    this.weapons.render(this.ctx, this.player);

    // 6. Render Player
    this.player.render(this.ctx);

    // 7. Render Particle System & Shockwaves
    particleSystem.render(this.ctx);

    // 8. Dynamic Neon Lighting
    const currentBiome = this.lighting.getCurrentBiome();
    const lights = [
      { x: this.player.x, y: this.player.y, radius: 250, color: currentBiome.ambientLight || 'rgba(0, 240, 255, 0.45)' },
    ];
    if (this.bosses && this.bosses.length > 0) {
      for (const b of this.bosses) {
        lights.push({
          x: b.x,
          y: b.y,
          radius: 380,
          color: b.phase === 3 ? 'rgba(255, 0, 85, 0.55)' : 'rgba(0, 240, 255, 0.45)',
        });
      }
    }
    if (this.lighting.getHazardLights) {
      const hzLights = this.lighting.getHazardLights(bounds);
      for (let i = 0; i < hzLights.length; i++) {
        lights.push(hzLights[i]);
      }
    }
    this.lighting.renderDynamicLighting(this.ctx, lights);

    this.camera.restore(this.ctx);

    // 9. Cyberpunk Screen FX (Low-Health Pulse Vignette, Glitch Redline Slicing, Flash Wash, Bullet-Time)
    if (this.camera.renderScreenFX) {
      this.camera.renderScreenFX(this.ctx, this.camera.viewportWidth, this.camera.viewportHeight, {
        player: this.player,
        isBulletTime: this.player.isBulletTime,
      });
    }

    // 9b. Red Damage Flash Vignette Overlay when taking hits
    if (this.damageFlashTimer > 0) {
      this.ctx.save();
      const alpha = Math.min(0.38, this.damageFlashTimer * 1.4);
      this.ctx.fillStyle = `rgba(255, 0, 60, ${alpha})`;
      this.ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);
      this.ctx.restore();
    }

    // 10. Pause Overlay
    if (this.isPaused && !this.isGameOver) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(5, 7, 15, 0.65)';
      this.ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);
      this.ctx.font = '900 36px "Chakra Petch", "VT323", monospace';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 15;
      this.ctx.fillText('TẠM DỪNG (PAUSED)', this.camera.viewportWidth / 2, this.camera.viewportHeight / 2);
      this.ctx.font = '16px "Chakra Petch", sans-serif';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText('Nhấn [P] hoặc chuyển về tab trò chơi để tiếp tục', this.camera.viewportWidth / 2, this.camera.viewportHeight / 2 + 40);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  startExtractionProtocol() {
    if (this.isExtractionActive || this.isVictory) return;
    this.isExtractionActive = true;
    this.extractionTimer = 60.0; // 60s countdown
    // Spawn extraction landing pad 720px from player
    const angle = Math.random() * Math.PI * 2;
    this.extractionLandingZone = {
      x: this.player.x + Math.cos(angle) * 720,
      y: this.player.y + Math.sin(angle) * 720,
      radius: 110,
      stayProgress: 0,
      stayRequired: 5.0, // stay inside for 5 seconds to complete extraction
      pulseAnim: 0,
    };

    soundEngine.playBossAlert();
    if (soundEngine.announce) {
      soundEngine.announce('Warning: Core critical. Evacuation dropship inbound. Reach extraction beacon.');
    }
    particleSystem.emitShockwave(this.player.x, this.player.y, '#39ff14', 350, 0.8);
    this.camera.addTrauma(0.5);

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('game:surge', {
          detail: { message: '🚨 GIAO THỨC RÚT LUI: TÀU CỨU HỘ ĐÃ ĐÁP - TIẾN VÀO TỌA ĐỘ BEACON!' },
        })
      );
    }
  }

  updateExtractionProtocol(dt) {
    if (!this.isExtractionActive || !this.extractionLandingZone || this.isVictory) return;
    this.extractionTimer -= dt;
    this.extractionLandingZone.pulseAnim += dt * 3.5;

    const lz = this.extractionLandingZone;
    const dist = Math.hypot(this.player.x - lz.x, this.player.y - lz.y);

    if (dist <= lz.radius) {
      lz.stayProgress += dt;
      if (Math.random() < 0.25) {
        particleSystem.emitSparks(this.player.x, this.player.y, '#39ff14', 2, 80);
      }
      if (lz.stayProgress >= lz.stayRequired) {
        this.triggerVictory();
      }
    } else {
      lz.stayProgress = Math.max(0, lz.stayProgress - dt * 0.7);
    }

    if (this.extractionTimer <= 0 && !this.isVictory) {
      this.player.takeDamage(9999);
    }
  }

  triggerVictory() {
    if (this.isVictory) return;
    this.isVictory = true;
    this.isPaused = true;
    this.score += 50000; // Extraction score bonus!

    soundEngine.playVictory();
    if (soundEngine.announce) {
      soundEngine.announce('Extraction successful. Sector liberated. Mission accomplished.');
    }

    particleSystem.emitShockwave(this.player.x, this.player.y, '#39ff14', 450, 0.9);
    particleSystem.emitShockwave(this.player.x, this.player.y, '#ffd700', 350, 0.7);

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('game:victory', {
          detail: {
            score: this.score,
            wave: this.wave,
            kills: this.kills,
            maxCombo: this.maxCombo,
          },
        })
      );
    }
  }

  triggerHitStop(duration = 0.025) {
    this.hitStopTimer = duration;
  }

  applyWeaponOvercharge(duration = 8.0) {
    this.weaponOverchargeTimer = duration;
  }

  renderExtractionZone(ctx) {
    if (!this.extractionLandingZone) return;
    const lz = this.extractionLandingZone;
    ctx.save();
    ctx.translate(lz.x, lz.y);

    // 1. Landing Ring Zone
    const pulse = Math.sin(lz.pulseAnim) * 8;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, lz.radius + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Zone Base Fill
    ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, lz.radius + pulse, 0, Math.PI * 2);
    ctx.fill();

    // 3. Central Dropship Landing Cross
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-35, 0); ctx.lineTo(35, 0);
    ctx.moveTo(0, -35); ctx.lineTo(0, 35);
    ctx.stroke();

    // 4. Stay / Evac Progress Ring
    if (lz.stayProgress > 0) {
      const pct = lz.stayProgress / lz.stayRequired;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, lz.radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }

    // 5. Overhead Label
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 8;
    const label = lz.stayProgress > 0
      ? `EVACUATING: ${Math.round((lz.stayProgress / lz.stayRequired) * 100)}%`
      : `[EXTRACTION ZONE - ${Math.ceil(this.extractionTimer)}s]`;
    ctx.fillText(label, 0, -lz.radius - 16);

    ctx.restore();
  }
}
