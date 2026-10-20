/**
 * Cyberpunk Neon Survivors - Mobile Orientation, Fullscreen & Safe Area Insets Engine
 * Module 4: Mobile Responsive & Viewport Management Architecture
 */

export const ORIENTATION_TYPES = {
  LANDSCAPE_PRIMARY: 'landscape-primary',
  LANDSCAPE_SECONDARY: 'landscape-secondary',
  PORTRAIT_PRIMARY: 'portrait-primary',
  PORTRAIT_SECONDARY: 'portrait-secondary',
  LANDSCAPE: 'landscape',
  PORTRAIT: 'portrait',
};

/**
 * Pure helper to detect device orientation state with multi-tier fallback:
 * 1. Screen Orientation API (screen.orientation.type / angle)
 * 2. Window Orientation API (window.orientation: 0, 90, 180, -90/270)
 * 3. CSS MatchMedia query: (orientation: landscape) vs (orientation: portrait)
 * 4. Viewport Dimensions: (innerWidth >= innerHeight)
 */
export function detectOrientationState(win = null, scr = null) {
  const targetWin = win || (typeof window !== 'undefined' ? window : null);
  const targetScr = scr || targetWin?.screen || (typeof screen !== 'undefined' ? screen : null);

  let isLandscape = false;
  let angle = 0;
  let orientationType = ORIENTATION_TYPES.LANDSCAPE;

  // Tier 1: Modern Screen Orientation API
  if (targetScr && targetScr.orientation && typeof targetScr.orientation.type === 'string') {
    orientationType = targetScr.orientation.type;
    angle = targetScr.orientation.angle || 0;
    isLandscape = orientationType.startsWith('landscape');
  }
  // Tier 2: Legacy window.orientation (iOS Safari, older Android WebViews)
  else if (targetWin && typeof targetWin.orientation === 'number') {
    angle = targetWin.orientation;
    isLandscape = Math.abs(angle) === 90 || angle === 270;
    orientationType = isLandscape
      ? (angle === 90 ? ORIENTATION_TYPES.LANDSCAPE_PRIMARY : ORIENTATION_TYPES.LANDSCAPE_SECONDARY)
      : (angle === 180 ? ORIENTATION_TYPES.PORTRAIT_SECONDARY : ORIENTATION_TYPES.PORTRAIT_PRIMARY);
  }
  // Tier 3: CSS MatchMedia query
  else if (targetWin && typeof targetWin.matchMedia === 'function') {
    try {
      const mql = targetWin.matchMedia('(orientation: landscape)');
      if (mql && typeof mql.matches === 'boolean') {
        isLandscape = mql.matches;
        orientationType = isLandscape ? ORIENTATION_TYPES.LANDSCAPE : ORIENTATION_TYPES.PORTRAIT;
      }
    } catch (_) {
      // Ignore matchMedia evaluation failures
    }
  }

  // Tier 4: Fallback to Viewport Aspect Ratio / Dimensions
  if (!orientationType || (targetScr == null || !targetScr.orientation) && (targetWin == null || typeof targetWin.orientation !== 'number')) {
    const width = targetWin?.innerWidth ?? 1280;
    const height = targetWin?.innerHeight ?? 720;
    isLandscape = width >= height;
    orientationType = isLandscape ? ORIENTATION_TYPES.LANDSCAPE : ORIENTATION_TYPES.PORTRAIT;
  }

  return {
    isLandscape,
    isPortrait: !isLandscape,
    orientationType,
    angle,
    aspectRatio: targetWin ? ((targetWin.innerWidth || 1) / (targetWin.innerHeight || 1)) : 16 / 9,
  };
}

/**
 * Checks whether the current runtime is a mobile or touch-capable handheld device.
 */
