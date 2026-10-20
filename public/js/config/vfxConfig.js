/**
 * ============================================================================
 * CYBERPUNK NEON SURVIVORS - MODULE 3: CENTRALIZED VFX & HAZARD CONFIGURATION
 * ============================================================================
 * Hệ thống quản lý cấu hình tập trung cho toàn bộ:
 * 1. Arena Hazards (Hiểm họa Đấu trường & Biome Spawns)
 * 2. Camera FX & Screen Shake Dynamics (Zoom Punch, Kickback, Trauma)
 * 3. Screen FX & Post-Processing (Vignette nhịp tim, Glitch Slicing, Bullet-Time, Flash)
 * 4. Particle Hazard VFX Emitters
 *
 * Cho phép tùy biến trực tiếp trong code, batch update, hoặc runtime overrides.
 */

export const DEFAULT_VFX_CONFIG = {
  // --------------------------------------------------------------------------
  // 1. ARENA HAZARDS CONFIGURATION (HIỂM HỌA CHIẾN TRƯỜNG)
  // --------------------------------------------------------------------------
  hazards: {
    // Cài đặt chung cho toàn bộ hệ thống Hazard
    global: {
      enabled: true,
      tickInterval: 0.25, // Chu kỳ gây sát thương DoT (giây)
      friendlyFireToEnemies: true, // Hazard có gây sát thương lên quái vật không
      dashInvulnerable: true, // Player đang Dash có miễn nhiễm sát thương không
      enemyDamageMultiplier: 1.5, // Hệ số nhân sát thương khi tác động lên quái vật
    },

    // A. Acid Pool (Vũng Axit - Sector 02: Acid Matrix)
    acid_pool: {
      id: 'acid_pool',
      name: 'Toxic Acid Vat',
      biomeId: 'acid_matrix',
      defaultRadius: 65,
      dps: 18,
      slowFactor: 0.65, // Giảm 35% tốc độ di chuyển
      color: '#34d399',
      glowColor: 'rgba(52, 211, 153, 0.4)',
      bubbleSpawnInterval: 0.18,
      bubbleCount: 2,
    },

    // B. EMP Arc Conduit (Cột Phóng Điện Hồ Quang - Sector 01: Neon Core)
    emp_conduit: {
      id: 'emp_conduit',
      name: 'High-Voltage EMP Arc',
      biomeId: 'neon_core',
      pylonDist: 180,
      pylonRadius: 14,
      chargeDuration: 1.4, // Thời gian tích điện cảnh báo (giây)
      activeDuration: 0.85, // Thời gian phóng tia sét (giây)
      cooldownDuration: 2.0, // Thời gian hồi (giây)
      damage: 32,
      shockTrauma: 0.35, // Độ rung camera khi bị giật
      color: '#00f0ff',
      glowColor: 'rgba(0, 240, 255, 0.6)',
      sparkRate: 0.2,
    },

    // C. Thermal Magma Vent (Miệng Phun Nham Thạch - Sector 03: Crimson Foundry)
    magma_vent: {
      id: 'magma_vent',
      name: 'Thermal Magma Vent',
      biomeId: 'crimson_foundry',
      defaultRadius: 75,
      dormantDuration: 2.5, // Trạng thái ngầm âm ỉ (giây)
      warningDuration: 1.2, // Trạng thái cảnh báo viền đỏ (giây)
      eruptDuration: 0.75, // Trạng thái phun trào dung nham (giây)
      damage: 48,
      eruptTrauma: 0.45,
      scorchRadiusMultiplier: 0.9,
      color: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.7)',
      fireEruptionCount: 20,
    },

    // D. Quantum Singularity (Hố Đen Trọng Lực - Sector 04: Quantum Void)
    quantum_singularity: {
      id: 'quantum_singularity',
      name: 'Quantum Gravity Well',
      biomeId: 'quantum_void',
      pullRadius: 240, // Bán kính tác động lực kéo (px)
      pullForce: 130, // Cường độ lực hút
      coreRadius: 40, // Bán kính tâm hố đen gây sát thương nghiền nát (px)
      dps: 28,
      swirlRate: 0.12,
      color: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.6)',
    },

    // E. Solar Radiation Death Ray (Tia Laser Quang Học - Sector 05: Solar Archology)
    solar_laser: {
      id: 'solar_laser',
      name: 'Solar Topaz Death Ray',
      biomeId: 'solar_archology',
      beamLength: 320, // Chiều dài chùm laser (px)
      beamWidth: 8, // Độ dày chùm tia (px)
      rotSpeed: 0.8, // Tốc độ quay (rad/s)
      dps: 45,
      burnTrauma: 0.2,
      color: '#facc15',
      glowColor: 'rgba(250, 204, 21, 0.7)',
    },
  },

  // --------------------------------------------------------------------------
  // 2. BIOME HAZARD SPAWN TEMPLATES (BỐ TRÍ HAZARD THEO TỪNG BẢN ĐỒ)
  // --------------------------------------------------------------------------
  biomeSpawns: {
    acid_matrix: [
      { type: 'acid_pool', offsetX: -500, offsetY: -500, radius: 75 },
      { type: 'acid_pool', offsetX: 500, offsetY: -500, radius: 85 },
      { type: 'acid_pool', offsetX: -500, offsetY: 500, radius: 80 },
      { type: 'acid_pool', offsetX: 500, offsetY: 500, radius: 90 },
    ],
    neon_core: [
      { type: 'emp_conduit', offsetX: -600, offsetY: -250, x2Offset: -350, y2Offset: -250 },
      { type: 'emp_conduit', offsetX: 350, offsetY: 250, x2Offset: 600, y2Offset: 250 },
      { type: 'emp_conduit', offsetX: -120, offsetY: -550, x2Offset: 120, y2Offset: -550 },
    ],
    crimson_foundry: [
      { type: 'magma_vent', offsetX: -350, offsetY: -350, radius: 80 },
      { type: 'magma_vent', offsetX: 350, offsetY: -350, radius: 85 },
      { type: 'magma_vent', offsetX: -350, offsetY: 350, radius: 85 },
      { type: 'magma_vent', offsetX: 350, offsetY: 350, radius: 80 },
    ],
    quantum_void: [
      { type: 'quantum_singularity', offsetX: -450, offsetY: 0, pullRadius: 260 },
      { type: 'quantum_singularity', offsetX: 450, offsetY: 0, pullRadius: 260 },
    ],
    solar_archology: [
      { type: 'solar_laser', offsetX: -400, offsetY: 0, rotSpeed: 0.6, beamLength: 350 },
      { type: 'solar_laser', offsetX: 400, offsetY: 0, rotSpeed: -0.6, beamLength: 350 },
    ],
    glitch_overclock: [
      { type: 'emp_conduit', offsetX: -200, offsetY: -350, x2Offset: 200, y2Offset: -350 },
      { type: 'magma_vent', offsetX: -350, offsetY: 300, radius: 85 },
      { type: 'acid_pool', offsetX: 350, offsetY: 300, radius: 85 },
    ],
  },

  // --------------------------------------------------------------------------
  // 3. CAMERA DYNAMICS & SHAKE ENGINE CONFIGURATION
  // --------------------------------------------------------------------------
  camera: {
    lerpSpeed: 9.0, // Tốc độ bám đuổi Player của Camera
    traumaDecay: 1.2, // Tốc độ giảm rung chấn mỗi giây
    maxShakeAngle: 0.05, // Góc xoay lắc tối đa (radians)
    maxShakeOffset: 25, // Độ lệch giật tối đa (pixels)
    shakeFrequency: 35, // Tần số dao động sóng điều hòa
    shakeMultiplier: 1.0, // Hệ số rung toàn cục (0.0 - 1.5)

    // Dynamic Zoom & FOV Punch
    zoom: {
      defaultZoom: 1.0,
      minZoom: 0.6,
      maxZoom: 1.8,
      defaultReturnSpeed: 7.0,
      dashPunchAmount: 0.06,
      damagePunchAmount: 0.06,
      eliteDeathPunchAmount: 0.06,
      bossDeathPunchAmount: 0.12,
      sectorTransitionPunchAmount: 0.08,
    },

    // Directional Recoil Kickback
    kickback: {
      defaultDecay: 15.0,
      dashKickStrength: 10,
    },
  },

  // --------------------------------------------------------------------------
  // 4. SCREEN FX & POST-PROCESSING PASSES
  // --------------------------------------------------------------------------
  screenFx: {
    // A. Low-Health Emergency Pulse Vignette (Viền nhịp tim khi nguy cấp)
    lowHealthVignette: {
      enabled: true,
      threshold: 0.35, // Kích hoạt khi HP < 35%
      heartbeatFrequency: 0.009, // Tần số đập nhịp tim
      minAlpha: 0.2,
      maxAlpha: 0.55,
      edgeDangerBorder: true,
      dangerBorderWidth: 3,
      primaryColor: 'rgba(255, 0, 60, ',
      secondaryColor: 'rgba(180, 0, 40, ',
    },

    // B. Screen Glitch Redline Slice Distortion (Nhiễu sọc quét điện tử)
    glitchSlicing: {
      enabled: true,
      sliceMultiplier: 7,
      baseSlices: 2,
      maxSliceHeight: 16,
      displacementX: 28,
      primaryColor: 'rgba(255, 0, 85, 0.15)',
      counterColor: 'rgba(0, 240, 255, 0.12)',
    },

    // C. Bullet-Time Cyberpunk Chrono-Focus Edge Tint
    bulletTimeFocus: {
      enabled: true,
      innerRatio: 0.25,
      coronaColor: 'rgba(0, 240, 255, 0.22)',
    },

    // D. Fullscreen Atmospheric Flash Wash (Chớp sáng toàn cảnh)
    fullscreenFlash: {
      enabled: true,
      defaultDuration: 0.35,
      defaultColor: 'rgba(0, 240, 255, 0.45)',
      bossKillColor: 'rgba(255, 0, 85, 0.45)',
      eliteKillColor: 'rgba(255, 215, 0, 0.3)',
    },
  },
};

