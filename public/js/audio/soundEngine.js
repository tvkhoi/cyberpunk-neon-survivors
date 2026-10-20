/**
 * 100% Procedural Web Audio API Sound Engine & Cyber Jukebox.
 * Synthesizes retro Synthwave background music, manages favorite playlists,
 * custom user audio tracks, and granular volume/mute mixing.
 */

export const BUILTIN_TRACKS = [
  {
    id: 'track-1',
    name: 'NEON OVERDRIVE',
    author: 'CYBER SYNTH CORE',
    bpm: 125,
    style: 'C Minor Synthwave',
    bassNotes: [65.41, 65.41, 77.78, 77.78, 87.31, 87.31, 98.0, 98.0], // C2, Eb2, F2, G2
    leadArp: [261.63, 311.13, 392.0, 466.16, 523.25, 466.16, 392.0, 311.13],
    isCustom: false,
    isFavorite: true,
  },
  {
    id: 'track-2',
    name: 'CYBERSPACE ODYSSEY',
    author: 'NEO TOKYO FM',
    bpm: 114,
    style: 'F Dorian Chillwave',
    bassNotes: [43.65, 43.65, 51.91, 51.91, 58.27, 58.27, 65.41, 65.41], // F1, Ab1, Bb1, C2
    leadArp: [174.61, 207.65, 261.63, 311.13, 349.23, 311.13, 261.63, 207.65],
    isCustom: false,
    isFavorite: true,
  },
  {
    id: 'track-3',
    name: 'MATRIX OVERCLOCK',
    author: 'GLITCH RUNNER',
    bpm: 138,
    style: 'D Phrygian Battle Cyber',
    bassNotes: [73.42, 77.78, 87.31, 73.42, 98.0, 87.31, 77.78, 73.42], // D2, Eb2, F2, G2
    leadArp: [293.66, 311.13, 349.23, 440.0, 493.88, 440.0, 349.23, 311.13],
    isCustom: false,
    isFavorite: false,
  },
  {
    id: 'track-4',
    name: 'NIGHTCITY DRIFT',
    author: 'OUTRUN RETRO 84',
    bpm: 106,
    style: 'A Minor Outrun Groove',
    bassNotes: [55.0, 55.0, 65.41, 65.41, 48.99, 48.99, 55.0, 55.0], // A1, C2, G1, A1
    leadArp: [220.0, 261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 261.63],
    isCustom: false,
    isFavorite: false,
  },
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.filterNode = null;
    this.compressor = null;

    // Volume levels
    this.masterVolume = 0.7;
    this.musicVolume = 0.35;
    this.sfxVolume = 0.5;

    // Mute states
    this.muted = false;
    this.isMusicMuted = false;
    this.isSfxMuted = false;

    // Procedural Synthwave State
    this.isPlayingMusic = false;
    this.musicInterval = null;
    this.step = 0;
    this.currentTempo = 125;
    this.bassNotes = BUILTIN_TRACKS[0].bassNotes;
    this.leadArp = BUILTIN_TRACKS[0].leadArp;

    // Jukebox Playlist & Custom Audio Player
    this.playlist = [...BUILTIN_TRACKS];
    this.currentTrackIndex = 0;
    this.isPausedMusic = false;
    this.isShuffle = false;
    this.loopMode = 'all'; // 'all', 'one', 'none'
    this.customAudio = null;
    this.isCustomPlaying = false;
    this.onTrackChangeCallback = null;

    // Restore saved favorites from localStorage if present
    this.loadSavedPlaylistPreferences();
  }

  loadSavedPlaylistPreferences() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('cyber_music_playlist_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge favorites with built-ins and append valid custom tracks
            const customTracks = parsed.filter((t) => t.isCustom && t.url);
            this.playlist = [
              ...BUILTIN_TRACKS.map((bt) => {
                const match = parsed.find((p) => p.id === bt.id);
                return match ? { ...bt, isFavorite: Boolean(match.isFavorite) } : bt;
              }),
              ...customTracks,
            ];
          }
        }
      }
    } catch (e) {}
  }

  savePlaylistPreferences() {
    try {
      if (typeof localStorage !== 'undefined') {
        const toSave = this.playlist.map((t) => ({
          id: t.id,
          name: t.name,
          author: t.author || 'User Upload',
          url: t.isCustom ? t.url : undefined,
          isCustom: t.isCustom,
          isFavorite: t.isFavorite,
        }));
        localStorage.setItem('cyber_music_playlist_v1', JSON.stringify(toSave));
      }
    } catch (e) {}
  }

  init() {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(12000, this.ctx.currentTime);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume, this.ctx.currentTime);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.isSfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime);

    // Audio routing
    this.musicGain.connect(this.filterNode);
    this.sfxGain.connect(this.filterNode);
    this.filterNode.connect(this.masterGain);

    // DynamicsCompressorNode: Prevents audio clipping & distortion during massive concurrent explosions/sfx
    if (this.ctx.createDynamicsCompressor) {
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    } else {
      this.masterGain.connect(this.ctx.destination);
    }

    // Initialize custom audio element
    if (typeof window !== 'undefined' && window.Audio && !this.customAudio) {
      this.customAudio = new window.Audio();
      this.customAudio.volume = this.isMusicMuted ? 0 : this.musicVolume;
      this.customAudio.addEventListener('ended', () => {
        this.handleTrackEnded();
      });
    }

    // Start playing the current active track
    this.playCurrentTrack();
  }

  setBulletTime(active) {
    if (!this.ctx || !this.filterNode) return;
    const now = this.ctx.currentTime;
    if (active) {
      this.filterNode.frequency.setTargetAtTime(450, now, 0.08);
      if (this.customAudio) {
        this.customAudio.playbackRate = 0.65;
      }
    } else {
      this.filterNode.frequency.setTargetAtTime(14000, now, 0.1);
      if (this.customAudio) {
        this.customAudio.playbackRate = 1.0;
      }
    }
  }

  stopSynthwaveBGM() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isPlayingMusic = false;
  }

  startSynthwaveBGM() {
    if (this.isPlayingMusic || !this.ctx) return;
    this.isPlayingMusic = true;

    const tempo = this.currentTempo || 125;
    const stepTimeMs = (60 / tempo / 4) * 1000; // 16th notes

    this.musicInterval = setInterval(() => {
      if (this.muted || this.isMusicMuted || !this.ctx || this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;

      // 1. Driving Synthwave 80s Bass
      if (this.step % 2 === 0) {
        const bassIdx = Math.floor(this.step / 8) % this.bassNotes.length;
        const bassFreq = this.bassNotes[bassIdx];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 0.2);
      }

      // 2. High Neon Arpeggio
      const arpFreq = this.leadArp[this.step % this.leadArp.length];
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();

      leadOsc.type = 'sine';
      leadOsc.frequency.setValueAtTime(arpFreq, now);

      leadGain.gain.setValueAtTime(0.12, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain);

      leadOsc.start(now);
      leadOsc.stop(now + 0.13);

      this.step = (this.step + 1) % 64;
    }, stepTimeMs);
  }

  // --- CYBER JUKEBOX PLAYLIST LOGIC ---

  getCurrentTrack() {
    return this.playlist[this.currentTrackIndex] || this.playlist[0] || null;
  }

  playCurrentTrack() {
    const track = this.getCurrentTrack();
    if (!track) return;

    if (track.isCustom && track.url) {
      // Play custom user audio
      this.stopSynthwaveBGM();
      if (!this.customAudio && typeof window !== 'undefined' && window.Audio) {
        this.customAudio = new window.Audio();
        this.customAudio.addEventListener('ended', () => this.handleTrackEnded());
      }
      if (this.customAudio) {
        this.customAudio.src = track.url;
        this.customAudio.volume = this.isMusicMuted || this.muted ? 0 : this.musicVolume;
        this.customAudio.play().catch(() => {});
        this.isCustomPlaying = true;
      }
    } else {
      // Play procedural synthwave BGM
      if (this.customAudio) {
        this.customAudio.pause();
        this.isCustomPlaying = false;
      }
      this.bassNotes = track.bassNotes || BUILTIN_TRACKS[0].bassNotes;
      this.leadArp = track.leadArp || BUILTIN_TRACKS[0].leadArp;
      this.currentTempo = track.bpm || 125;
      this.step = 0;
      this.stopSynthwaveBGM();
      this.startSynthwaveBGM();
    }

    this.isPausedMusic = false;
    if (this.onTrackChangeCallback) {
      this.onTrackChangeCallback(track);
    }
  }

  playTrackById(trackId) {
    const idx = this.playlist.findIndex((t) => t.id === trackId);
    if (idx !== -1) {
      this.currentTrackIndex = idx;
      this.init();
      this.playCurrentTrack();
    }
  }

  togglePlayPause() {
    this.init();
    if (this.isPausedMusic) {
      // Resume
      this.isPausedMusic = false;
      const track = this.getCurrentTrack();
      if (track && track.isCustom && this.customAudio) {
        this.customAudio.play().catch(() => {});
      } else {
        this.startSynthwaveBGM();
      }
      return true;
    } else {
      // Pause
      this.isPausedMusic = true;
      if (this.customAudio) {
        this.customAudio.pause();
      }
      this.stopSynthwaveBGM();
      return false;
    }
  }

  nextTrack() {
    if (this.playlist.length === 0) return;
    if (this.isShuffle) {
      this.currentTrackIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    }
    this.init();
    this.playCurrentTrack();
  }

  prevTrack() {
    if (this.playlist.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.init();
    this.playCurrentTrack();
  }

  handleTrackEnded() {
    if (this.loopMode === 'one') {
      if (this.customAudio) {
        this.customAudio.currentTime = 0;
        this.customAudio.play().catch(() => {});
      }
    } else if (this.loopMode === 'all') {
      this.nextTrack();
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    return this.isShuffle;
  }

  cycleLoopMode() {
    const modes = ['all', 'one', 'none'];
    const currentIdx = modes.indexOf(this.loopMode);
    this.loopMode = modes[(currentIdx + 1) % modes.length];
    return this.loopMode;
  }

  addCustomTrack(name, url, fileBlob) {
    const newTrack = {
      id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name ? name.trim().slice(0, 35) : 'CUSTOM_TRACK.MP3',
      author: 'User Track',
      url: url || (fileBlob ? URL.createObjectURL(fileBlob) : ''),
      isCustom: true,
      isFavorite: true, // auto-mark newly added track as favorite
    };

    this.playlist.push(newTrack);
    this.savePlaylistPreferences();

    // Switch to newly added track immediately
    this.playTrackById(newTrack.id);
    return newTrack;
  }

  removeTrack(trackId) {
    const idx = this.playlist.findIndex((t) => t.id === trackId);
    if (idx === -1) return false;

    // Cannot delete default built-in synthwave stations
    if (!this.playlist[idx].isCustom) return false;

    this.playlist.splice(idx, 1);
    this.savePlaylistPreferences();

    if (this.currentTrackIndex >= this.playlist.length) {
      this.currentTrackIndex = Math.max(0, this.playlist.length - 1);
    }
    this.playCurrentTrack();
    return true;
  }

  toggleFavoriteTrack(trackId) {
    const track = this.playlist.find((t) => t.id === trackId);
    if (track) {
      track.isFavorite = !track.isFavorite;
      this.savePlaylistPreferences();
      return track.isFavorite;
    }
    return false;
  }

  // --- VOLUME & MUTE CONTROLS ---

  setMasterVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.masterVolume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : clamped, this.ctx.currentTime);
    }
  }

  setMusicVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.musicVolume = clamped;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : clamped, this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.isMusicMuted || this.muted ? 0 : clamped;
    }
  }

  setSfxVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.sfxVolume = clamped;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.isSfxMuted ? 0 : clamped, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.muted || this.isMusicMuted ? 0 : this.musicVolume;
    }
    return this.muted;
  }

  setMusicMute(muted) {
    this.isMusicMuted = Boolean(muted);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume, this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.isMusicMuted || this.muted ? 0 : this.musicVolume;
    }
  }

  setSfxMute(muted) {
    this.isSfxMuted = Boolean(muted);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.isSfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
    }
  }

  // --- SOUND EFFECTS (SFX) ---

  playShoot(pitchMultiplier = 1) {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playLaser() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  playExplosion() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  playDash() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.16);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playLevelUp() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C E G C arpeggio

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  playBossAlert() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.22;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  playMedkitPickup() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  playAmmoBoxPickup(weaponType = 'homing') {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const basePitches = {
      homing: [300, 450, 600],
      laser: [600, 800, 1100],
      shotgun: [180, 260, 400],
      orbit: [350, 520, 700],
    };
    const pitches = basePitches[weaponType] || [300, 450, 600];

    pitches.forEach((f, i) => {
      const t = now + i * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  playLowHealthWarning() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    [0, 0.15].forEach((offset) => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  playUIClick() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playHeal() {
    return this.playMedkitPickup();
  }

  playAmmoPickup(weaponType = 'homing') {
    return this.playAmmoBoxPickup(weaponType);
  }

  playHit() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playWeaponDegrade() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playShieldBreak() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playTeleport() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // --- MODULE 3: BOSS PHASE, ARTILLERY DANGER ZONE & MUTATION SFX ---

  playBossPhaseChange(phase = 2) {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    if (phase === 3) {
      // Phase 3: Enrage Overclock Alarm (Triple Distorted Siren Burst)
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.16;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.15);

        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.16);
      }
    } else {
      // Phase 2: Heavy Radial Overdrive Alert (Dual Rising Siren Chords)
      [0, 0.18].forEach((offset, idx) => {
        const t = now + offset;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(idx === 0 ? 330 : 495, t);
        osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 550 : 880, t + 0.16);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.17);
      });
    }
  }

  playArtilleryWarning() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    // 3 rapid descending telemetry warning pings (Target Lock)
    const pitches = [1200, 880, 580];
    pitches.forEach((freq, idx) => {
      const t = now + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.06);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.07);
    });
  }

  playArtilleryExplosion() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    // Deep Sub-bass Seismic Detonation
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.45);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.46);
  }

  playMutation() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    // Bio-mechanical DNA glitch warp resonance
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(680, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.28);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.29);
  }

  playEnemyMutation() {
    return this.playMutation();
  }

  playOverclockActive() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    // Sandevistan Pitch-Down Sub-Bass Warp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.46);
  }

  playOrbitalStrike() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.62);
  }

  playVictory() {
    if (!this.ctx || this.muted || this.isSfxMuted) return;
    const now = this.ctx.currentTime;
    // Triumphant Cyber Synth Arpeggio: C4, E4, G4, B4, C5
    const notes = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.29);
    });
  }

  announce(text) {
    if (this.muted) return;
    // 1. Play procedural synthetic chime
    if (this.ctx && !this.isSfxMuted) {
      const now = this.ctx.currentTime;
      const chime = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(880, now);
      chime.frequency.exponentialRampToValueAtTime(440, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      chime.connect(gain);
      gain.connect(this.sfxGain);
      chime.start(now);
      chime.stop(now + 0.19);
    }

    // 2. Browser SpeechSynthesis API (Robotic Cyber Voice) if supported
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
        window.speechSynthesis.cancel(); // cancel any active speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 0.85;
        utterance.volume = Math.min(1.0, this.sfxVolume);
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