export function isTouchOrMobileDevice(win = null, nav = null) {
  const targetWin = win || (typeof window !== 'undefined' ? window : null);
  const targetNav = nav || (typeof navigator !== 'undefined' ? navigator : null);
  if (!targetWin) return false;

  const hasTouch = ('ontouchstart' in targetWin) || ((targetNav?.maxTouchPoints ?? 0) > 0);
  let matchesPointerCoarse = false;

  if (typeof targetWin.matchMedia === 'function') {
    try {
      matchesPointerCoarse = targetWin.matchMedia('(pointer: coarse)').matches;
    } catch (_) {}
  }

  const isSmallScreen = Math.min(targetWin.innerWidth || 0, targetWin.innerHeight || 0) <= 900;
  const isMobileUA = Boolean(targetNav?.userAgent && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(targetNav.userAgent));

  return Boolean((hasTouch || matchesPointerCoarse) && (isSmallScreen || isMobileUA));
}

/**
 * Cross-browser Fullscreen capability detection & vendor prefix abstraction
 */
export function checkFullscreenSupport(doc = null, el = null) {
  const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
  if (!targetDoc) return { supported: false, vendor: 'none' };

  if ('fullscreenEnabled' in targetDoc || 'requestFullscreen' in (el || targetDoc.documentElement || {})) {
    return { supported: true, vendor: 'standard' };
  }
  if ('webkitFullscreenEnabled' in targetDoc || 'webkitRequestFullscreen' in (el || targetDoc.documentElement || {})) {
    return { supported: true, vendor: 'webkit' };
  }
  if ('mozFullScreenEnabled' in targetDoc || 'mozRequestFullScreen' in (el || targetDoc.documentElement || {})) {
    return { supported: true, vendor: 'moz' };
  }
  if ('msFullscreenEnabled' in targetDoc || 'msRequestFullscreen' in (el || targetDoc.documentElement || {})) {
    return { supported: true, vendor: 'ms' };
  }

  return { supported: false, vendor: 'none' };
}

/**
 * Pure calculation for Safe Area Inset boundary rectangle (accounting for Notches, Dynamic Island, and Home Bars)
 */
export function calculateSafeAreaRect({
  viewportWidth,
  viewportHeight,
  insets = { top: 0, right: 0, bottom: 0, left: 0 },
  minMargin = 12,
}) {
  const safeLeft = Math.max(minMargin, insets.left || 0);
  const safeRight = Math.max(minMargin, insets.right || 0);
  const safeTop = Math.max(minMargin, insets.top || 0);
  const safeBottom = Math.max(minMargin, insets.bottom || 0);

  const safeWidth = Math.max(0, viewportWidth - (safeLeft + safeRight));
  const safeHeight = Math.max(0, viewportHeight - (safeTop + safeBottom));

  // Determine which side the notch is situated on in Landscape orientation
  let notchSide = 'none';
  if (insets.left > insets.right && insets.left >= 20) {
    notchSide = 'left'; // Phone rotated counter-clockwise (Landscape Left)
  } else if (insets.right > insets.left && insets.right >= 20) {
    notchSide = 'right'; // Phone rotated clockwise (Landscape Right)
  } else if (insets.top >= 20) {
    notchSide = 'top'; // Portrait status bar / notch
  }

  return {
    safeLeft,
    safeRight,
    safeTop,
    safeBottom,
    safeWidth,
    safeHeight,
    notchSide,
    // Recommended coordinates for Virtual Joystick & Action Buttons
    recommendedJoystick: {
      x: safeLeft + 55,
      y: viewportHeight - safeBottom - 55,
      clearanceLeft: safeLeft,
    },
    recommendedActionButtons: {
      x: viewportWidth - safeRight - 80,
      y: viewportHeight - safeBottom - 80,
      clearanceRight: safeRight,
    },
  };
}

/**
 * MobileOrientationManager Class
 * Orchestrates Orientation Detection, Landscape Prompt Overlays, Fullscreen API, and Safe Area Insets.
 */
