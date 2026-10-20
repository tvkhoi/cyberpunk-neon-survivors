import crypto from 'crypto';

export function sanitizeDomainText(input: unknown, maxLen = 20): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"`&/]/g, '') // remove HTML/script injection characters
    .trim()
    .slice(0, maxLen);
}

export interface HighScoreProps {
  id?: string;
  playerName: string;
  avatar?: string;
  score: number;
  wave?: number;
  kills?: number;
  maxCombo?: number;
  favoriteWeapon?: string;
  createdAt?: string;
}

export class HighScore {
  public readonly id: string;
  public readonly playerName: string;
  public readonly avatar: string;
  public readonly score: number;
  public readonly wave: number;
  public readonly kills: number;
  public readonly maxCombo: number;
  public readonly favoriteWeapon: string;
  public readonly createdAt: string;

  constructor(props: HighScoreProps) {
    if (!props.playerName) {
      throw new Error('Tên người chơi (playerName) không được để trống.');
    }
    if (
      typeof props.score !== 'number' ||
      !Number.isFinite(props.score) ||
      Number.isNaN(props.score)
    ) {
      throw new Error('Điểm số (score) phải là một số hữu hạn hợp lệ.');
    }

    this.id = props.id || `score-${crypto.randomUUID()}`;
    this.playerName = sanitizeDomainText(props.playerName, 20) || 'CYBER_ANON';
    this.avatar = sanitizeDomainText(props.avatar, 10) || '⚡';
    this.score = Math.max(0, Math.min(100_000_000, Math.floor(props.score)));
    this.wave = Number.isFinite(props.wave) ? Math.max(1, Math.min(1000, Math.floor(props.wave!))) : 1;
    this.kills = Number.isFinite(props.kills) ? Math.max(0, Math.min(100000, Math.floor(props.kills!))) : 0;
    this.maxCombo = Number.isFinite(props.maxCombo) ? Math.max(0, Math.min(10000, Math.floor(props.maxCombo!))) : 0;
    this.favoriteWeapon = sanitizeDomainText(props.favoriteWeapon, 30) || 'Plasma Homing Missiles';
    this.createdAt = props.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      playerName: this.playerName,
      avatar: this.avatar,
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      maxCombo: this.maxCombo,
      favoriteWeapon: this.favoriteWeapon,
      createdAt: this.createdAt,
    };
  }
}
