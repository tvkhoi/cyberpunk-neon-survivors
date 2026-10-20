/**
 * MobileScreenManager
 * Handles Fullscreen API, Screen Orientation Lock (Landscape), and Portrait Advisory Guards.
 */

export class MobileScreenManager {
  constructor(game, options = {}) {
    this.game = game;
    this.options = options;
    this.overlay = null;
    this.btnToggle = null;
    this.btnForce = null;
    this.isAutoPromptEnabled = true;
    this.hasUserInteracted = false;

    this.onOrientationChange = this.onOrientationChange.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
  }

  init() {
    if (typeof window === 'undefined') return;

    this.overlay = document.getElementById('portraitAdvisoryOverlay');
    this.btnToggle = document.getElementById('btnToggleFullscreen');
    this.btnForce = document.getElementById('btnForceFullscreenRotate');

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

    // Fullscreen change events across browsers
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.onFullscreenChange);

    // Orientation change events
    window.addEventListener('resize', this.onOrientationChange);
    window.addEventListener('orientationchange', () => {
      setTimeout(this.onOrientationChange, 150);
    });

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', this.onOrientationChange);
    }

    // Auto-request fullscreen & landscape on first user interaction (touch/click) on mobile
    const triggerFirstInteraction = () => {
      if (this.hasUserInteracted) return;
      this.hasUserInteracted = true;
      if (this.isMobileDevice()) {
        this.requestFullscreenAndLandscape().catch(() => {});
      }
      window.removeEventListener('touchstart', triggerFirstInteraction);
      window.removeEventListener('pointerdown', triggerFirstInteraction);
    };

    window.addEventListener('touchstart', triggerFirstInteraction, { passive: true, once: true });
    window.addEventListener('pointerdown', triggerFirstInteraction, { passive: true, once: true });

    // Initial check
    this.checkOrientationState();
  }

  isMobileDevice() {
    if (typeof window === 'undefined') return false;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const isTouch = ('ontouchstart' in window) || (nav && nav.maxTouchPoints > 0);
    const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 900;
    const isMobileUA = nav && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent);
    return Boolean(isTouch && (isSmallScreen || isMobileUA));
  }

  isPortrait() {
    if (typeof window === 'undefined') return false;
    if (window.screen && window.screen.orientation && window.screen.orientation.type) {
      return window.screen.orientation.type.startsWith('portrait');
    }
    return window.innerHeight > window.innerWidth;
  }

  isFullscreen() {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  async requestFullscreenAndLandscape() {
    if (typeof document === 'undefined') return;

    const docEl = document.documentElement;

    // 1. Fullscreen Request
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
        }
      }
    } catch (err) {
      // Fullscreen might be blocked by user agent policy without prior gesture
      console.warn('[MobileScreen] Fullscreen request rejected:', err);
    }

    // 2. Screen Orientation Lock (Landscape)
    try {
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
        await window.screen.orientation.lock('landscape');
      }
    } catch (err) {
      // Screen orientation lock might require user gesture or is unsupported on iOS Safari
      console.warn('[MobileScreen] Screen orientation lock rejected:', err);
    }

    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      setTimeout(() => this.game.resizeCanvas(), 100);
      setTimeout(() => this.game.resizeCanvas(), 300);
    }
  }

  async exitFullscreen() {
    if (typeof document === 'undefined') return;

    try {
      if (this.isFullscreen()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('[MobileScreen] Exit fullscreen rejected:', err);
    }

    try {
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
        window.screen.orientation.unlock();
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

    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      setTimeout(() => this.game.resizeCanvas(), 100);
      setTimeout(() => this.game.resizeCanvas(), 300);
    }
  }

  onOrientationChange() {
    this.checkOrientationState();
    if (this.game && typeof this.game.resizeCanvas === 'function') {
      this.game.resizeCanvas();
      setTimeout(() => this.game.resizeCanvas(), 150);
      setTimeout(() => this.game.resizeCanvas(), 400);
    }
  }

  checkOrientationState() {
    if (!this.overlay) return;

    // Show portrait advisory modal ONLY if device is mobile/touch and currently in portrait
    const isMob = this.isMobileDevice();
    const isPort = this.isPortrait();

    if (isMob && isPort && this.isAutoPromptEnabled) {
      this.overlay.classList.remove('hidden');
    } else {
      this.overlay.classList.add('hidden');
    }
  }
}