/**
 * Deep clone helper để đảm bảo cấu hình gốc không bị can thiệp ngoài ý muốn
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
  const clone = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key]);
  }
  return clone;
}

/**
 * Deep merge helper hỗ trợ batch updates
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Lớp Quản Lý Cấu Hình Tập Trung Module 3 (VfxConfigManager)
 */
export class VfxConfigManager {
  constructor() {
    this._config = deepClone(DEFAULT_VFX_CONFIG);
  }

  /**
   * Truy xuất toàn bộ cấu hình hiện tại
   */
  getAll() {
    return this._config;
  }

  /**
   * Đọc giá trị cấu hình theo đường dẫn dot-notation (vd: 'hazards.acid_pool.dps')
   */
  get(path, fallback = undefined) {
    if (!path) return this._config;
    const parts = path.split('.');
    let curr = this._config;
    for (const part of parts) {
      if (curr === undefined || curr === null) return fallback;
      curr = curr[part];
    }
    return curr !== undefined ? curr : fallback;
  }

  /**
   * Gán giá trị cấu hình theo đường dẫn dot-notation
   */
  set(path, value) {
    const parts = path.split('.');
    let curr = this._config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object') {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
    return value;
  }

  /**
   * Tùy biến hàng loạt cấu hình bằng partial object
   * @param {Object} partialConfig Cấu hình cập nhật
   */
  update(partialConfig) {
    if (partialConfig && typeof partialConfig === 'object') {
      deepMerge(this._config, partialConfig);
    }
    return this._config;
  }

