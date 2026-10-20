import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SoundEngine, BUILTIN_TRACKS } from '../public/js/audio/soundEngine.js';
import { Camera } from '../public/js/engine/camera.js';

describe('Centralized Settings & Cyber Jukebox Test Suite', () => {
  it('should initialize SoundEngine with 4 high-octane synthwave tracks', () => {
    const sound = new SoundEngine();
    assert.ok(sound.playlist.length >= 4);
    assert.equal(BUILTIN_TRACKS.length, 4);

    const track1 = sound.playlist[0];
    assert.equal(track1.id, 'track-1');
    assert.equal(track1.name, 'NEON OVERDRIVE');
    assert.equal(track1.bpm, 125);
    assert.ok(track1.bassNotes.length > 0);
    assert.ok(track1.leadArp.length > 0);
  });

  it('should accurately navigate next and previous tracks in sequential order', () => {
    const sound = new SoundEngine();
    assert.equal(sound.currentTrackIndex, 0);

    sound.nextTrack();
    assert.equal(sound.currentTrackIndex, 1);
    assert.equal(sound.getCurrentTrack().id, 'track-2');

    sound.nextTrack();
    assert.equal(sound.currentTrackIndex, 2);

    sound.prevTrack();
    assert.equal(sound.currentTrackIndex, 1);
  });

  it('should cycle loop modes cleanly between all, one, and none', () => {
    const sound = new SoundEngine();
    assert.equal(sound.loopMode, 'all');

    const mode1 = sound.cycleLoopMode();
    assert.equal(mode1, 'one');
    assert.equal(sound.loopMode, 'one');

    const mode2 = sound.cycleLoopMode();
    assert.equal(mode2, 'none');

    const mode3 = sound.cycleLoopMode();
    assert.equal(mode3, 'all');
  });

  it('should toggle shuffle mode on and off', () => {
    const sound = new SoundEngine();
    assert.equal(sound.isShuffle, false);

    const shuffled = sound.toggleShuffle();
    assert.equal(shuffled, true);
    assert.equal(sound.isShuffle, true);

    const unshuffled = sound.toggleShuffle();
    assert.equal(unshuffled, false);
    assert.equal(sound.isShuffle, false);
  });

  it('should add custom user audio tracks and switch to them', () => {
    const sound = new SoundEngine();
    const initialLen = sound.playlist.length;

    const newTrack = sound.addCustomTrack('MIDNIGHT_RUNNER', 'https://example.com/synth.mp3', null);
    assert.ok(newTrack.id.startsWith('custom-'));
    assert.equal(newTrack.name, 'MIDNIGHT_RUNNER');
    assert.equal(newTrack.isCustom, true);
    assert.equal(newTrack.isFavorite, true); // new custom tracks auto-favorited
    assert.equal(sound.playlist.length, initialLen + 1);

    // Current active track should now be the new track
    assert.equal(sound.getCurrentTrack().id, newTrack.id);
  });

  it('should toggle favorite status of any track', () => {
    const sound = new SoundEngine();
    const track = sound.playlist[2]; // track-3 (Matrix Overclock)
    const initialFav = track.isFavorite;

    const toggled1 = sound.toggleFavoriteTrack(track.id);
    assert.equal(toggled1, !initialFav);
    assert.equal(track.isFavorite, !initialFav);

    const toggled2 = sound.toggleFavoriteTrack(track.id);
    assert.equal(toggled2, initialFav);
    assert.equal(track.isFavorite, initialFav);
  });

  it('should delete custom user tracks but strictly protect built-in tracks from deletion', () => {
    const sound = new SoundEngine();

    // Attempt to delete built-in track
    const cannotDelete = sound.removeTrack('track-1');
    assert.equal(cannotDelete, false, 'Built-in synthwave stations cannot be deleted');

    // Add and delete custom track
    const custom = sound.addCustomTrack('TEST_DELETE', 'https://test.com/audio.mp3', null);
    assert.ok(sound.playlist.some((t) => t.id === custom.id));

    const canDelete = sound.removeTrack(custom.id);
    assert.equal(canDelete, true);
    assert.ok(!sound.playlist.some((t) => t.id === custom.id));
  });

  it('should support granular volume mixing and mute toggles', () => {
    const sound = new SoundEngine();

    // Volume clamps
    sound.setMasterVolume(0.85);
    assert.equal(sound.masterVolume, 0.85);

    sound.setMasterVolume(1.5); // clamps to 1.0
    assert.equal(sound.masterVolume, 1.0);

    sound.setMusicVolume(-0.2); // clamps to 0.0
    assert.equal(sound.musicVolume, 0.0);

    sound.setSfxVolume(0.65);
    assert.equal(sound.sfxVolume, 0.65);

    // Mutes
    assert.equal(sound.muted, false);
    sound.toggleMute();
    assert.equal(sound.muted, true);
    sound.toggleMute();
    assert.equal(sound.muted, false);

    sound.setMusicMute(true);
    assert.equal(sound.isMusicMuted, true);

    sound.setSfxMute(true);
    assert.equal(sound.isSfxMuted, true);
  });

  it('should verify Camera screen shake multiplier can scale and disable trauma shake', () => {
    const camera = new Camera(1920, 1080, 3200, 3200);
    assert.equal(camera.shakeMultiplier, 1.0);

    camera.shakeMultiplier = 0.0; // Disabled
    assert.equal(camera.shakeMultiplier, 0.0);

    camera.shakeMultiplier = 1.5; // Overdrive shake
    assert.equal(camera.shakeMultiplier, 1.5);
  });
});
