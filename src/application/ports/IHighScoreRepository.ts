import { HighScore } from '../../domain/entities/HighScore.js';

export interface SaveScoreResult {
  entry: HighScore;
  rank: number;
}

export interface IHighScoreRepository {
  save(entry: HighScore): Promise<SaveScoreResult>;
  findTop(limit: number): Promise<HighScore[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
}
