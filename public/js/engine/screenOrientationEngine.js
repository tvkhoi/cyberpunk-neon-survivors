/**
 * ScreenOrientationEngine
 * Cyberpunk Neon Survivors - Module 1: Mobile Fullscreen & Orientation Lock Engine
 * 
 * Unified cross-browser engine providing:
 * - Screen Orientation API (screen.orientation.lock / unlock with vendor fallbacks)
 * - Fullscreen API (standard & vendor prefixes: webkit, moz, ms)
 * - Landscape / Portrait orientation detection (matchMedia, screen.orientation, innerWidth/innerHeight)
 * - One-touch Landscape + Fullscreen toggle for mobile gaming HUD
 * - Responsive rotation guidance & portrait warning detection
 */

export class ScreenOrientationEngine {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.targetElement] - Element to request fullscreen on (defaults to document.documentElement)
   * @param {Function} [options.onOrientationChange] - Callback when orientation changes
   * @param {Function} [options.onFullscreenChange] - Callback when fullscreen state changes
   */
  constructor(options = {}) {
    this.targetElement = options.targetElement || (typeof document !== 'undefined' ? document.documentElement : null);
    this.orientationCallbacks = [];
    this.fullscreenCallbacks = [];
    this.lastKnownOrientation = null;
    this.lastKnownFullscreen = false;

    if (options.onOrientationChange) {
      this.orientationCallbacks.push(options.onOrientationChange);
    }
    if (options.onFullscreenChange) {
      this.fullscreenCallbacks.push(options.onFullscreenChange);
    }

    this._boundHandleOrientationChange = this._handleOrientationChange.bind(this);
    this._boundHandleFullscreenChange = this._handleFullscreenChange.bind(this);
    this._boundHandleResize = this._handleResize.bind(this);

    this._attachListeners();
  }

  /**
   * Safely obtain global window object
   * @returns {Window|null}
   */
  _getWindow() {
    return typeof window !== 'undefined' ? window : null;
  }

  /**
   * Safely obtain global document object
   * @returns {Document|null}
   */
  _getDocument() {
    return typeof document !== 'undefined' ? document : null;
  }

  /**
   * Safely obtain global screen object
   * @returns {Screen|null}
   */
  _getScreen() {
    const win = this._getWindow();
    return win && win.screen ? win.screen : null;
  }

  /**
   * Attach all cross-browser event listeners for orientation and fullscreen changes
   * @private
   */
  _attachListeners() {
    const win = this._getWindow();
    const doc = this._getDocument();
    const scr = this._getScreen();

    // 1. Screen Orientation API events
    if (scr && scr.orientation && typeof scr.orientation.addEventListener === 'function') {
      try {
        scr.orientation.addEventListener('change', this._boundHandleOrientationChange);
      } catch (e) {}
    }

    // 2. Window orientation change and resize events (fallback for Safari and older browsers)
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('orientationchange', this._boundHandleOrientationChange);
      win.addEventListener('resize', this._boundHandleResize);
    }

    // 3. Fullscreen change events across all vendor prefixes
    if (doc && typeof doc.addEventListener === 'function') {
      const fullscreenEventNames = [
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'MSFullscreenChange',
      ];
      fullscreenEventNames.forEach((eventName) => {
        try {
          doc.addEventListener(eventName, this._boundHandleFullscreenChange);
        } catch (e) {}
      });
    }

    this.lastKnownOrientation = this.getOrientationType();
    this.lastKnownFullscreen = this.isFullscreen();
  }

  /**
   * Remove all listeners to prevent memory leaks
   */
  destroy() {
    const win = this._getWindow();
    const doc = this._getDocument();
    const scr = this._getScreen();

    if (scr && scr.orientation && typeof scr.orientation.removeEventListener === 'function') {
      try {
        scr.orientation.removeEventListener('change', this._boundHandleOrientationChange);
      } catch (e) {}
    }

    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('orientationchange', this._boundHandleOrientationChange);
      win.removeEventListener('resize', this._boundHandleResize);
    }

    if (doc && typeof doc.removeEventListener === 'function') {
      const fullscreenEventNames = [
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'MSFullscreenChange',
      ];
      fullscreenEventNames.forEach((eventName) => {
        try {
          doc.removeEventListener(eventName, this._boundHandleFullscreenChange);
        } catch (e) {}
      });
    }

    this.orientationCallbacks = [];
    this.fullscreenCallbacks = [];
  }

  /**
   * Internal handler for orientation change
   * @private
   */
  _handleOrientationChange(e) {
    const currentOrientation = this.getOrientationType();
    const isLandscape = this.isLandscape();
    this.lastKnownOrientation = currentOrientation;

    const payload = {
      orientation: currentOrientation,
      isLandscape,
      event: e,
    };

    for (let i = 0; i < this.orientationCallbacks.length; i++) {
      try {
        this.orientationCallbacks[i](payload);
      } catch (err) {
        console.error('Error in orientation callback:', err);
      }
    }
  }

  /**
   * Internal debounced handler for window resize (which often accompanies rotation)
   * @private
   */
  _handleResize() {
    const currentOrientation = this.getOrientationType();
    if (currentOrientation !== this.lastKnownOrientation) {
      this._handleOrientationChange(null);
    }
  }

  /**
   * Internal handler for fullscreen change
   * @private
   */
  _handleFullscreenChange(e) {
    const isFs = this.isFullscreen();
    this.lastKnownFullscreen = isFs;

    const payload = {
      isFullscreen: isFs,
      fullscreenElement: this.getFullscreenElement(),
      event: e,
    };

    for (let i = 0; i < this.fullscreenCallbacks.length; i++) {
      try {
        this.fullscreenCallbacks[i](payload);
      } catch (err) {
        console.error('Error in fullscreen callback:', err);
      }
    }
  }

  /**
   * Subscribe to orientation change events
   * @param {Function} callback - Function receiving { orientation, isLandscape, event }
   * @returns {Function} Unsubscribe function
   */
  onOrientationChange(callback) {
    if (typeof callback === 'function') {
      this.orientationCallbacks.push(callback);
    }
    return () => {
      this.orientationCallbacks = this.orientationCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribe to fullscreen change events
   * @param {Function} callback - Function receiving { isFullscreen, fullscreenElement, event }
   * @returns {Function} Unsubscribe function
   */
  onFullscreenChange(callback) {
    if (typeof callback === 'function') {
      this.fullscreenCallbacks.push(callback);
    }
    return () => {
      this.fullscreenCallbacks = this.fullscreenCallbacks.filter((cb) => cb !== callback);
    };
  }

  // ==========================================
  // ORIENTATION DETECTION & LOGIC
  // ==========================================

  /**
   * Detects if device / viewport is currently in landscape orientation
   * Robust multi-tier detection:
   * 1. Screen Orientation API type ('landscape-primary' / 'landscape-secondary')
   * 2. CSS media query '(orientation: landscape)'
   * 3. Viewport width >= height
   * 4. Legacy window.orientation (90 or -90)
   * @returns {boolean}
   */
  isLandscape() {
    const scr = this._getScreen();
    const win = this._getWindow();

    // 1. Standard screen.orientation
    if (scr && scr.orientation && typeof scr.orientation.type === 'string') {
      if (scr.orientation.type.startsWith('landscape')) return true;
      if (scr.orientation.type.startsWith('portrait')) return false;
    }

    // 2. CSS matchMedia query
    if (win && typeof win.matchMedia === 'function') {
      try {
        const mq = win.matchMedia('(orientation: landscape)');
        if (typeof mq.matches === 'boolean') {
          return mq.matches;
        }
      } catch (e) {}
    }

    // 3. Dimensions comparison
    if (win && typeof win.innerWidth === 'number' && typeof win.innerHeight === 'number') {
      return win.innerWidth >= win.innerHeight;
    }

    // 4. Legacy window.orientation (-90, 90 is landscape)
    if (win && typeof win.orientation === 'number') {
      return Math.abs(win.orientation) === 90;
    }

    return true; // Default to landscape on standard desktop environments
  }

  /**
   * Get detailed current orientation string
   * @returns {string} e.g. 'landscape-primary', 'portrait-primary', 'landscape', 'portrait'
   */
  getOrientationType() {
    const scr = this._getScreen();
    if (scr && scr.orientation && typeof scr.orientation.type === 'string') {
      return scr.orientation.type;
    }
    return this.isLandscape() ? 'landscape-primary' : 'portrait-primary';
  }

  /**
   * Check if Screen Orientation Lock API is supported by the current browser
   * @returns {boolean}
   */
  isOrientationLockSupported() {
    const scr = this._getScreen();
    if (!scr) return false;

    if (scr.orientation && typeof scr.orientation.lock === 'function') {
      return true;
    }

    // Check legacy vendor methods
    return Boolean(
      typeof scr.lockOrientation === 'function' ||
      typeof scr.mozLockOrientation === 'function' ||
      typeof scr.msLockOrientation === 'function'
    );
  }

  /**
   * Lock screen orientation to landscape
   * Uses modern Screen Orientation API with fallback to vendor prefixes and landscape-primary
   * @param {string} [mode='landscape'] - 'landscape', 'landscape-primary', 'landscape-secondary'
   * @returns {Promise<{ success: boolean, method: string, error?: string }>}
   */
  async lockLandscape(mode = 'landscape') {
    const scr = this._getScreen();
    if (!scr) {
      return { success: false, method: 'none', error: 'Screen object not available' };
    }

    // 1. Try modern screen.orientation.lock()
    if (scr.orientation && typeof scr.orientation.lock === 'function') {
      try {
        await scr.orientation.lock(mode);
        return { success: true, method: 'screen.orientation.lock' };
      } catch (err) {
        // Some browsers reject 'landscape' but accept 'landscape-primary'
        if (mode === 'landscape') {
          try {
            await scr.orientation.lock('landscape-primary');
            return { success: true, method: 'screen.orientation.lock(landscape-primary)' };
          } catch (fallbackErr) {
            // Proceed to vendor fallbacks
          }
        }
        // Save first error to report if all fail
        var modernError = err.message || String(err);
      }
    }

    // 2. Try legacy vendor prefixes
    const legacyMethods = ['lockOrientation', 'mozLockOrientation', 'msLockOrientation'];
    for (const methodName of legacyMethods) {
      if (typeof scr[methodName] === 'function') {
        try {
          const res = scr[methodName](mode);
          if (res !== false) {
            return { success: true, method: `screen.${methodName}` };
          }
        } catch (legacyErr) {}
      }
    }

    return {
      success: false,
      method: 'none',
      error: modernError || 'Orientation lock not supported or user gesture rejected',
    };
  }

  /**
   * Unlock screen orientation
   * @returns {{ success: boolean, method: string }}
   */
  unlockOrientation() {
    const scr = this._getScreen();
    if (!scr) return { success: false, method: 'none' };

    if (scr.orientation && typeof scr.orientation.unlock === 'function') {
      try {
        scr.orientation.unlock();
        return { success: true, method: 'screen.orientation.unlock' };
      } catch (e) {}
    }

    const legacyMethods = ['unlockOrientation', 'mozUnlockOrientation', 'msUnlockOrientation'];
    for (const methodName of legacyMethods) {
      if (typeof scr[methodName] === 'function') {
        try {
          scr[methodName]();
          return { success: true, method: `screen.${methodName}` };
        } catch (e) {}
      }
    }

    return { success: false, method: 'none' };
  }

  // ==========================================
  // FULLSCREEN API
  // ==========================================

  /**
   * Check if Fullscreen API is supported and enabled in current document
   * @returns {boolean}
   */
  isFullscreenEnabled() {
    const doc = this._getDocument();
    if (!doc) return false;

    return Boolean(
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
    );
  }

  /**
   * Check if document is currently in fullscreen mode
   * @returns {boolean}
   */
  isFullscreen() {
    return Boolean(this.getFullscreenElement());
  }

  /**
   * Get active fullscreen element across all vendor prefixes
   * @returns {Element|null}
   */
  getFullscreenElement() {
    const doc = this._getDocument();
    if (!doc) return null;

    return (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null
    );
  }

  /**
   * Request fullscreen for target element with full cross-browser fallback
   * @param {HTMLElement} [element] - Target element (defaults to this.targetElement or document.documentElement)
   * @returns {Promise<{ success: boolean, method: string, error?: string }>}
   */
  async requestFullscreen(element = this.targetElement) {
    const el = element || (this._getDocument() ? this._getDocument().documentElement : null);
    if (!el) {
      return { success: false, method: 'none', error: 'No target element available' };
    }

    // Prefix checking
    const methods = [
      { name: 'requestFullscreen', fn: el.requestFullscreen },
      { name: 'webkitRequestFullscreen', fn: el.webkitRequestFullscreen },
      { name: 'mozRequestFullScreen', fn: el.mozRequestFullScreen },
      { name: 'msRequestFullscreen', fn: el.msRequestFullscreen },
    ];

    for (const { name, fn } of methods) {
      if (typeof fn === 'function') {
        try {
          const promiseOrVoid = fn.call(el);
          if (promiseOrVoid && typeof promiseOrVoid.then === 'function') {
            await promiseOrVoid;
          }
          return { success: true, method: name };
        } catch (err) {
          return { success: false, method: name, error: err.message || String(err) };
        }
      }
    }

    return {
      success: false,
      method: 'none',
      error: 'Fullscreen API not supported on this browser or element',
    };
  }

  /**
   * Exit fullscreen mode with full cross-browser fallback
   * @returns {Promise<{ success: boolean, method: string, error?: string }>}
   */
  async exitFullscreen() {
    const doc = this._getDocument();
    if (!doc) {
      return { success: false, method: 'none', error: 'Document not available' };
    }

    if (!this.isFullscreen()) {
      return { success: true, method: 'none' };
    }

    const methods = [
      { name: 'exitFullscreen', fn: doc.exitFullscreen },
      { name: 'webkitExitFullscreen', fn: doc.webkitExitFullscreen },
      { name: 'mozCancelFullScreen', fn: doc.mozCancelFullScreen },
      { name: 'msExitFullscreen', fn: doc.msExitFullscreen },
    ];

    for (const { name, fn } of methods) {
      if (typeof fn === 'function') {
        try {
          const promiseOrVoid = fn.call(doc);
          if (promiseOrVoid && typeof promiseOrVoid.then === 'function') {
            await promiseOrVoid;
          }
          return { success: true, method: name };
        } catch (err) {
          return { success: false, method: name, error: err.message || String(err) };
        }
      }
    }

    return {
      success: false,
      method: 'none',
      error: 'Exit fullscreen not supported on this document',
    };
  }

  /**
   * Toggle fullscreen state
   * @param {HTMLElement} [element]
   * @returns {Promise<{ isFullscreen: boolean, success: boolean }>}
   */
  async toggleFullscreen(element = this.targetElement) {
    if (this.isFullscreen()) {
      const res = await this.exitFullscreen();
      return { isFullscreen: false, success: res.success };
    } else {
      const res = await this.requestFullscreen(element);
      return { isFullscreen: res.success, success: res.success };
    }
  }

  // ==========================================
  // ONE-TOUCH MOBILE COMBAT MODE:
  // LANDSCAPE + FULLSCREEN ORCHESTRATION
  // ==========================================

  /**
   * One-touch combat entry: Enter Fullscreen AND Lock Landscape Orientation
   * Chrome Android strictly requires Fullscreen before allowing screen.orientation.lock()
   * @param {HTMLElement} [element]
   * @returns {Promise<{ fullscreen: boolean, orientationLocked: boolean, error?: string }>}
   */
  async requestLandscapeAndFullscreen(element = this.targetElement) {
    let fsSuccess = false;
    let lockSuccess = false;
    let combinedError = null;

    // 1. Request Fullscreen first (critical for Android Chrome)
    try {
      if (!this.isFullscreen()) {
        const fsResult = await this.requestFullscreen(element);
        fsSuccess = fsResult.success;
        if (!fsSuccess && fsResult.error) combinedError = fsResult.error;
      } else {
        fsSuccess = true;
      }
    } catch (fsErr) {
      combinedError = fsErr.message || String(fsErr);
    }

    // 2. Lock Orientation to landscape
    try {
      const lockResult = await this.lockLandscape('landscape');
      lockSuccess = lockResult.success;
      if (!lockSuccess && lockResult.error && !combinedError) {
        combinedError = lockResult.error;
      }
    } catch (lockErr) {
      if (!combinedError) combinedError = lockErr.message || String(lockErr);
    }

    return {
      fullscreen: fsSuccess,
      orientationLocked: lockSuccess,
      error: combinedError,
    };
  }

  /**
   * Exit landscape lock and exit fullscreen
   * @returns {Promise<{ success: boolean }>}
   */
  async exitLandscapeAndFullscreen() {
    this.unlockOrientation();
    const fsRes = await this.exitFullscreen();
    return { success: fsRes.success };
  }

  /**
   * Toggle between Landscape Fullscreen Combat Mode and normal mode
   * @param {HTMLElement} [element]
   * @returns {Promise<{ active: boolean, success: boolean }>}
   */
  async toggleLandscapeMode(element = this.targetElement) {
    if (this.isFullscreen()) {
      await this.exitLandscapeAndFullscreen();
      return { active: false, success: true };
    } else {
      const res = await this.requestLandscapeAndFullscreen(element);
      const active = res.fullscreen || res.orientationLocked;
      return { active, success: active };
    }
  }

  // ==========================================
  // MOBILE DETECTION & ROTATION GUIDANCE
  // ==========================================

  /**
   * Detect if user is on a mobile / touch device
   * @returns {boolean}
   */
  isMobileDevice() {
    const win = this._getWindow();
    if (!win) return false;

    const nav = win.navigator;
    if (!nav) return false;

    const hasTouch = Boolean(
      'ontouchstart' in win ||
      (nav.maxTouchPoints && nav.maxTouchPoints > 0) ||
      (nav.msMaxTouchPoints && nav.msMaxTouchPoints > 0)
    );

    const ua = nav.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    return hasTouch || isMobileUA;
  }

  /**
   * Determines if a portrait warning overlay should be presented to the user
   * (Triggered only if device is mobile/touch AND currently in portrait mode)
   * @returns {boolean}
   */
  shouldShowPortraitPrompt() {
    return this.isMobileDevice() && !this.isLandscape();
  }
}

// Singleton instance for quick app-wide integration
export const screenOrientationEngine = new ScreenOrientationEngine();
