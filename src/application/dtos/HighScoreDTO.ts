export interface SubmitHighScoreInputDTO {
  playerName: string;
  avatar?: string;
  score: number;
  wave?: number;
  kills?: number;
  maxCombo?: number;
  favoriteWeapon?: string;
}

export interface HighScoreOutputDTO {
  id: string;
  playerName: string;
  avatar: string;
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  favoriteWeapon: string;
  createdAt: string;
}

export interface SubmitScoreResponseDTO {
  success: boolean;
  message: string;
  rank: number;
  data: HighScoreOutputDTO;
}

export interface LeaderboardResponseDTO {
  success: boolean;
  count: number;
  data: HighScoreOutputDTO[];
}

export interface HealthResponseDTO {
  status: string;
  game: string;
  version: string;
  uptime: number;
  timestamp: string;
}