export class MobileOrientationManager {
  constructor(options = {}) {
    this.options = options;
    this.promptElement = options.promptElement || null;
    this.fullscreenBtn = options.fullscreenBtn || null;
    this.bypassPrompt = Boolean(options.bypassPrompt);
    this.pseudoFullscreenActive = false;

    // Simulated/cached safe insets
    this.safeAreaInsets = {
      top: options.insets?.top ?? 0,
      right: options.insets?.right ?? 0,
      bottom: options.insets?.bottom ?? 0,
      left: options.insets?.left ?? 0,
    };

    this.listeners = {
      orientation: new Set(),
      fullscreen: new Set(),
      safeArea: new Set(),
    };

    this.debounceTimer = null;
    this.debounceDelay = options.debounceDelay ?? 150; // 150ms debounce for iOS Safari viewport stabilization
  }

  get currentWin() {
    return this.options.win || (typeof window !== 'undefined' ? window : null);
  }

  get currentDoc() {
    return this.options.doc || (typeof document !== 'undefined' ? document : null);
  }

  get currentNav() {
    return this.options.nav || (typeof navigator !== 'undefined' ? navigator : null);
  }

  get currentScr() {
    return this.options.scr || this.currentWin?.screen || (typeof screen !== 'undefined' ? screen : null);
  }

  /**
   * Reads current orientation state
   */
  getState() {
    return detectOrientationState(this.currentWin, this.currentScr);
  }

  /**
   * Returns true if device is in landscape mode
   */
  isLandscape() {
    return this.getState().isLandscape;
  }

  /**
   * Returns true if device is in portrait mode
   */
  isPortrait() {
    return this.getState().isPortrait;
  }

  /**
   * Returns current aspect ratio (width / height)
   */
  getAspectRatio() {
    const w = this.currentWin?.innerWidth || 1280;
    const h = this.currentWin?.innerHeight || 720;
    return w / h;
  }

  /**
   * Evaluates if the "Rotate to Landscape" prompt overlay should be visible.
   */
  shouldShowPrompt() {
    if (this.bypassPrompt) return false;
    const isMobile = isTouchOrMobileDevice(this.currentWin, this.currentNav);
    const state = this.getState();

    // Show prompt only if on mobile/touch device AND currently in Portrait mode
    return isMobile && state.isPortrait;
  }

  /**
   * Bypasses the rotate prompt for users who insist on playing in portrait
   */
  dismissPrompt(bypass = true) {
    this.bypassPrompt = bypass;
    this.updatePromptDisplay();
  }

