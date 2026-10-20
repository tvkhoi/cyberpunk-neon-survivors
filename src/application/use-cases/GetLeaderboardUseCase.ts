import { IHighScoreRepository } from '../ports/IHighScoreRepository.js';
import { LeaderboardResponseDTO } from '../dtos/HighScoreDTO.js';

export class GetLeaderboardUseCase {
  constructor(private readonly repository: IHighScoreRepository) {}

  public async execute(limit: number = 10): Promise<LeaderboardResponseDTO> {
    const safeLimit = Math.max(1, Math.min(50, limit));
    const entries = await this.repository.findTop(safeLimit);

    return {
      success: true,
      count: entries.length,
      data: entries.map((e) => e.toJSON()),
    };
  }
}
