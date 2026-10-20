/**
 * MobileScreenManager
 * Handles Fullscreen API, Screen Orientation Lock (Landscape), Safe Area Insets and Portrait Advisory Guards.
 * Module 4: Mobile Responsive & Viewport Management Architecture
 */

import {
  detectOrientationState,
  isTouchOrMobileDevice,
  checkFullscreenSupport,
  calculateSafeAreaRect,
  ORIENTATION_TYPES,
} from './orientationManager.js';

export class MobileScreenManager {
  constructor(game, options = {}) {
    this.game = game;
    this.options = options;

    this.overlay = null;
    this.btnToggle = null;
    this.btnForce = null;
    this.btnBypass = null;
    this.isAutoPromptEnabled = true;
    this.hasUserInteracted = false;
    this.bypassPrompt = false;
    this.pseudoFullscreenActive = false;
    this.wasAutoPausedByOrientation = false;

    // Safe Area Insets (pixels)
    this.safeAreaInsets = {
      top: options.insets?.top ?? 0,
      right: options.insets?.right ?? 0,
      bottom: options.insets?.bottom ?? 0,
      left: options.insets?.left ?? 0,
    };

    this.onOrientationChange = this.onOrientationChange.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
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

  init() {
    const win = this.currentWin;
    const doc = this.currentDoc;
    if (!win || !doc) return;

    this.overlay = doc.getElementById('portraitAdvisoryOverlay');
    this.btnToggle = doc.getElementById('btnToggleFullscreen');
    this.btnForce = doc.getElementById('btnForceFullscreenRotate');
    this.btnBypass = doc.getElementById('btnBypassOrientationPrompt');

    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });
    }

    if (this.btnForce) {
      this.btnForce.addEventListener('click', (e) => {
        e.stopPropagation();
        this.requestFullscreenAndLandscape();
      });
    }

    if (this.btnBypass) {
      this.btnBypass.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bypassPrompt = true;
        this.checkOrientationState();
      });
    }

    // Fullscreen change events across browsers
    doc.addEventListener('fullscreenchange', this.onFullscreenChange);
    doc.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    doc.addEventListener('mozfullscreenchange', this.onFullscreenChange);
    doc.addEventListener('MSFullscreenChange', this.onFullscreenChange);

    // Orientation change events
    win.addEventListener('resize', this.onOrientationChange);
    win.addEventListener('orientationchange', () => {
      setTimeout(this.onOrientationChange, 150);
    });

    if (win.screen && win.screen.orientation) {
      win.screen.orientation.addEventListener('change', this.onOrientationChange);
    }

    // Auto-request fullscreen & landscape on first user interaction (touch/click) on mobile
    const triggerFirstInteraction = () => {
      if (this.hasUserInteracted) return;
      this.hasUserInteracted = true;
      if (this.isMobileDevice()) {
        this.requestFullscreenAndLandscape().catch(() => {});
      }
      win.removeEventListener('touchstart', triggerFirstInteraction);
      win.removeEventListener('pointerdown', triggerFirstInteraction);
    };

    win.addEventListener('touchstart', triggerFirstInteraction, { passive: true, once: true });
    win.addEventListener('pointerdown', triggerFirstInteraction, { passive: true, once: true });

    // Initial check
    this.computeSafeAreaInsets();
    this.checkOrientationState();
  }

  isMobileDevice() {
    return isTouchOrMobileDevice(this.currentWin, this.currentNav);
  }

  isPortrait() {
    return detectOrientationState(this.currentWin, this.currentScr).isPortrait;
  }

  isLandscape() {
    return detectOrientationState(this.currentWin, this.currentScr).isLandscape;
  }

  getOrientationState() {
    return detectOrientationState(this.currentWin, this.currentScr);
  }

  getAspectRatio() {
    const w = this.currentWin?.innerWidth ?? 1280;
    const h = this.currentWin?.innerHeight ?? 720;
    return w / h;
  }

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

  async requestFullscreenAndLandscape() {
    const doc = this.currentDoc;
    if (!doc) return;

    const docEl = doc.documentElement;

    // 1. Fullscreen Request with vendor prefix & pseudo-fullscreen fallback
    try {
      if (!this.isFullscreen()) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen({ navigationUI: 'hide' });
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        } else {
          // iOS Safari fallback
          this.enablePseudoFullscreen(docEl);
        }
      }
    } catch (err) {
      // Fullscreen might be blocked by browser policy without user gesture
      console.warn('[MobileScreen] Fullscreen request rejected, using pseudo-fullscreen fallback:', err);
      this.enablePseudoFullscreen(docEl);
    }

    // 2. Screen Orientation Lock (Landscape)
    try {
      const scr = this.currentScr;
      if (scr?.orientation && typeof scr.orientation.lock === 'function') {
        await scr.orientation.lock('landscape');
      } else if (scr && typeof scr.lockOrientation === 'function') {
        scr.lockOrientation('landscape');
      }
    } catch (err) {
      console.warn('[MobileScreen] Screen orientation lock rejected:', err);
    }

    this.computeSafeAreaInsets();
    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      setTimeout(() => this.game.resizeCanvas(), 100);
      setTimeout(() => this.game.resizeCanvas(), 300);
    }
  }

  async exitFullscreen() {
    if (this.pseudoFullscreenActive) {
      this.disablePseudoFullscreen();
      this.checkOrientationState();
      return;
    }

    const doc = this.currentDoc;
    if (!doc) return;

    try {
      if (this.isFullscreen()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('[MobileScreen] Exit fullscreen rejected:', err);
    }

    try {
      const scr = this.currentScr;
      if (scr?.orientation && typeof scr.orientation.unlock === 'function') {
        scr.orientation.unlock();
      }
    } catch (err) {
      // Ignore
    }

    this.checkOrientationState();
  }

  toggleFullscreen() {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.requestFullscreenAndLandscape();
    }
  }

  enablePseudoFullscreen(el = null) {
    this.pseudoFullscreenActive = true;
    const target = el || this.currentDoc?.documentElement;
    if (target?.classList) {
      target.classList.add('pseudo-fullscreen-active');
    }
    this.onFullscreenChange();
  }

  disablePseudoFullscreen(el = null) {
    this.pseudoFullscreenActive = false;
    const target = el || this.currentDoc?.documentElement;
    if (target?.classList) {
      target.classList.remove('pseudo-fullscreen-active');
    }
    this.onFullscreenChange();
  }

  onFullscreenChange() {
    const isFull = this.isFullscreen();
    if (this.btnToggle) {
      const icon = this.btnToggle.querySelector('i');
      if (icon) {
        if (isFull) {
          icon.className = 'fa-solid fa-compress text-cyan-400';
          this.btnToggle.title = 'Thu nhỏ (Thoát Fullscreen)';
        } else {
          icon.className = 'fa-solid fa-expand text-cyan-400';
          this.btnToggle.title = 'Toàn màn hình & Xoay ngang';
        }
      }
    }

    if (this.btnToggleLandscape) {
      const icon = this.btnToggleLandscape.querySelector('#iconToggleLandscape') || this.btnToggleLandscape.querySelector('i');
      const text = this.btnToggleLandscape.querySelector('#textToggleLandscape') || this.btnToggleLandscape.querySelector('span');
      if (icon) {
        icon.className = isFull
          ? 'fa-solid fa-compress text-[10px] sm:text-xs text-amber-400'
          : 'fa-solid fa-expand text-[10px] sm:text-xs text-cyan-400';
      }
      if (text) {
        text.innerText = isFull ? 'THU NHỎ' : 'TOÀN MÀN HÌNH';
      }
      if (isFull) {
        this.btnToggleLandscape.classList.add('border-cyan-400', 'bg-cyan-950/90');
      } else {
        this.btnToggleLandscape.classList.remove('border-cyan-400', 'bg-cyan-950/90');
      }
    }

    if (this.btnTouchLandscape) {
      const icon = this.btnTouchLandscape.querySelector('i');
      if (icon) {
        icon.className = isFull
          ? 'fa-solid fa-compress text-[10px] sm:text-xs text-amber-400'
          : 'fa-solid fa-expand text-[10px] sm:text-xs text-cyan-400';
      }
    }

    const doc = this.currentDoc;
    if (this.btnSettingsToggleFullscreen && doc) {
      const text = doc.getElementById('textSettingsFullscreen');
      const icon = doc.getElementById('iconSettingsFullscreen');
      if (text) text.innerText = isFull ? 'Thoát Toàn Màn Hình' : 'Toàn Màn Hình';
      if (icon) icon.className = isFull ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    }

    this.computeSafeAreaInsets();
    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      setTimeout(() => this.game.resizeCanvas(), 100);
      setTimeout(() => this.game.resizeCanvas(), 300);
    }
  }

  onOrientationChange() {
    this.computeSafeAreaInsets();
    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      this.game.resizeCanvas();
      setTimeout(() => this.game.resizeCanvas(), 150);
      setTimeout(() => this.game.resizeCanvas(), 400);
    }
  }

  checkOrientationState() {
    if (this.badgeCurrentOrientation) {
      const isLand = this.isLandscape();
      this.badgeCurrentOrientation.innerText = isLand ? 'LANDSCAPE' : 'PORTRAIT';
      this.badgeCurrentOrientation.style.color = isLand ? '#00f0ff' : '#f43f5e';
      this.badgeCurrentOrientation.style.borderColor = isLand ? '#00f0ff66' : '#f43f5e66';
    }

    if (!this.overlay) return;

    // Show portrait advisory modal ONLY if device is mobile/touch and currently in portrait, unless user bypassed
    const isMob = this.isMobileDevice();
    const isPort = this.isPortrait();

    const shouldShow = Boolean(isMob && isPort && this.isAutoPromptEnabled && !this.bypassPrompt);

    if (shouldShow) {
      this.overlay.classList.remove('hidden');

      // UX Guard: Auto-Pause gameplay to protect the player during portrait orientation
      if (this.game && !this.game.isPaused && !this.game.isGameOver) {
        this.game.isPaused = true;
        this.wasAutoPausedByOrientation = true;
      }
    } else {
      this.overlay.classList.add('hidden');

      // UX Guard: Auto-Resume gameplay if it was auto-paused by orientation guard
      if (this.game && this.wasAutoPausedByOrientation) {
        this.game.isPaused = false;
        this.wasAutoPausedByOrientation = false;
        const win = this.currentWin;
        if (win && win.performance && typeof win.performance.now === 'function') {
          this.game.lastTime = win.performance.now();
        } else if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
          this.game.lastTime = performance.now();
        }
      }
    }
  }

  computeSafeAreaInsets() {
    const win = this.currentWin;
    const doc = this.currentDoc;
    if (!win) return this.safeAreaInsets;

    // If computed styles provide custom properties or safe area
    if (doc?.documentElement && typeof win.getComputedStyle === 'function') {
      try {
        const computed = win.getComputedStyle(doc.documentElement);
        const top = parseFloat(computed.getPropertyValue('--safe-area-top') || '0');
        const right = parseFloat(computed.getPropertyValue('--safe-area-right') || '0');
        const bottom = parseFloat(computed.getPropertyValue('--safe-area-bottom') || '0');
        const left = parseFloat(computed.getPropertyValue('--safe-area-left') || '0');

        if (top > 0 || right > 0 || bottom > 0 || left > 0) {
          this.safeAreaInsets = { top, right, bottom, left };
          return this.safeAreaInsets;
        }
      } catch (_) {}
    }

    // Heuristic safe area deduction
    const state = this.getOrientationState();
    const isMob = this.isMobileDevice();

    if (isMob) {
      if (state.isLandscape) {
        if (state.angle === 90 || state.orientationType === ORIENTATION_TYPES.LANDSCAPE_PRIMARY) {
          this.safeAreaInsets = { top: 0, right: 0, bottom: 21, left: 47 };
        } else if (state.angle === 270 || state.angle === -90 || state.orientationType === ORIENTATION_TYPES.LANDSCAPE_SECONDARY) {
          this.safeAreaInsets = { top: 0, right: 47, bottom: 21, left: 0 };
        } else {
          this.safeAreaInsets = { top: 0, right: 24, bottom: 21, left: 24 };
        }
      } else {
        this.safeAreaInsets = { top: 47, right: 0, bottom: 34, left: 0 };
      }
    }

    return this.safeAreaInsets;
  }

  getSafeBounds(minMargin = 12) {
    const width = this.currentWin?.innerWidth ?? 1280;
    const height = this.currentWin?.innerHeight ?? 720;
    return calculateSafeAreaRect({
      viewportWidth: width,
      viewportHeight: height,
      insets: this.safeAreaInsets,
      minMargin,
    });
  }
}
