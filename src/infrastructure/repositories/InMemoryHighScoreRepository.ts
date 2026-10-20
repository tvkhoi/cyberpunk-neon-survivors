import { HighScore } from '../../domain/entities/HighScore.js';
import { IHighScoreRepository, SaveScoreResult } from '../../application/ports/IHighScoreRepository.js';

export class InMemoryHighScoreRepository implements IHighScoreRepository {
  private scores: HighScore[] = [];

  constructor(seed: boolean = true) {
    if (seed) {
      this.seedInitialScores();
    }
  }

  private seedInitialScores(): void {
    const seedData = [
      {
        id: 'score-1',
        playerName: 'NEO_V',
        avatar: '⚡',
        score: 125400,
        wave: 25,
        kills: 480,
        maxCombo: 68,
        favoriteWeapon: 'Plasma Homing Missiles',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'score-2',
        playerName: 'CYBER_GHOST',
        avatar: '🌟',
        score: 98200,
        wave: 19,
        kills: 365,
        maxCombo: 52,
        favoriteWeapon: 'Reflective Laser',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'score-3',
        playerName: 'BLADE_RUNNER_99',
        avatar: '🩸',
        score: 74500,
        wave: 15,
        kills: 290,
        maxCombo: 44,
        favoriteWeapon: 'EMP Shotgun',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'score-4',
        playerName: 'SYNTH_WALKER',
        avatar: '🛡️',
        score: 51200,
        wave: 11,
        kills: 195,
        maxCombo: 31,
        favoriteWeapon: 'Orbit Shield',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];

    for (const item of seedData) {
      this.scores.push(new HighScore(item));
    }
  }

  public async save(entry: HighScore): Promise<SaveScoreResult> {
    this.scores.push(entry);
    this.scores.sort((a, b) => b.score - a.score);

    const rank = this.scores.findIndex((s) => s.id === entry.id) + 1;

    if (this.scores.length > 50) {
      this.scores = this.scores.slice(0, 50);
    }

    return {
      entry,
      rank,
    };
  }

  public async findTop(limit: number): Promise<HighScore[]> {
    return [...this.scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public async count(): Promise<number> {
    return this.scores.length;
  }

  public async clear(): Promise<void> {
    this.scores = [];
  }
}
