import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HighScore } from '../src/domain/entities/HighScore.js';
import { PlayerProfile, AVATAR_ARCHETYPES } from '../src/domain/entities/PlayerProfile.js';
import { CombatDomainService } from '../src/domain/services/CombatDomainService.js';
import { IHighScoreRepository } from '../src/application/ports/IHighScoreRepository.js';
import { SubmitHighScoreUseCase } from '../src/application/use-cases/SubmitHighScoreUseCase.js';
import { GetLeaderboardUseCase } from '../src/application/use-cases/GetLeaderboardUseCase.js';

// In-Memory Repository Implementation for Clean Architecture Testing
class InMemoryHighScoreRepository implements IHighScoreRepository {
  private items: HighScore[] = [];

  async save(highScore: HighScore) {
    this.items.push(highScore);
    this.items.sort((a, b) => b.score - a.score);
    if (this.items.length > 50) {
      this.items = this.items.slice(0, 50);
    }
    const rank = this.items.findIndex((s) => s.id === highScore.id) + 1;
    return {
      entry: highScore,
      rank,
    };
  }

  async findTop(limit: number = 10): Promise<HighScore[]> {
    return this.items.slice(0, limit);
  }

  async count(): Promise<number> {
    return this.items.length;
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

describe('Module 5: Clean Architecture, DDD Entities & Use Cases Tests', () => {
  it('1. HighScore Domain Entity: validates required fields, throws on bad input, and sanitizes XSS', () => {
    // Throws on empty playerName
    assert.throws(
      () => new HighScore({ playerName: '', score: 1000 }),
      /Tên người chơi/
    );

    // Throws on NaN / non-finite score
    assert.throws(
      () => new HighScore({ playerName: 'TEST', score: NaN }),
      /Điểm số/
    );
    assert.throws(
      () => new HighScore({ playerName: 'TEST', score: Infinity }),
      /Điểm số/
    );

    // Sanitizes malicious input and clamps bounds
    const entity = new HighScore({
      playerName: '<script>alert(1)</script>NEO',
      avatar: '<style>',
      score: 500000,
      wave: -5,
      kills: -10,
    });

    assert.equal(entity.playerName.includes('<'), false);
    assert.equal(entity.wave, 1, 'Negative wave clamped to 1');
    assert.equal(entity.kills, 0, 'Negative kills clamped to 0');
    assert.equal(entity.score, 500000);
  });

  it('2. PlayerProfile Domain Entity: assigns archetypes and calculates specialized stat perks', () => {
    const profile = new PlayerProfile('PHANTOM_PILOT', 'phantom');
    assert.equal(profile.name, 'PHANTOM_PILOT');
    assert.equal(profile.avatar.id, 'phantom');
    assert.equal(profile.avatar.speedBonus, 1.15);

    // Switch to Reaper (+15% Crit)
    profile.updateProfile('REAPER_BLADE', 'reaper');
    assert.equal(profile.name, 'REAPER_BLADE');
    assert.equal(profile.avatar.id, 'reaper');
    assert.equal(profile.avatar.critBonus, 0.15);

    // Switch to Titan (+35 Shield)
    profile.updateProfile('TITAN_WALL', 'titan');
    assert.equal(profile.avatar.shieldBonus, 35);
  });

  it('3. CombatDomainService: provides pure, deterministic combat damage calculations', () => {
    // Non-crit test
    const nonCrit = CombatDomainService.calculateDamage(40, 1.5, 0.1, 2.0, 0.8);
    assert.equal(nonCrit.isCrit, false);
    assert.equal(nonCrit.finalDamage, 60); // 40 * 1.5

    // Crit test
    const crit = CombatDomainService.calculateDamage(40, 1.5, 0.1, 2.0, 0.05);
    assert.equal(crit.isCrit, true);
    assert.equal(crit.finalDamage, 120); // 40 * 1.5 * 2.0
  });

  it('4. SubmitHighScoreUseCase & GetLeaderboardUseCase: successfully processes submissions and retrieves rankings', async () => {
    const repo = new InMemoryHighScoreRepository();
    const submitUseCase = new SubmitHighScoreUseCase(repo);
    const getLeaderboardUseCase = new GetLeaderboardUseCase(repo);

    // Submit player 1
    const res1 = await submitUseCase.execute({
      playerName: 'PILOT_ALPHA',
      avatar: '⚡',
      score: 120000,
      wave: 20,
    });
    assert.equal(res1.rank, 1);
    assert.equal(res1.data.playerName, 'PILOT_ALPHA');

    // Submit player 2 with higher score -> takes rank 1
    const res2 = await submitUseCase.execute({
      playerName: 'PILOT_OMEGA',
      avatar: '🌟',
      score: 250000,
      wave: 35,
    });
    assert.equal(res2.rank, 1);

    // Retrieve leaderboard
    const top = await getLeaderboardUseCase.execute(10);
    assert.equal(top.success, true);
    assert.equal(top.data.length, 2);
    assert.equal(top.data[0].playerName, 'PILOT_OMEGA');
    assert.equal(top.data[0].score, 250000);
    assert.equal(top.data[1].playerName, 'PILOT_ALPHA');
    assert.equal(top.data[1].score, 120000);
  });
});
