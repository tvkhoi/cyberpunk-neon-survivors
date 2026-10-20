import { Game } from './game.js';
import { soundEngine } from './audio/soundEngine.js';
import { AVATARS } from './entities/player.js';
import { findNearestDrops } from './entities/drops.js';
import { MobileScreenManager } from './engine/mobileScreen.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
  window.game = game;
  const mobileScreen = new MobileScreenManager(game);
  mobileScreen.init();
  window.mobileScreen = mobileScreen;
  game.start();

  // --- Character Profile & Avatar Customization System ---
  const btnOpenProfile = document.getElementById('btnOpenProfile');
  const profileModal = document.getElementById('profileModal');
  const btnCloseProfile = document.getElementById('btnCloseProfile');
  const btnCancelProfile = document.getElementById('btnCancelProfile');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const customNameInput = document.getElementById('customNameInput');
  const avatarGrid = document.getElementById('avatarGrid');
  const hudPlayerName = document.getElementById('hudPlayerName');
  const hudAvatarIcon = document.getElementById('hudAvatarIcon');
  const finalAvatarBadge = document.getElementById('finalAvatarBadge');
  const playerNameInput = document.getElementById('playerNameInput');

  let selectedAvatarId = 'phantom';

  function renderAvatarCards() {
    if (!avatarGrid) return;
    avatarGrid.innerHTML = '';

    Object.values(AVATARS).forEach((av) => {
      const isSelected = av.id === selectedAvatarId;
      const card = document.createElement('div');
      card.className = `p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-center gap-2.5 sm:gap-3 ${
        isSelected
          ? 'avatar-card-selected'
          : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
      }`;
      card.innerHTML = `
        <div class="text-xl sm:text-2xl p-1.5 sm:p-2 rounded-lg bg-black/40 border border-slate-700/50 flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12" style="color: ${av.color}">${av.faIcon || av.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="font-bold font-hud text-[11px] sm:text-xs text-white truncate">${av.name}</span>
            <span class="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded font-mono tabular-nums font-bold flex-shrink-0" style="background-color: ${av.color}22; color: ${av.color}; border: 1px solid ${av.color}55">${av.id.toUpperCase()}</span>
          </div>
          <div class="text-[10px] sm:text-[11px] text-slate-300 font-desc mt-0.5">${av.desc}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectedAvatarId = av.id;
        soundEngine.init();
        soundEngine.playDash();
        renderAvatarCards();
      });

      avatarGrid.appendChild(card);
    });
  }

  function updateProfileHUD() {
    if (hudPlayerName) hudPlayerName.textContent = game.player.name;
    if (hudAvatarIcon) hudAvatarIcon.innerHTML = game.player.avatar.faIcon || game.player.avatar.icon;
    if (playerNameInput) playerNameInput.value = game.player.name;
    if (finalAvatarBadge) finalAvatarBadge.innerHTML = game.player.avatar.faIcon || game.player.avatar.icon;
  }

  // Load Saved Profile from LocalStorage
  try {
    const saved = localStorage.getItem('cyber_pilot_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.name || parsed.avatarId) {
        selectedAvatarId = parsed.avatarId || 'phantom';
        game.player.setProfile(parsed.name || 'CYBER_V', selectedAvatarId);
      }
    }
  } catch (err) {}
  updateProfileHUD();

  // Open Profile Modal
  if (btnOpenProfile) {
    btnOpenProfile.addEventListener('click', () => {
      game.isPaused = true;
      game.keys = {};
      selectedAvatarId = game.player.avatar.id;
      if (customNameInput) {
        customNameInput.value = game.player.name;
        setTimeout(() => customNameInput.focus(), 50);
      }
      renderAvatarCards();
      profileModal.classList.remove('hidden');
    });
  }

  const closeProfileModal = () => {
    profileModal.classList.add('hidden');
    game.keys = {};
    game.isPaused = false;
  };

  if (btnCloseProfile) btnCloseProfile.addEventListener('click', closeProfileModal);
  if (btnCancelProfile) btnCancelProfile.addEventListener('click', closeProfileModal);

  // Keyboard accessibility: ESC to close modals, Enter to save
  window.addEventListener('keydown', (e) => {
    // If typing inside an input element, do not trigger game modals
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.key === 'Escape') {
      if (profileModal && !profileModal.classList.contains('hidden')) {
        closeProfileModal();
        return;
      }
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
        return;
      }
      if (!game.isGameOver) {
        openSettingsModal();
        return;
      }
    }

    if ((e.code === 'KeyO' || e.key === 'o' || e.key === 'O') && !game.isGameOver) {
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
      } else if (!profileModal || profileModal.classList.contains('hidden')) {
        openSettingsModal();
      }
    }
  });

  if (customNameInput) {
    customNameInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        if (btnSaveProfile) btnSaveProfile.click();
      }
    });
    customNameInput.addEventListener('keyup', (e) => e.stopPropagation());
  }

  if (playerNameInput) {
    playerNameInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const btnSubmit = document.getElementById('btnSubmitScore');
        if (btnSubmit) btnSubmit.click();
      }
    });
    playerNameInput.addEventListener('keyup', (e) => e.stopPropagation());
  }

  // Save Profile Handler
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const newName = (customNameInput ? customNameInput.value.trim() : '') || 'CYBER_V';
      game.player.setProfile(newName, selectedAvatarId);
      try {
        localStorage.setItem(
          'cyber_pilot_profile',
          JSON.stringify({ name: newName, avatarId: selectedAvatarId })
        );
      } catch (err) {}
      updateProfileHUD();
      closeProfileModal();
    });
  }

  // ========================================================
  // CENTRALIZED SETTINGS & CYBER JUKEBOX CONTROLLER
  // ========================================================
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCloseSettingsFooter = document.getElementById('btnCloseSettingsFooter');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const hudMiniJukebox = document.getElementById('hudMiniJukebox');
  const hudNowPlayingTitle = document.getElementById('hudNowPlayingTitle');
  const btnAudio = document.getElementById('btnAudioToggle');

  // Tabs
  const tabBtnAudio = document.getElementById('tabBtnAudio');
  const tabBtnDisplay = document.getElementById('tabBtnDisplay');
  const tabContentAudio = document.getElementById('tabContentAudio');
  const tabContentDisplay = document.getElementById('tabContentDisplay');

  // Audio Sliders & Mutes
  const sliderMasterVolume = document.getElementById('sliderMasterVolume');
  const valMasterVolume = document.getElementById('valMasterVolume');
  const btnMuteMaster = document.getElementById('btnMuteMaster');

  const sliderMusicVolume = document.getElementById('sliderMusicVolume');
  const valMusicVolume = document.getElementById('valMusicVolume');
  const btnMuteMusic = document.getElementById('btnMuteMusic');

  const sliderSfxVolume = document.getElementById('sliderSfxVolume');
  const valSfxVolume = document.getElementById('valSfxVolume');
  const btnMuteSfx = document.getElementById('btnMuteSfx');

  // Jukebox Controller Elements
  const jukeboxTrackTitle = document.getElementById('jukeboxTrackTitle');
  const jukeboxTrackArtist = document.getElementById('jukeboxTrackArtist');
  const jukeboxTrackBadge = document.getElementById('jukeboxTrackBadge');
  const btnJukeboxPrev = document.getElementById('btnJukeboxPrev');
  const btnJukeboxPlayPause = document.getElementById('btnJukeboxPlayPause');
  const jukeboxPlayIcon = document.getElementById('jukeboxPlayIcon');
  const jukeboxPlayText = document.getElementById('jukeboxPlayText');
  const btnJukeboxNext = document.getElementById('btnJukeboxNext');
  const btnJukeboxShuffle = document.getElementById('btnJukeboxShuffle');
  const btnJukeboxRepeat = document.getElementById('btnJukeboxRepeat');

  // Add Songs Elements
  const btnUploadMusicFile = document.getElementById('btnUploadMusicFile');
  const musicFileInput = document.getElementById('musicFileInput');
  const musicUrlInput = document.getElementById('musicUrlInput');
  const musicNameInput = document.getElementById('musicNameInput');
  const btnAddMusicUrl = document.getElementById('btnAddMusicUrl');

  // Playlist list & Filter
  const filterFavoriteOnly = document.getElementById('filterFavoriteOnly');
  const jukeboxPlaylistItems = document.getElementById('jukeboxPlaylistItems');

  // Display Settings Elements
  const selectTargetFps = document.getElementById('selectTargetFps');
  const checkCrtScanlines = document.getElementById('checkCrtScanlines');
  const crtOverlay = document.getElementById('crtOverlay');
  const sliderScreenShake = document.getElementById('sliderScreenShake');
  const valScreenShake = document.getElementById('valScreenShake');
  const btnSettingsToProfile = document.getElementById('btnSettingsToProfile');

  // Mobile Touch Controls Elements
  const mobileControls = document.getElementById('mobileControls');
  const joystickZone = document.getElementById('joystickZone');
  const joystickBase = document.getElementById('joystickBase');
  const joystickKnob = document.getElementById('joystickKnob');
  const joyArrowUp = document.getElementById('joyArrowUp');
  const joyArrowDown = document.getElementById('joyArrowDown');
  const joyArrowLeft = document.getElementById('joyArrowLeft');
  const joyArrowRight = document.getElementById('joyArrowRight');
  const btnTouchDash = document.getElementById('btnTouchDash');
  const btnTouchBulletTime = document.getElementById('btnTouchBulletTime');
  const btnTouchMedkit = document.getElementById('btnTouchMedkit');
  const btnTouchAutoAim = document.getElementById('btnTouchAutoAim');
  const touchAutoAimIcon = document.getElementById('touchAutoAimIcon');
  const touchAutoAimText = document.getElementById('touchAutoAimText');
  const touchMedkitBadge = document.getElementById('touchMedkitBadge');
  const selectTouchControls = document.getElementById('selectTouchControls');
  const selectJoystickType = document.getElementById('selectJoystickType');
  const checkHapticFeedback = document.getElementById('checkHapticFeedback');
  const checkAutoAim = document.getElementById('checkAutoAim');

  // Stop propagation on URL / Track Name inputs
  [musicUrlInput, musicNameInput].forEach((inp) => {
    if (inp) {
      inp.addEventListener('keydown', (e) => e.stopPropagation());
      inp.addEventListener('keyup', (e) => e.stopPropagation());
    }
  });

  // Modal Open/Close Logic
  function openSettingsModal() {
    game.isPaused = true;
    game.keys = {};
    soundEngine.init();
    syncAudioUI();
    renderJukeboxPlaylist();
    updateJukeboxNowPlayingUI();
    if (settingsModal) settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.add('hidden');
    game.keys = {};
    game.isPaused = false;
  }

  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsModal);
  if (hudMiniJukebox) hudMiniJukebox.addEventListener('click', openSettingsModal);
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
  if (btnCloseSettingsFooter) btnCloseSettingsFooter.addEventListener('click', closeSettingsModal);

  // Tab Switcher
  if (tabBtnAudio && tabBtnDisplay) {
    tabBtnAudio.addEventListener('click', () => {
      tabBtnAudio.classList.add('tab-active');
      tabBtnAudio.classList.remove('text-slate-400');
      tabBtnDisplay.classList.remove('tab-active');
      tabBtnDisplay.classList.add('text-slate-400');
      if (tabContentAudio) tabContentAudio.classList.remove('hidden');
      if (tabContentDisplay) tabContentDisplay.classList.add('hidden');
    });

    tabBtnDisplay.addEventListener('click', () => {
      tabBtnDisplay.classList.add('tab-active');
      tabBtnDisplay.classList.remove('text-slate-400');
      tabBtnAudio.classList.remove('tab-active');
      tabBtnAudio.classList.add('text-slate-400');
      if (tabContentDisplay) tabContentDisplay.classList.remove('hidden');
      if (tabContentAudio) tabContentAudio.classList.add('hidden');
    });
  }

  // --- Audio Mixer UI Synchronization ---
  function syncAudioUI() {
    const masterVal = Math.round(soundEngine.masterVolume * 100);
    const musicVal = Math.round(soundEngine.musicVolume * 100);
    const sfxVal = Math.round(soundEngine.sfxVolume * 100);

    if (sliderMasterVolume) sliderMasterVolume.value = masterVal;
    if (valMasterVolume) valMasterVolume.innerText = `${masterVal}%`;
    if (btnMuteMaster) {
      btnMuteMaster.innerHTML = soundEngine.muted
        ? '<i class="fa-solid fa-volume-xmark mr-1.5"></i>ÂM TỔNG: TẮT'
        : '<i class="fa-solid fa-volume-high mr-1.5"></i>ÂM TỔNG: BẬT';
      btnMuteMaster.className = soundEngine.muted
        ? 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-rose-950/80 text-rose-300 border border-rose-600 cursor-pointer transition flex items-center justify-center'
        : 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition flex items-center justify-center';
    }

    if (sliderMusicVolume) sliderMusicVolume.value = musicVal;
    if (valMusicVolume) valMusicVolume.innerText = `${musicVal}%`;
    if (btnMuteMusic) {
      btnMuteMusic.innerHTML = soundEngine.isMusicMuted
        ? '<i class="fa-solid fa-volume-xmark mr-1.5"></i>NHẠC NỀN: TẮT'
        : '<i class="fa-solid fa-music mr-1.5"></i>NHẠC NỀN: BẬT';
      btnMuteMusic.className = soundEngine.isMusicMuted
        ? 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-rose-950/80 text-rose-300 border border-rose-600 cursor-pointer transition flex items-center justify-center'
        : 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition flex items-center justify-center';
    }

    if (sliderSfxVolume) sliderSfxVolume.value = sfxVal;
    if (valSfxVolume) valSfxVolume.innerText = `${sfxVal}%`;
    if (btnMuteSfx) {
      btnMuteSfx.innerHTML = soundEngine.isSfxMuted
        ? '<i class="fa-solid fa-volume-xmark mr-1.5"></i>HIỆU ỨNG: TẮT'
        : '<i class="fa-solid fa-burst mr-1.5"></i>HIỆU ỨNG: BẬT';
      btnMuteSfx.className = soundEngine.isSfxMuted
        ? 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-rose-950/80 text-rose-300 border border-rose-600 cursor-pointer transition flex items-center justify-center'
        : 'w-full text-[10px] font-scifi font-bold py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition flex items-center justify-center';
    }

    if (btnAudio) {
      btnAudio.innerHTML = soundEngine.muted
        ? '<i class="fa-solid fa-volume-xmark mr-1"></i> Tắt'
        : '<i class="fa-solid fa-volume-high mr-1"></i> Bật';
    }
  }

  // Audio Sliders Event Listeners
  if (sliderMasterVolume) {
    sliderMasterVolume.addEventListener('input', (e) => {
      soundEngine.init();
      const val = Number(e.target.value);
      soundEngine.setMasterVolume(val / 100);
      if (valMasterVolume) valMasterVolume.innerText = `${val}%`;
      if (soundEngine.muted && val > 0) {
        soundEngine.toggleMute();
      }
      syncAudioUI();
      saveCentralSettings();
    });
  }

  if (sliderMusicVolume) {
    sliderMusicVolume.addEventListener('input', (e) => {
      soundEngine.init();
      const val = Number(e.target.value);
      soundEngine.setMusicVolume(val / 100);
      if (valMusicVolume) valMusicVolume.innerText = `${val}%`;
      if (soundEngine.isMusicMuted && val > 0) {
        soundEngine.setMusicMute(false);
      }
      syncAudioUI();
      saveCentralSettings();
    });
  }

  if (sliderSfxVolume) {
    sliderSfxVolume.addEventListener('input', (e) => {
      soundEngine.init();
      const val = Number(e.target.value);
      soundEngine.setSfxVolume(val / 100);
      if (valSfxVolume) valSfxVolume.innerText = `${val}%`;
      if (soundEngine.isSfxMuted && val > 0) {
        soundEngine.setSfxMute(false);
      }
      syncAudioUI();
      saveCentralSettings();
    });
  }

  // Audio Mute Buttons Event Listeners
  if (btnMuteMaster) {
    btnMuteMaster.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.toggleMute();
      syncAudioUI();
      saveCentralSettings();
    });
  }

  if (btnMuteMusic) {
    btnMuteMusic.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.setMusicMute(!soundEngine.isMusicMuted);
      syncAudioUI();
      saveCentralSettings();
    });
  }

  if (btnMuteSfx) {
    btnMuteSfx.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.setSfxMute(!soundEngine.isSfxMuted);
      syncAudioUI();
      saveCentralSettings();
    });
  }

  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.toggleMute();
      syncAudioUI();
      saveCentralSettings();
    });
  }

  // --- Cyber Jukebox Now Playing & Player Controls ---
  function updateJukeboxNowPlayingUI(track) {
    const currentTrack = track || soundEngine.getCurrentTrack();
    if (currentTrack) {
      if (jukeboxTrackTitle) jukeboxTrackTitle.innerText = currentTrack.name;
      if (jukeboxTrackArtist) {
        jukeboxTrackArtist.innerText = currentTrack.isCustom
          ? `${currentTrack.author || 'User Upload'} • Custom Audio Track`
          : `${currentTrack.author || 'CYBER SYNTH'} • ${currentTrack.bpm} BPM • ${currentTrack.style}`;
      }
      if (jukeboxTrackBadge) {
        jukeboxTrackBadge.innerText = currentTrack.isCustom ? 'CUSTOM AUDIO' : 'PROCEDURAL SYNTH';
      }
      if (hudNowPlayingTitle) {
        hudNowPlayingTitle.innerText = currentTrack.name;
      }
    }

    if (jukeboxPlayIcon && jukeboxPlayText) {
      if (soundEngine.isPausedMusic) {
        jukeboxPlayIcon.innerHTML = '<i class="fa-solid fa-play"></i>';
        jukeboxPlayText.innerText = 'PHÁT';
      } else {
        jukeboxPlayIcon.innerHTML = '<i class="fa-solid fa-pause"></i>';
        jukeboxPlayText.innerText = 'DỪNG';
      }
    }

    if (btnJukeboxShuffle) {
      btnJukeboxShuffle.innerHTML = soundEngine.isShuffle
        ? '<i class="fa-solid fa-shuffle"></i> <span>BẬT</span>'
        : '<i class="fa-solid fa-shuffle"></i> <span>TẮT</span>';
      btnJukeboxShuffle.className = soundEngine.isShuffle
        ? 'p-2 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500 cursor-pointer transition active:scale-95 text-xs font-mono font-bold flex items-center gap-1'
        : 'p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer transition active:scale-95 text-xs font-mono flex items-center gap-1';
    }

    if (btnJukeboxRepeat) {
      if (soundEngine.loopMode === 'all') {
        btnJukeboxRepeat.innerHTML = '<i class="fa-solid fa-repeat"></i> <span>TẤT CẢ</span>';
        btnJukeboxRepeat.className = 'p-2 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500 cursor-pointer transition active:scale-95 text-xs font-mono font-bold flex items-center gap-1';
      } else if (soundEngine.loopMode === 'one') {
        btnJukeboxRepeat.innerHTML = '<i class="fa-solid fa-repeat"></i> <span>1 BÀI</span>';
        btnJukeboxRepeat.className = 'p-2 rounded-lg bg-pink-950 text-pink-300 border border-pink-500 cursor-pointer transition active:scale-95 text-xs font-mono font-bold flex items-center gap-1';
      } else {
        btnJukeboxRepeat.innerHTML = '<i class="fa-solid fa-arrow-right"></i> <span>TẮT</span>';
        btnJukeboxRepeat.className = 'p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer transition active:scale-95 text-xs font-mono flex items-center gap-1';
      }
    }
  }

  // Hook soundEngine callback
  soundEngine.onTrackChangeCallback = (track) => {
    updateJukeboxNowPlayingUI(track);
    renderJukeboxPlaylist();
  };

  if (btnJukeboxPrev) {
    btnJukeboxPrev.addEventListener('click', () => {
      soundEngine.prevTrack();
      updateJukeboxNowPlayingUI();
      renderJukeboxPlaylist();
    });
  }

  if (btnJukeboxPlayPause) {
    btnJukeboxPlayPause.addEventListener('click', () => {
      soundEngine.togglePlayPause();
      updateJukeboxNowPlayingUI();
      renderJukeboxPlaylist();
    });
  }

  if (btnJukeboxNext) {
    btnJukeboxNext.addEventListener('click', () => {
      soundEngine.nextTrack();
      updateJukeboxNowPlayingUI();
      renderJukeboxPlaylist();
    });
  }

  if (btnJukeboxShuffle) {
    btnJukeboxShuffle.addEventListener('click', () => {
      soundEngine.toggleShuffle();
      updateJukeboxNowPlayingUI();
    });
  }

  if (btnJukeboxRepeat) {
    btnJukeboxRepeat.addEventListener('click', () => {
      soundEngine.cycleLoopMode();
      updateJukeboxNowPlayingUI();
    });
  }

  // --- Add Songs & Playlist Management ---
  if (btnUploadMusicFile && musicFileInput) {
    btnUploadMusicFile.addEventListener('click', () => {
      musicFileInput.click();
    });

    musicFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const trackName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32);
      soundEngine.init();
      soundEngine.addCustomTrack(trackName, null, file);
      renderJukeboxPlaylist();
      updateJukeboxNowPlayingUI();
      musicFileInput.value = '';
    });
  }

  if (btnAddMusicUrl && musicUrlInput) {
    btnAddMusicUrl.addEventListener('click', () => {
      const url = musicUrlInput.value.trim();
      if (!url) return;
      const name = (musicNameInput ? musicNameInput.value.trim() : '') || 'ONLINE_TRACK';
      soundEngine.init();
      soundEngine.addCustomTrack(name, url, null);
      musicUrlInput.value = '';
      if (musicNameInput) musicNameInput.value = '';
      renderJukeboxPlaylist();
      updateJukeboxNowPlayingUI();
    });
  }

  if (filterFavoriteOnly) {
    filterFavoriteOnly.addEventListener('change', () => {
      renderJukeboxPlaylist();
    });
  }

  function renderJukeboxPlaylist() {
    if (!jukeboxPlaylistItems) return;
    jukeboxPlaylistItems.innerHTML = '';

    const currentTrack = soundEngine.getCurrentTrack();
    const showFavoritesOnly = Boolean(filterFavoriteOnly && filterFavoriteOnly.checked);

    const tracksToRender = soundEngine.playlist.filter((track) => {
      if (showFavoritesOnly) return Boolean(track.isFavorite);
      return true;
    });

    if (tracksToRender.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'py-6 text-center text-xs font-desc text-slate-500';
      emptyEl.innerHTML = showFavoritesOnly
        ? 'Chưa có bài hát yêu thích nào. Hãy nhấn <i class="fa-solid fa-star text-amber-400"></i> để đánh dấu bài hát yêu thích!'
        : 'Danh sách bài hát trống.';
      jukeboxPlaylistItems.appendChild(emptyEl);
      return;
    }

    tracksToRender.forEach((track, idx) => {
      const isCurrent = currentTrack && currentTrack.id === track.id;
      const row = document.createElement('div');
      row.className = `p-2.5 rounded-lg border flex items-center justify-between gap-3 transition-all ${
        isCurrent
          ? 'bg-cyan-950/70 border-cyan-400 shadow-md shadow-cyan-950/40 text-cyan-200'
          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
      }`;

      // Left Column: Indicator + Title + Style/Author
      const leftCol = document.createElement('div');
      leftCol.className = 'flex items-center gap-2.5 min-w-0';

      const playIndicator = document.createElement('div');
      playIndicator.className = 'w-6 text-center font-mono tabular-nums text-xs font-bold flex-shrink-0';
      if (isCurrent && !soundEngine.isPausedMusic) {
        playIndicator.innerHTML = '<span class="text-cyan-400 animate-pulse"><i class="fa-solid fa-play text-[9px]"></i></span>';
      } else {
        playIndicator.className = 'w-6 text-center font-mono tabular-nums text-xs text-slate-500';
        playIndicator.innerText = `${idx + 1}`;
      }
      leftCol.appendChild(playIndicator);

      const infoCol = document.createElement('div');
      infoCol.className = 'min-w-0';

      const titleLine = document.createElement('div');
      titleLine.className = 'flex items-center gap-2';

      const titleText = document.createElement('span');
      titleText.className = `text-xs font-bold font-hud truncate ${isCurrent ? 'text-white' : 'text-slate-200'}`;
      titleText.innerText = track.name;
      titleLine.appendChild(titleText);

      if (track.isCustom) {
        const customBadge = document.createElement('span');
        customBadge.className = 'text-[9px] px-1.5 py-0.2 rounded font-mono tabular-nums font-bold bg-pink-950 text-pink-400 border border-pink-500/50';
        customBadge.innerText = 'CUSTOM';
        titleLine.appendChild(customBadge);
      }
      infoCol.appendChild(titleLine);

      const subLine = document.createElement('div');
      subLine.className = 'text-[10px] text-slate-400 font-desc truncate';
      subLine.innerText = track.isCustom ? (track.author || 'User Upload') : `${track.bpm} BPM • ${track.style}`;
      infoCol.appendChild(subLine);
      leftCol.appendChild(infoCol);

      row.appendChild(leftCol);

      // Right Column: Star Favorite Button, Play Button, Delete Button
      const rightCol = document.createElement('div');
      rightCol.className = 'flex items-center gap-1.5 flex-shrink-0';

      // Favorite Star Button
      const starBtn = document.createElement('button');
      starBtn.className = `p-1.5 rounded-lg border text-xs cursor-pointer transition active:scale-95 flex items-center justify-center w-7 h-7 ${
        track.isFavorite
          ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/30'
          : 'bg-slate-900 border-slate-700 text-slate-600 hover:text-amber-400 hover:border-slate-500'
      }`;
      starBtn.title = track.isFavorite ? 'Bỏ yêu thích' : 'Đánh dấu bài hát yêu thích';
      starBtn.innerHTML = track.isFavorite ? '<i class="fa-solid fa-star text-amber-400"></i>' : '<i class="fa-regular fa-star"></i>';
      starBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        soundEngine.toggleFavoriteTrack(track.id);
        renderJukeboxPlaylist();
      });
      rightCol.appendChild(starBtn);

      // Play Button
      const playBtn = document.createElement('button');
      playBtn.className = 'px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-black border border-slate-700 text-cyan-300 text-[11px] font-scifi font-bold cursor-pointer transition active:scale-95';
      playBtn.innerText = isCurrent && !soundEngine.isPausedMusic ? 'ĐANG PHÁT' : 'PHÁT';
      playBtn.addEventListener('click', () => {
        soundEngine.playTrackById(track.id);
        renderJukeboxPlaylist();
        updateJukeboxNowPlayingUI();
      });
      rightCol.appendChild(playBtn);

      // Delete Button (only for custom user tracks)
      if (track.isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'p-1 rounded bg-slate-900 hover:bg-rose-950 hover:text-rose-400 border border-slate-800 text-slate-500 text-xs cursor-pointer transition flex items-center justify-center w-7 h-7';
        delBtn.title = 'Xóa bài hát khỏi playlist';
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          soundEngine.removeTrack(track.id);
          renderJukeboxPlaylist();
          updateJukeboxNowPlayingUI();
        });
        rightCol.appendChild(delBtn);
      }

      row.appendChild(rightCol);
      jukeboxPlaylistItems.appendChild(row);
    });
  }

  // --- Display & Controls Settings Handlers ---
  if (selectTargetFps) {
    selectTargetFps.value = String(game.targetFps);
    selectTargetFps.addEventListener('change', () => {
      const fps = Number(selectTargetFps.value) || 0;
      game.setTargetFps(fps);
      saveCentralSettings();
    });
  }

  if (sliderScreenShake) {
    const currentShake = Math.round((game.camera ? (game.camera.shakeMultiplier ?? 1.0) : 1.0) * 100);
    sliderScreenShake.value = currentShake;
    if (valScreenShake) valScreenShake.innerText = `${currentShake}%`;

    sliderScreenShake.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (valScreenShake) valScreenShake.innerText = `${val}%`;
      if (game.camera) {
        game.camera.shakeMultiplier = val / 100;
      }
      saveCentralSettings();
    });
  }

  if (checkCrtScanlines && crtOverlay) {
    checkCrtScanlines.addEventListener('change', () => {
      if (checkCrtScanlines.checked) {
        crtOverlay.classList.remove('hidden');
      } else {
        crtOverlay.classList.add('hidden');
      }
      saveCentralSettings();
    });
  }

  if (btnSettingsToProfile) {
    btnSettingsToProfile.addEventListener('click', () => {
      closeSettingsModal();
      if (btnOpenProfile) btnOpenProfile.click();
    });
  }

  // --- Mobile Virtual Touch Controls & Joystick Engine ---
  function updateMobileControlsVisibility() {
    if (!mobileControls) return;
    const mode = game.touchControlMode || 'auto';
    if (mode === 'always') {
      mobileControls.classList.remove('hidden');
    } else if (mode === 'never') {
      mobileControls.classList.add('hidden');
    } else {
      // 'auto' mode: detects touch device or screen width <= 1024
      const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
      if (isTouchDevice) {
        mobileControls.classList.remove('hidden');
      } else {
        mobileControls.classList.add('hidden');
      }
    }
  }

  function updateAutoAimUI() {
    const isAuto = Boolean(game.isAutoAim);
    if (checkAutoAim) checkAutoAim.checked = isAuto;
    if (touchAutoAimText) touchAutoAimText.innerText = isAuto ? 'AUTO' : 'MANUAL';
    if (touchAutoAimIcon) {
      touchAutoAimIcon.className = isAuto
        ? 'fa-solid fa-crosshairs text-[11px] sm:text-xs'
        : 'fa-solid fa-slash text-[11px] sm:text-xs';
    }
    if (btnTouchAutoAim) {
      if (isAuto) {
        btnTouchAutoAim.className = 'touch-btn w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 flex flex-col items-center justify-center shadow-md shadow-cyan-950/60 active:scale-95';
      } else {
        btnTouchAutoAim.className = 'touch-btn w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 border border-slate-700 text-slate-400 flex flex-col items-center justify-center shadow-md shadow-slate-950/60 active:scale-95';
      }
    }
  }

  window.addEventListener('resize', updateMobileControlsVisibility);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateMobileControlsVisibility, 150);
  });

  // Virtual Joystick Interaction (360° Analog Vector & Dynamic Floating Positioning)
  if (joystickBase && joystickKnob) {
    let activePointerId = null;
    let hasVibratedAtLimit = false;
    const maxRadius = 45;
    const deadzoneRadius = 3; // ~3px deadzone to eliminate micro-tremble drift

    let currentBaseCenterX = 0;
    let currentBaseCenterY = 0;

    const updateArrowGlow = (vx, vy) => {
      if (joyArrowUp) {
        joyArrowUp.className = vy < -0.25
          ? 'absolute top-1 text-[8px] text-cyan-300 scale-125 transition-all flex items-center justify-center filter drop-shadow-[0_0_6px_#00f0ff]'
          : 'absolute top-1 text-[8px] text-cyan-500/40 transition-all flex items-center justify-center';
      }
      if (joyArrowDown) {
        joyArrowDown.className = vy > 0.25
          ? 'absolute bottom-1 text-[8px] text-cyan-300 scale-125 transition-all flex items-center justify-center filter drop-shadow-[0_0_6px_#00f0ff]'
          : 'absolute bottom-1 text-[8px] text-cyan-500/40 transition-all flex items-center justify-center';
      }
      if (joyArrowLeft) {
        joyArrowLeft.className = vx < -0.25
          ? 'absolute left-1 text-[8px] text-cyan-300 scale-125 transition-all flex items-center justify-center filter drop-shadow-[0_0_6px_#00f0ff]'
          : 'absolute left-1 text-[8px] text-cyan-500/40 transition-all flex items-center justify-center';
      }
      if (joyArrowRight) {
        joyArrowRight.className = vx > 0.25
          ? 'absolute right-1 text-[8px] text-cyan-300 scale-125 transition-all flex items-center justify-center filter drop-shadow-[0_0_6px_#00f0ff]'
          : 'absolute right-1 text-[8px] text-cyan-500/40 transition-all flex items-center justify-center';
      }
    };

    const handleJoystickMove = (clientX, clientY) => {
      let dx = clientX - currentBaseCenterX;
      let dy = clientY - currentBaseCenterY;
      const distance = Math.hypot(dx, dy);

      let clampedDx = dx;
      let clampedDy = dy;
      if (distance > maxRadius) {
        clampedDx = (dx / distance) * maxRadius;
        clampedDy = (dy / distance) * maxRadius;
      }

      joystickKnob.style.transform = `translate3d(${clampedDx}px, ${clampedDy}px, 0)`;

      let normalizedMagnitude = 0;
      if (distance > deadzoneRadius) {
        normalizedMagnitude = Math.min(1, (distance - deadzoneRadius) / (maxRadius - deadzoneRadius));
      }

      const angle = Math.atan2(dy, dx);
      const vx = Math.cos(angle) * normalizedMagnitude;
      const vy = Math.sin(angle) * normalizedMagnitude;

      if (game.player) {
        game.player.joystickVector = { x: vx, y: vy };
      }

      // Haptic Vibration at 100% boundary with hysteresis
      if (normalizedMagnitude >= 0.98 && !hasVibratedAtLimit) {
        if (typeof navigator !== 'undefined' && navigator.vibrate && game.hapticsEnabled !== false) {
          try { navigator.vibrate(8); } catch (_) {}
        }
        hasVibratedAtLimit = true;
      } else if (normalizedMagnitude < 0.85) {
        hasVibratedAtLimit = false;
      }

      updateArrowGlow(vx, vy);
    };

    const resetJoystick = () => {
      activePointerId = null;
      hasVibratedAtLimit = false;
      joystickKnob.style.transform = 'translate3d(0px, 0px, 0)';
      joystickKnob.classList.remove('scale-110', 'brightness-125');
      joystickBase.classList.remove('ring-2', 'ring-cyan-400/70', 'shadow-[0_0_30px_rgba(0,240,255,0.5)]');

      updateArrowGlow(0, 0);

      // Return base to home position with smooth easing if dynamic mode was active
      if ((game.joystickType || 'dynamic') === 'dynamic') {
        joystickBase.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
        joystickBase.style.transform = 'translate3d(0px, 0px, 0)';
      }

      if (game.player) {
        game.player.joystickVector = { x: 0, y: 0 };
      }
    };

    const handlePointerDown = (e) => {
      e.preventDefault();
      soundEngine.init();
      activePointerId = e.pointerId;

      try {
        if (e.target && typeof e.target.setPointerCapture === 'function') {
          e.target.setPointerCapture(e.pointerId);
        } else if (joystickBase && typeof joystickBase.setPointerCapture === 'function') {
          joystickBase.setPointerCapture(e.pointerId);
        }
      } catch (err) {}

      // Visual active state
      joystickBase.classList.add('ring-2', 'ring-cyan-400/70', 'shadow-[0_0_30px_rgba(0,240,255,0.5)]');
      joystickKnob.classList.add('scale-110', 'brightness-125');

      const isDynamic = (game.joystickType || 'dynamic') === 'dynamic';
      if (isDynamic && joystickZone) {
        const zoneRect = joystickZone.getBoundingClientRect();
        const baseRadius = (joystickBase.offsetWidth || 96) / 2;
        const zoneCenterX = zoneRect.left + zoneRect.width / 2;
        const zoneCenterY = zoneRect.top + zoneRect.height / 2;

        const clampedX = Math.max(zoneRect.left + baseRadius, Math.min(zoneRect.right - baseRadius, e.clientX));
        const clampedY = Math.max(zoneRect.top + baseRadius, Math.min(zoneRect.bottom - baseRadius, e.clientY));

        const shiftX = clampedX - zoneCenterX;
        const shiftY = clampedY - zoneCenterY;

        joystickBase.style.transition = 'none';
        joystickBase.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0)`;

        currentBaseCenterX = clampedX;
        currentBaseCenterY = clampedY;
      } else {
        const rect = joystickBase.getBoundingClientRect();
        currentBaseCenterX = rect.left + rect.width / 2;
        currentBaseCenterY = rect.top + rect.height / 2;
      }

      handleJoystickMove(e.clientX, e.clientY);
    };

    const handlePointerMove = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        handleJoystickMove(e.clientX, e.clientY);
      }
    };

    const handlePointerUp = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        try {
          if (e.target && typeof e.target.releasePointerCapture === 'function') {
            e.target.releasePointerCapture(e.pointerId);
          } else if (joystickBase && typeof joystickBase.releasePointerCapture === 'function') {
            joystickBase.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
        resetJoystick();
      }
    };

    const handlePointerCancel = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        resetJoystick();
      }
    };

    // Attach listeners to both joystickZone and joystickBase
    const touchElements = [joystickZone, joystickBase].filter(Boolean);
    touchElements.forEach((el) => {
      el.addEventListener('pointerdown', handlePointerDown);
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointerup', handlePointerUp);
      el.addEventListener('pointercancel', handlePointerCancel);
    });

    // Safety resets on blur, lost capture, visibility change
    window.addEventListener('blur', resetJoystick);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetJoystick();
    });
  }

  // Touch Action Buttons with Haptic Feedback
  if (btnTouchDash) {
    btnTouchDash.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      soundEngine.init();
      if (game.player) game.player.dash();
      if (typeof navigator !== 'undefined' && navigator.vibrate && game.hapticsEnabled !== false) {
        try { navigator.vibrate(15); } catch (_) {}
      }
      btnTouchDash.classList.add('scale-90', 'brightness-125');
      setTimeout(() => btnTouchDash.classList.remove('scale-90', 'brightness-125'), 150);
    });
  }

  if (btnTouchBulletTime) {
    btnTouchBulletTime.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      soundEngine.init();
      if (game.player) game.player.toggleBulletTime();
      if (typeof navigator !== 'undefined' && navigator.vibrate && game.hapticsEnabled !== false) {
        try { navigator.vibrate(10); } catch (_) {}
      }
    });
  }

  if (btnTouchMedkit) {
    btnTouchMedkit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      soundEngine.init();
      if (game.player && game.player.storedMedkits > 0 && game.player.health < game.player.maxHealth) {
        const res = game.player.useStoredMedkit();
        if (res) {
          soundEngine.playMedkitPickup();
          if (typeof navigator !== 'undefined' && navigator.vibrate && game.hapticsEnabled !== false) {
            try { navigator.vibrate(15); } catch (_) {}
          }
        }
      }
    });
  }

  if (btnTouchAutoAim) {
    btnTouchAutoAim.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      soundEngine.init();
      game.isAutoAim = !game.isAutoAim;
      if (typeof navigator !== 'undefined' && navigator.vibrate && game.hapticsEnabled !== false) {
        try { navigator.vibrate(8); } catch (_) {}
      }
      updateAutoAimUI();
      saveCentralSettings();
    });
  }

  // Settings Modal Display & Controls Handlers
  if (selectTouchControls) {
    selectTouchControls.value = game.touchControlMode || 'auto';
    selectTouchControls.addEventListener('change', () => {
      game.touchControlMode = selectTouchControls.value;
      updateMobileControlsVisibility();
      saveCentralSettings();
    });
  }

  if (selectJoystickType) {
    selectJoystickType.value = game.joystickType || 'dynamic';
    selectJoystickType.addEventListener('change', () => {
      game.joystickType = selectJoystickType.value;
      saveCentralSettings();
    });
  }

  if (checkHapticFeedback) {
    checkHapticFeedback.checked = game.hapticsEnabled !== false;
    checkHapticFeedback.addEventListener('change', () => {
      game.hapticsEnabled = checkHapticFeedback.checked;
      saveCentralSettings();
    });
  }

  if (checkAutoAim) {
    checkAutoAim.checked = Boolean(game.isAutoAim);
    checkAutoAim.addEventListener('change', () => {
      game.isAutoAim = checkAutoAim.checked;
      updateAutoAimUI();
      saveCentralSettings();
    });
  }

  // --- Central Settings LocalStorage Persistence ---
  function saveCentralSettings() {
    try {
      const settingsToSave = {
        masterVolume: Math.round(soundEngine.masterVolume * 100),
        musicVolume: Math.round(soundEngine.musicVolume * 100),
        sfxVolume: Math.round(soundEngine.sfxVolume * 100),
        muted: soundEngine.muted,
        isMusicMuted: soundEngine.isMusicMuted,
        isSfxMuted: soundEngine.isSfxMuted,
        targetFps: game.targetFps,
        shakeMultiplier: game.camera ? (game.camera.shakeMultiplier ?? 1.0) : 1.0,
        crtScanlines: crtOverlay ? !crtOverlay.classList.contains('hidden') : false,
        filterFavoriteOnly: filterFavoriteOnly ? filterFavoriteOnly.checked : false,
        touchControlMode: game.touchControlMode || 'auto',
        joystickType: game.joystickType || 'dynamic',
        hapticsEnabled: game.hapticsEnabled !== false,
        autoAim: Boolean(game.isAutoAim),
      };
      localStorage.setItem('cyber_central_settings', JSON.stringify(settingsToSave));
    } catch (e) {}
  }

  function loadCentralSettings() {
    try {
      const saved = localStorage.getItem('cyber_central_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.masterVolume === 'number') soundEngine.setMasterVolume(parsed.masterVolume / 100);
        if (typeof parsed.musicVolume === 'number') soundEngine.setMusicVolume(parsed.musicVolume / 100);
        if (typeof parsed.sfxVolume === 'number') soundEngine.setSfxVolume(parsed.sfxVolume / 100);
        if (typeof parsed.muted === 'boolean') soundEngine.muted = parsed.muted;
        if (typeof parsed.isMusicMuted === 'boolean') soundEngine.setMusicMute(parsed.isMusicMuted);
        if (typeof parsed.isSfxMuted === 'boolean') soundEngine.setSfxMute(parsed.isSfxMuted);

        if (typeof parsed.targetFps === 'number' && game.setTargetFps) {
          game.setTargetFps(parsed.targetFps);
          if (selectTargetFps) selectTargetFps.value = String(parsed.targetFps);
        }

        if (typeof parsed.shakeMultiplier === 'number' && game.camera) {
          game.camera.shakeMultiplier = parsed.shakeMultiplier;
          if (sliderScreenShake) sliderScreenShake.value = Math.round(parsed.shakeMultiplier * 100);
          if (valScreenShake) valScreenShake.innerText = `${Math.round(parsed.shakeMultiplier * 100)}%`;
        }

        if (typeof parsed.crtScanlines === 'boolean' && crtOverlay) {
          if (parsed.crtScanlines) {
            crtOverlay.classList.remove('hidden');
          } else {
            crtOverlay.classList.add('hidden');
          }
          if (checkCrtScanlines) checkCrtScanlines.checked = parsed.crtScanlines;
        } else if (crtOverlay) {
          // Default to Ultra-Sharp HD (CRT blur scanlines OFF)
          crtOverlay.classList.add('hidden');
          if (checkCrtScanlines) checkCrtScanlines.checked = false;
        }

        if (typeof parsed.filterFavoriteOnly === 'boolean' && filterFavoriteOnly) {
          filterFavoriteOnly.checked = parsed.filterFavoriteOnly;
        }

        if (typeof parsed.touchControlMode === 'string') {
          game.touchControlMode = parsed.touchControlMode;
          if (selectTouchControls) selectTouchControls.value = parsed.touchControlMode;
        }

        if (typeof parsed.joystickType === 'string') {
          game.joystickType = parsed.joystickType;
          if (selectJoystickType) selectJoystickType.value = parsed.joystickType;
        }

        if (typeof parsed.hapticsEnabled === 'boolean') {
          game.hapticsEnabled = parsed.hapticsEnabled;
          if (checkHapticFeedback) checkHapticFeedback.checked = parsed.hapticsEnabled;
        }

        if (typeof parsed.autoAim === 'boolean') {
          game.isAutoAim = parsed.autoAim;
          if (checkAutoAim) checkAutoAim.checked = parsed.autoAim;
        }
      }
    } catch (e) {}
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      saveCentralSettings();
      closeSettingsModal();
    });
  }

  // Load and apply central settings on startup
  loadCentralSettings();
  syncAudioUI();
  updateJukeboxNowPlayingUI();
  updateMobileControlsVisibility();
  updateAutoAimUI();

  // --- Map Biome & Sector Settings Controls ---
  const selectMapBiome = document.getElementById('selectMapBiome');
  const btnNextBiome = document.getElementById('btnNextBiome');
  const badgeCurrentBiome = document.getElementById('badgeCurrentBiome');

  function updateBiomeBadgeUI() {
    if (!badgeCurrentBiome || !game.lighting) return;
    const biome = game.lighting.getCurrentBiome();
    badgeCurrentBiome.innerText = biome.name;
    badgeCurrentBiome.style.color = biome.accentColor || '#00f0ff';
    badgeCurrentBiome.style.borderColor = `${biome.accentColor || '#00f0ff'}80`;
  }

  if (selectMapBiome) {
    selectMapBiome.addEventListener('change', () => {
      const val = selectMapBiome.value;
      if (val === 'auto') {
        game.lighting.setProgression(game.player.level, game.wave);
      } else {
        const idx = parseInt(val, 10);
        game.lighting.setBiomeByIndex(idx);
      }
      updateBiomeBadgeUI();
    });
  }

  if (btnNextBiome) {
    btnNextBiome.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.playLevelUp();
      const nextIdx = (game.lighting.currentBiomeIndex + 1) % 6;
      const newBiome = game.lighting.setBiomeByIndex(nextIdx);
      if (selectMapBiome) selectMapBiome.value = String(nextIdx);
      updateBiomeBadgeUI();
      if (newBiome) {
        window.dispatchEvent(
          new CustomEvent('game:sectortransition', {
            detail: { biome: newBiome, level: game.player.level, wave: game.wave, reason: 'MANUAL' },
          })
        );
      }
    });
  }

  updateBiomeBadgeUI();

  // Quick Medkit Injector Button
  const btnUseMedkit = document.getElementById('btnUseMedkit');
  if (btnUseMedkit) {
    btnUseMedkit.addEventListener('click', () => {
      soundEngine.init();
      if (game.player.storedMedkits > 0 && game.player.health < game.player.maxHealth) {
        const res = game.player.useStoredMedkit();
        if (res) {
          soundEngine.playMedkitPickup();
        }
      }
    });
  }

  let lastLowHealthWarnTime = 0;

  // HUD Update Loop
  setInterval(() => {
    if (game.isGameOver) return;

    // HP & Shield
    const hpPercent = Math.max(0, (game.player.health / game.player.maxHealth) * 100);
    document.getElementById('hpBar').style.width = `${hpPercent}%`;
    document.getElementById('hpText').innerText = `${Math.ceil(game.player.health)} / ${game.player.maxHealth}`;

    const shieldPercent = Math.max(0, (game.player.shield / game.player.maxShield) * 100);
    document.getElementById('shieldBar').style.width = `${shieldPercent}%`;
    document.getElementById('shieldText').innerText = `${Math.ceil(game.player.shield)} / ${game.player.maxShield}`;

    // Low Health Warning Banner & Audio Beep (< 25% Hull)
    const lowHealthWarningEl = document.getElementById('lowHealthWarning');
    const isLowHealth = hpPercent <= 25;
    if (isLowHealth && !game.isGameOver) {
      if (lowHealthWarningEl) lowHealthWarningEl.classList.remove('hidden');
      const now = performance.now();
      if (now - lastLowHealthWarnTime > 1600) {
        soundEngine.playLowHealthWarning();
        lastLowHealthWarnTime = now;
      }
    } else {
      if (lowHealthWarningEl) lowHealthWarningEl.classList.add('hidden');
    }

    // Energy
    const energyPercent = (game.player.energy / game.player.maxEnergy) * 100;
    document.getElementById('energyBar').style.width = `${energyPercent}%`;
    document.getElementById('energyText').innerText = `${Math.floor(energyPercent)}%`;

    // Overclock Ultimate Bar
    const overclockBar = document.getElementById('overclockBar');
    const overclockText = document.getElementById('overclockText');
    if (overclockBar && overclockText && game.player) {
      const ocPercent = Math.min(100, (game.player.overclockGauge / game.player.maxOverclockGauge) * 100);
      overclockBar.style.width = `${ocPercent}%`;
      overclockText.innerText = game.player.isOverclockActive
        ? `ACTIVE (${Math.ceil(game.player.overclockTimer)}s)`
        : `${Math.floor(ocPercent)}%`;
      if (ocPercent >= 100 && !game.player.isOverclockActive) {
        overclockBar.parentElement.classList.add('animate-pulse');
      } else {
        overclockBar.parentElement.classList.remove('animate-pulse');
      }
    }

    // Wave & Boss State
    const activeBossCount = game.bosses ? game.bosses.length : (game.boss ? 1 : 0);
    const waveTextEl = document.getElementById('waveText');
    if (waveTextEl) {
      if (activeBossCount > 1) {
        waveTextEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i>TWIN BOSS (W${game.wave})`;
        waveTextEl.className = 'text-xl font-black font-scifi text-rose-500 animate-pulse';
      } else if (activeBossCount === 1) {
        const bName = game.bosses && game.bosses[0] ? game.bosses[0].name : 'BOSS';
        waveTextEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i>${bName}`;
        waveTextEl.className = 'text-lg font-black font-scifi text-rose-400 animate-pulse';
      } else {
        waveTextEl.innerText = `WAVE ${game.wave}`;
        waveTextEl.className = 'text-3xl font-black font-scifi neon-text-cyan';
      }
    }

    document.getElementById('scoreText').innerText = game.score.toLocaleString();
    document.getElementById('killsText').innerText = game.kills;

    // Level & XP
    const xpPercent = Math.min(100, (game.player.xp / game.player.xpToNextLevel) * 100);
    document.getElementById('xpBar').style.width = `${xpPercent}%`;
    document.getElementById('levelText').innerText = game.player.level;
    document.getElementById('xpText').innerText = `${game.player.xp} / ${game.player.xpToNextLevel} XP`;

    // Combo Badge
    const comboBadge = document.getElementById('comboBadge');
    if (game.combo >= 2) {
      comboBadge.classList.remove('hidden');
      document.getElementById('comboCount').innerText = `${game.combo}x`;
    } else {
      comboBadge.classList.add('hidden');
    }

    // Hyper Boost Badge
    const hyperBoostBadge = document.getElementById('hyperBoostBadge');
    if (hyperBoostBadge) {
      if (game.player.isHyperBoosted) {
        hyperBoostBadge.classList.remove('hidden');
      } else {
        hyperBoostBadge.classList.add('hidden');
      }
    }

    // Map Biome Sector HUD Chip
    const hudSectorTextEl = document.getElementById('hudSectorText');
    if (hudSectorTextEl && game.lighting) {
      const curBiome = game.lighting.getCurrentBiome();
      hudSectorTextEl.innerText = curBiome.name;
      hudSectorTextEl.style.color = curBiome.accentColor || '#00f0ff';
    }

    // Medkit Inventory HUD
    const medStockBadge = document.getElementById('medkitStockBadge');
    if (medStockBadge) medStockBadge.innerText = game.player.storedMedkits;
    const hudMedCount = document.getElementById('hudMedkitsCount');
    if (hudMedCount) hudMedCount.innerText = game.medkitsCollected || 0;

    // Mobile Virtual Touch Controller Badges & Status
    if (touchMedkitBadge) {
      touchMedkitBadge.innerText = `${game.player.storedMedkits}`;
      if (game.player.storedMedkits > 0) {
        touchMedkitBadge.className = 'absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-mono font-bold text-[8px] px-1 rounded-full border border-emerald-300';
      } else {
        touchMedkitBadge.className = 'absolute -top-1 -right-1 bg-slate-800 text-slate-500 font-mono font-bold text-[8px] px-1 rounded-full border border-slate-700';
      }
    }

    if (btnTouchBulletTime) {
      if (game.player.isBulletTime && game.player.energy > 0) {
        btnTouchBulletTime.className = 'touch-btn w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500 border-2 border-white text-slate-950 flex flex-col items-center justify-center shadow-lg shadow-amber-400/60 active:scale-95 animate-pulse';
      } else {
        btnTouchBulletTime.className = 'touch-btn w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 border border-amber-500/70 text-amber-400 flex flex-col items-center justify-center shadow-md shadow-amber-950/60 active:scale-95';
      }
    }

    for (let i = 1; i <= 3; i++) {
      const slotEl = document.getElementById(`medSlot-${i}`);
      if (slotEl) {
        if (game.player.storedMedkits >= i) {
          slotEl.innerHTML = '<i class="fa-solid fa-circle text-[8px]"></i>';
          slotEl.className = 'text-xs text-emerald-400';
        } else {
          slotEl.innerHTML = '<i class="fa-regular fa-circle text-[8px]"></i>';
          slotEl.className = 'text-xs text-slate-600';
        }
      }
    }

    // Weapon Arsenal & Ammo Box HUD
    const wpns = game.weapons.weapons;
    const hudAmmoTotal = document.getElementById('hudAmmoTotal');
    if (hudAmmoTotal) hudAmmoTotal.innerText = `${game.ammoBoxesCollected || 0} HỘP ĐÃ THU THẬP`;

    const weaponKeys = ['homing', 'laser', 'shotgun', 'orbit'];
    weaponKeys.forEach((key) => {
      const w = wpns[key];
      const slotEl = document.getElementById(`ammoSlot-${key}`);
      const lvlEl = document.getElementById(`ammoLvl-${key}`);
      const barEl = document.getElementById(`ammoBar-${key}`);

      if (lvlEl) {
        if (w.level > 0) {
          lvlEl.innerText = `LVL ${w.level}/8`;
          lvlEl.classList.remove('text-slate-500');
          lvlEl.style.color = w.color;
          if (slotEl) {
            slotEl.classList.remove('opacity-60', 'border-slate-800');
            slotEl.style.borderColor = `${w.color}99`;
          }
        } else {
          lvlEl.innerText = 'KHÓA';
          lvlEl.classList.add('text-slate-500');
          lvlEl.style.color = '';
          if (slotEl) {
            slotEl.classList.add('opacity-60', 'border-slate-800');
            slotEl.style.borderColor = '';
          }
        }
      }

      if (barEl) {
        barEl.style.width = `${Math.min(100, (w.level / 8) * 100)}%`;
      }
    });

    // Tactical Drop Radar Updates
    const { nearestMedkit, nearestAmmo } = findNearestDrops(game.player, game.drops);
    const radarMedkitText = document.getElementById('radarMedkitText');
    const radarAmmoText = document.getElementById('radarAmmoText');

    if (radarMedkitText) {
      radarMedkitText.innerHTML = nearestMedkit
        ? `<i class="fa-solid fa-kit-medical mr-1 text-emerald-400"></i> Medkit: ${nearestMedkit.dist}m ${nearestMedkit.faArrow || nearestMedkit.arrow}`
        : '<i class="fa-solid fa-kit-medical mr-1 text-emerald-400"></i> Medkit: Sẵn sàng';
    }
    if (radarAmmoText) {
      radarAmmoText.innerHTML = nearestAmmo
        ? `<i class="fa-solid fa-box mr-1 text-cyan-400"></i> Hộp Đạn: ${nearestAmmo.dist}m ${nearestAmmo.faArrow || nearestAmmo.arrow}`
        : '<i class="fa-solid fa-box mr-1 text-cyan-400"></i> Hộp Đạn: Sẵn sàng';
    }
  }, 100);

  // Surge Invasion / Warning Alert Event Feedback
  const surgeBanner = document.getElementById('surgeWarning');
  const surgeText = document.getElementById('surgeWarningText');
  let surgeTimeout = null;
  window.addEventListener('game:surge', (e) => {
    if (surgeBanner && surgeText) {
      const cleanMsg = (e.detail.message || 'CẢNH BÁO ĐỘT KÍCH BẤT NGỜ!').replace(/[⚠️🚨]/g, '').trim();
      surgeText.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${cleanMsg}`;
      surgeBanner.classList.remove('hidden');
      if (surgeTimeout) clearTimeout(surgeTimeout);
      surgeTimeout = setTimeout(() => {
        surgeBanner.classList.add('hidden');
      }, 4500);
    }
  });

  // Boss Multi-Phase Transition Warning Banner Feedback
  const bossPhaseBanner = document.getElementById('bossPhaseWarning');
  const bossPhaseText = document.getElementById('bossPhaseWarningText');
  let bossPhaseTimeout = null;
  window.addEventListener('game:bossphase', (e) => {
    const { phase, name, message } = e.detail;
    if (bossPhaseBanner && bossPhaseText) {
      bossPhaseText.innerHTML = `<i class="fa-solid fa-skull mr-1.5 text-pink-400"></i> ${message || `CẢNH BÁO: ${name} CHUYỂN GIAI ĐOẠN ${phase}!`}`;
      bossPhaseBanner.classList.remove('hidden');
      if (bossPhaseTimeout) clearTimeout(bossPhaseTimeout);
      bossPhaseTimeout = setTimeout(() => {
        bossPhaseBanner.classList.add('hidden');
      }, 5000);
    }
  });

  // Artillery Strike Danger Zone Warning Banner Feedback
  const artilleryBanner = document.getElementById('artilleryWarning');
  const artilleryText = document.getElementById('artilleryWarningText');
  let artilleryTimeout = null;
  window.addEventListener('game:artillery', (e) => {
    if (artilleryBanner && artilleryText) {
      artilleryBanner.classList.remove('hidden');
      if (artilleryTimeout) clearTimeout(artilleryTimeout);
      artilleryTimeout = setTimeout(() => {
        artilleryBanner.classList.add('hidden');
      }, 3000);
    }
  });

  // Enemy Mutation Surge Warning Banner Feedback
  const mutationBanner = document.getElementById('mutationWarning');
  const mutationText = document.getElementById('mutationWarningText');
  let mutationTimeout = null;
  window.addEventListener('game:mutation', (e) => {
    const { message, name } = e.detail || {};
    if (mutationBanner && mutationText) {
      mutationText.innerHTML = `<i class="fa-solid fa-dna mr-1.5 text-fuchsia-400"></i> ${message || `CẢNH BÁO: ${name || 'QUÁI VẬT'} ĐỘT BIẾN GEN!`}`;
      mutationBanner.classList.remove('hidden');
      if (mutationTimeout) clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        mutationBanner.classList.add('hidden');
      }, 3200);
    }
  });

  // Sector / Map Biome Transition Banner Notification
  const sectorTransitionBanner = document.getElementById('sectorTransitionBanner');
  const sectorTransitionType = document.getElementById('sectorTransitionType');
  const sectorTransitionTitle = document.getElementById('sectorTransitionTitle');
  const sectorTransitionSubtitle = document.getElementById('sectorTransitionSubtitle');
  let sectorBannerTimeout = null;

  window.addEventListener('game:sectortransition', (e) => {
    const { biome, level, wave, reason } = e.detail;
    if (!sectorTransitionBanner || !biome) return;

    if (sectorBannerTimeout) {
      clearTimeout(sectorBannerTimeout);
    }

    if (sectorTransitionType) {
      if (reason === 'LEVEL') {
        sectorTransitionType.innerHTML = `THĂNG CẤP CHIẾN BINH (CẤP ${level}) <i class="fa-solid fa-arrow-right-long mx-1 text-cyan-400"></i> BẢN ĐỒ MỚI`;
      } else if (reason === 'WAVE') {
        sectorTransitionType.innerHTML = `TIẾN VÀO WAVE ${wave} <i class="fa-solid fa-arrow-right-long mx-1 text-cyan-400"></i> KHU VỰC MỚI`;
      } else {
        sectorTransitionType.innerText = `CHUYỂN ĐỔI BẢN ĐỒ CHIẾN TRƯỜNG`;
      }
    }

    if (sectorTransitionTitle) {
      sectorTransitionTitle.innerText = biome.name;
      sectorTransitionTitle.style.color = biome.accentColor || '#00f0ff';
      sectorTransitionTitle.style.textShadow = `0 0 16px ${biome.accentColor || '#00f0ff'}`;
    }

    if (sectorTransitionSubtitle) {
      sectorTransitionSubtitle.innerText = biome.subTitle;
    }

    sectorTransitionBanner.style.borderColor = biome.accentColor || '#00f0ff';
    sectorTransitionBanner.style.boxShadow = `0 0 30px ${biome.accentColor || '#00f0ff'}55`;
    sectorTransitionBanner.classList.remove('hidden');

    if (typeof updateBiomeBadgeUI === 'function') {
      updateBiomeBadgeUI();
    }

    sectorBannerTimeout = setTimeout(() => {
      sectorTransitionBanner.classList.add('hidden');
    }, 3200);
  });

  // Weapon Degradation on Hit Event Feedback
  window.addEventListener('game:weapondegraded', (e) => {
    const { weapon } = e.detail;
    const slotEl = document.getElementById(`ammoSlot-${weapon.id}`);
    if (slotEl) {
      slotEl.classList.add('border-rose-500', 'bg-rose-950/40', 'animate-pulse');
      setTimeout(() => {
        slotEl.classList.remove('border-rose-500', 'bg-rose-950/40', 'animate-pulse');
      }, 800);
    }
  });

  // Overclock HUD Click Trigger
  const btnHudOverclock = document.getElementById('btnHudOverclock');
  if (btnHudOverclock) {
    btnHudOverclock.addEventListener('click', () => {
      if (game.player) game.player.activateOverclock();
    });
  }

  // Victory / Extraction Event (Sector Liberated)
  window.addEventListener('game:victory', (e) => {
    const { score, wave, kills } = e.detail;
    const victoryScore = document.getElementById('victoryScore');
    const victoryWave = document.getElementById('victoryWave');
    const victoryKills = document.getElementById('victoryKills');
    if (victoryScore) victoryScore.innerText = score.toLocaleString();
    if (victoryWave) victoryWave.innerText = wave;
    if (victoryKills) victoryKills.innerText = kills;

    const modal = document.getElementById('victoryModal');
    if (modal) modal.classList.remove('hidden');

    const btnContinue = document.getElementById('btnContinueEndless');
    if (btnContinue) {
      btnContinue.onclick = () => {
        if (modal) modal.classList.add('hidden');
        game.gameMode = 'endless';
        game.isExtractionActive = false;
        game.isVictory = false;
        game.isPaused = false;
        game.lastTime = performance.now();
      };
    }
  });

  // Game Over Event
  window.addEventListener('game:gameover', async (e) => {
    const { score, wave, kills } = e.detail;
    document.getElementById('finalScore').innerText = score.toLocaleString();
    document.getElementById('finalWave').innerText = wave;
    document.getElementById('finalKills').innerText = kills;

    if (finalAvatarBadge) finalAvatarBadge.innerHTML = game.player.avatar.faIcon || game.player.avatar.icon;
    if (playerNameInput) playerNameInput.value = game.player.name;

    const modal = document.getElementById('gameOverModal');
    modal.classList.remove('hidden');

    // Fetch Leaderboard
    await loadLeaderboard();

    // Submit Score Handler
    const btnSubmit = document.getElementById('btnSubmitScore');
    btnSubmit.onclick = async () => {
      const playerName = document.getElementById('playerNameInput').value || game.player.name || 'CYBER_RUNNER';
      btnSubmit.disabled = true;
      btnSubmit.innerText = 'ĐANG LƯU...';

      try {
        await fetch('/api/highscores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName,
            avatar: game.player.avatar.icon,
            score,
            wave,
            kills,
            maxCombo: game.maxCombo,
            favoriteWeapon: 'Plasma Homing Missiles',
          }),
        });
        await loadLeaderboard();
        btnSubmit.innerText = 'ĐÃ LƯU KỶ LỤC!';
      } catch (err) {
        btnSubmit.innerText = 'LỖI KẾT NỐI';
      }
    };
  });

  function getAvatarFaIcon(iconOrId) {
    if (!iconOrId) return '<i class="fa-solid fa-bolt text-cyan-400"></i>';
    if (typeof iconOrId === 'string' && iconOrId.includes('<i ')) return iconOrId;
    if (iconOrId === '⚡' || iconOrId === 'phantom' || iconOrId === 'bolt') return '<i class="fa-solid fa-bolt text-cyan-400"></i>';
    if (iconOrId === '🛡️' || iconOrId === 'titan' || iconOrId === 'shield') return '<i class="fa-solid fa-shield-halved text-emerald-400"></i>';
    if (iconOrId === '🩸' || iconOrId === 'reaper' || iconOrId === 'droplet') return '<i class="fa-solid fa-droplet text-rose-500"></i>';
    if (iconOrId === '🌟' || iconOrId === 'valkyrie' || iconOrId === 'star') return '<i class="fa-solid fa-star text-amber-400"></i>';
    return '<i class="fa-solid fa-bolt text-cyan-400"></i>';
  }

  async function loadLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    try {
      const res = await fetch('/api/highscores');
      const json = await res.json();
      listEl.innerHTML = '';

      json.data.slice(0, 5).forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className =
          'flex justify-between items-center py-1.5 px-3 rounded bg-slate-900/60 border border-slate-800';

        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-2';

        const rankSpan = document.createElement('span');
        rankSpan.className = `font-bold font-mono tabular-nums ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}`;
        rankSpan.textContent = `#${idx + 1}`;

        const avatarSpan = document.createElement('span');
        avatarSpan.className = 'text-base w-5 text-center flex items-center justify-center';
        avatarSpan.innerHTML = getAvatarFaIcon(entry.avatar);

        const safeName = document.createElement('span');
        safeName.className = 'text-white font-bold font-hud';
        safeName.textContent = entry.playerName;

        const waveSpan = document.createElement('span');
        waveSpan.className = 'text-[10px] text-slate-400 font-desc';
        waveSpan.textContent = `(Wave ${entry.wave})`;

        leftDiv.appendChild(rankSpan);
        leftDiv.appendChild(avatarSpan);
        leftDiv.appendChild(safeName);
        leftDiv.appendChild(waveSpan);

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'font-bold font-mono tabular-nums text-cyan-400';
        scoreSpan.textContent = `${Number(entry.score || 0).toLocaleString()} PTS`;

        row.appendChild(leftDiv);
        row.appendChild(scoreSpan);
        listEl.appendChild(row);
      });
    } catch (e) {
      listEl.innerHTML = '<div class="text-rose-400">Không thể tải bảng xếp hạng.</div>';
    }
  }
});