  /**
   * Updates prompt overlay DOM element visibility
   */
  updatePromptDisplay() {
    if (!this.promptElement) return;

    if (this.shouldShowPrompt()) {
      this.promptElement.classList.remove('hidden');
      this.promptElement.setAttribute('aria-hidden', 'false');
    } else {
      this.promptElement.classList.add('hidden');
      this.promptElement.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Attempts to lock the screen to landscape using Screen Orientation API
   */
  async lockLandscape() {
    const scr = this.currentScr;
    try {
      if (scr?.orientation && typeof scr.orientation.lock === 'function') {
        await scr.orientation.lock('landscape');
        return true;
      }
      if (scr && typeof scr.lockOrientation === 'function') {
        return scr.lockOrientation('landscape');
      }
    } catch (err) {
      // Many mobile browsers reject lock() unless in fullscreen or PWA mode
      return false;
    }
    return false;
  }

  /**
   * Fullscreen API: Returns true if currently in fullscreen (or pseudo-fullscreen)
   */
  isFullscreen() {
    if (this.pseudoFullscreenActive) return true;
    const doc = this.currentDoc;
    if (!doc) return false;

    return Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }

  /**
   * Requests Fullscreen on target element with multi-vendor and pseudo-fullscreen fallback
   */
  async requestFullscreen(targetElement = null) {
    const doc = this.currentDoc;
    const el = targetElement || doc?.documentElement;
    if (!el) return false;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        this._notifyFullscreen(true);
        return true;
      }
      if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        this._notifyFullscreen(true);
        return true;
      }
      if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
        this._notifyFullscreen(true);
        return true;
      }
      if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
        this._notifyFullscreen(true);
        return true;
      }
    } catch (err) {
      // Permission denied or missing user gesture (e.g. NotAllowedError)
      // Fallback cleanly to pseudo-fullscreen (CSS viewport lock)
      this.enablePseudoFullscreen(el);
      return false;
    }

    // If native fullscreen is completely unsupported (iOS Safari on iPhone)
    this.enablePseudoFullscreen(el);
    return true;
  }

  /**
   * Exits Fullscreen cross-browser
   */
  async exitFullscreen() {
    if (this.pseudoFullscreenActive) {
      this.disablePseudoFullscreen();
      return true;
    }

    const doc = this.currentDoc;
    if (!doc) return false;

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
        this._notifyFullscreen(false);
        return true;
      }
      if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        this._notifyFullscreen(false);
        return true;
      }
      if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        this._notifyFullscreen(false);
        return true;
      }
      if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
        this._notifyFullscreen(false);
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  /**
   * Toggles fullscreen state
   */
  async toggleFullscreen(targetElement = null) {
    if (this.isFullscreen()) {
      return await this.exitFullscreen();
    } else {
      return await this.requestFullscreen(targetElement);
    }
  }

  /**
   * Pseudo-Fullscreen mode: Emulates fullscreen using 100vw x 100vh CSS fixed overlay
   * Critical fallback for iOS Safari handheld devices.
   */
  enablePseudoFullscreen(el = null) {
    this.pseudoFullscreenActive = true;
    const target = el || this.currentDoc?.documentElement;
    if (target?.classList) {
      target.classList.add('pseudo-fullscreen');
    }
    this._notifyFullscreen(true);
  }

  disablePseudoFullscreen(el = null) {
    this.pseudoFullscreenActive = false;
    const target = el || this.currentDoc?.documentElement;
    if (target?.classList) {
      target.classList.remove('pseudo-fullscreen');
    }
    this._notifyFullscreen(false);
  }

  /**
   * Updates Fullscreen HUD Button Icon and text
   */
  updateFullscreenBtnUI() {
    if (!this.fullscreenBtn) return;
    const active = this.isFullscreen();
    const icon = this.fullscreenBtn.querySelector('i');
    const label = this.fullscreenBtn.querySelector('.fs-label');

    if (icon) {
      icon.className = active
        ? 'fa-solid fa-compress text-[10px] sm:text-xs'
        : 'fa-solid fa-expand text-[10px] sm:text-xs';
    }
    if (label) {
      label.innerText = active ? 'THU NHỎ' : 'TOÀN MÀN';
    }
  }

  /**
   * Safe Area Insets calculation and adaptation
   */
  setSafeAreaInsets(insets) {
    this.safeAreaInsets = {
      top: Math.max(0, insets.top || 0),
      right: Math.max(0, insets.right || 0),
      bottom: Math.max(0, insets.bottom || 0),
      left: Math.max(0, insets.left || 0),
    };
    this._notifySafeArea(this.safeAreaInsets);
  }

  /**
   * Automatically inspects computed CSS safe-area-insets or uses orientation heuristic
   */
  computeSafeAreaInsets() {
    const win = this.currentWin;
    const doc = this.currentDoc;
    if (!win || !doc) return this.safeAreaInsets;

    // Check if CSS env variables are simulated in style
    try {
      const computed = win.getComputedStyle(doc.documentElement);
      const top = parseFloat(computed.getPropertyValue('--safe-area-top') || computed.getPropertyValue('padding-top') || '0');
      const right = parseFloat(computed.getPropertyValue('--safe-area-right') || computed.getPropertyValue('padding-right') || '0');
      const bottom = parseFloat(computed.getPropertyValue('--safe-area-bottom') || computed.getPropertyValue('padding-bottom') || '0');
      const left = parseFloat(computed.getPropertyValue('--safe-area-left') || computed.getPropertyValue('padding-left') || '0');

      if (top || right || bottom || left) {
        this.safeAreaInsets = { top, right, bottom, left };
        return this.safeAreaInsets;
      }
    } catch (_) {}

    // Fallback heuristic based on orientation & device
    const state = this.getState();
    const isMobile = isTouchOrMobileDevice(this.currentWin, this.currentNav);

    if (isMobile) {
      // iPhone / Android Notch in Landscape
      if (state.isLandscape) {
        if (state.angle === 90 || state.orientationType === ORIENTATION_TYPES.LANDSCAPE_PRIMARY) {
          // Notch on the left, home bar on bottom
          this.safeAreaInsets = { top: 0, right: 0, bottom: 21, left: 47 };
        } else if (state.angle === 270 || state.angle === -90 || state.orientationType === ORIENTATION_TYPES.LANDSCAPE_SECONDARY) {
          // Notch on the right, home bar on bottom
          this.safeAreaInsets = { top: 0, right: 47, bottom: 21, left: 0 };
        } else {
          this.safeAreaInsets = { top: 0, right: 24, bottom: 21, left: 24 };
        }
      } else {
        // Portrait: notch on top, home bar on bottom
        this.safeAreaInsets = { top: 47, right: 0, bottom: 34, left: 0 };
      }
    }

    return this.safeAreaInsets;
  }

  /**
   * Computes Safe Boundary Zone for HUD and Virtual Touch Controllers
   */
  getSafeBounds(minMargin = 12) {
    const width = this.currentWin?.innerWidth || 1280;
    const height = this.currentWin?.innerHeight || 720;
    return calculateSafeAreaRect({
      viewportWidth: width,
      viewportHeight: height,
      insets: this.safeAreaInsets,
      minMargin,
    });
  }

  /**
   * Event Listeners Registration
   */
  onOrientationChange(fn) {
    this.listeners.orientation.add(fn);
    return () => this.listeners.orientation.delete(fn);
  }

  onFullscreenChange(fn) {
    this.listeners.fullscreen.add(fn);
    return () => this.listeners.fullscreen.delete(fn);
  }

  onSafeAreaChange(fn) {
    this.listeners.safeArea.add(fn);
    return () => this.listeners.safeArea.delete(fn);
  }

  _notifyOrientation(state) {
    for (const fn of this.listeners.orientation) {
      try { fn(state); } catch (e) { console.error('Orientation listener error:', e); }
    }
  }

  _notifyFullscreen(isFullscreen) {
    this.updateFullscreenBtnUI();
    for (const fn of this.listeners.fullscreen) {
      try { fn(isFullscreen); } catch (e) { console.error('Fullscreen listener error:', e); }
    }
  }

  _notifySafeArea(insets) {
    for (const fn of this.listeners.safeArea) {
      try { fn(insets); } catch (e) { console.error('SafeArea listener error:', e); }
    }
  }

  /**
   * Sets up system event hooks on window and document
   */
  setupEventListeners() {
    const win = this.currentWin;
    const doc = this.currentDoc;
    if (!win) return;

    const handleResizeOrOrientation = () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.computeSafeAreaInsets();
        this.updatePromptDisplay();
        const state = this.getState();
        this._notifyOrientation(state);
      }, this.debounceDelay);
    };

    win.addEventListener('resize', handleResizeOrOrientation);
    win.addEventListener('orientationchange', handleResizeOrOrientation);

    if (win.visualViewport) {
      win.visualViewport.addEventListener('resize', handleResizeOrOrientation);
    }

    if (doc) {
      const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
      fsEvents.forEach(evt => {
        doc.addEventListener(evt, () => {
          this._notifyFullscreen(this.isFullscreen());
        });
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleFullscreen();
      });
    }
  }
}

export const OrientationManager = MobileOrientationManager;