  /**
   * Khôi phục toàn bộ cấu hình về mặc định
   */
  reset() {
    this._config = deepClone(DEFAULT_VFX_CONFIG);
    return this._config;
  }

  /**
   * Truy xuất cấu hình của một loại Hazard cụ thể
   */
  getHazard(type) {
    if (!type) return null;
    const key = type.toLowerCase();
    const hazardCfg = this._config.hazards[key];
    if (!hazardCfg) return null;
    return Object.assign({}, this._config.hazards.global, hazardCfg);
  }

  /**
   * Đăng ký thêm Hazard Type mới hoặc ghi đè Hazard có sẵn
   */
  registerHazardType(id, config) {
    if (!id || typeof config !== 'object') return false;
    const key = id.toLowerCase();
    this._config.hazards[key] = Object.assign({ id: key }, config);
    return this._config.hazards[key];
  }

  /**
   * Lấy cấu hình Camera
   */
  getCameraConfig() {
    return this._config.camera;
  }

  /**
   * Lấy cấu hình Screen FX
   */
  getScreenFxConfig() {
    return this._config.screenFx;
  }

  /**
   * Lấy danh sách mẫu spawn hazard theo Biome
   */
  getBiomeSpawns(biomeId) {
    return this._config.biomeSpawns[biomeId] || [];
  }
}

// Singleton Instance xuất ra cho toàn bộ codebase
export const vfxConfig = new VfxConfigManager();
export const VFX_CONFIG = vfxConfig.getAll();
