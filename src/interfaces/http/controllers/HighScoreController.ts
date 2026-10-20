import { Request, Response } from 'express';
import { SubmitHighScoreUseCase } from '../../../application/use-cases/SubmitHighScoreUseCase.js';
import { GetLeaderboardUseCase } from '../../../application/use-cases/GetLeaderboardUseCase.js';

export class HighScoreController {
  constructor(
    private readonly submitUseCase: SubmitHighScoreUseCase,
    private readonly getLeaderboardUseCase: GetLeaderboardUseCase
  ) {}

  public getLeaderboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.query.limit ? Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10)) : 10;
      const result = await this.getLeaderboardUseCase.execute(limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Lỗi lấy bảng xếp hạng.' });
    }
  };

  public submitScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerName, avatar, score, wave, kills, maxCombo, favoriteWeapon } = req.body;

      if (
        !playerName ||
        typeof score !== 'number' ||
        !Number.isFinite(score) ||
        Number.isNaN(score)
      ) {
        res.status(400).json({
          success: false,
          error: 'Tên người chơi (playerName) hợp lệ và điểm số hữu hạn là bắt buộc.',
        });
        return;
      }

      const result = await this.submitUseCase.execute({
        playerName,
        avatar,
        score,
        wave,
        kills,
        maxCombo,
        favoriteWeapon,
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Dữ liệu điểm số không hợp lệ.',
      });
    }
  };
}
