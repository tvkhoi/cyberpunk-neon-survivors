import { HighScore } from '../../domain/entities/HighScore.js';
import { IHighScoreRepository } from '../ports/IHighScoreRepository.js';
import { SubmitHighScoreInputDTO, SubmitScoreResponseDTO } from '../dtos/HighScoreDTO.js';

export class SubmitHighScoreUseCase {
  constructor(private readonly repository: IHighScoreRepository) {}

  public async execute(input: SubmitHighScoreInputDTO): Promise<SubmitScoreResponseDTO> {
    if (
      !input.playerName ||
      typeof input.score !== 'number' ||
      !Number.isFinite(input.score) ||
      Number.isNaN(input.score)
    ) {
      throw new Error('Tên người chơi (playerName) hợp lệ và điểm số hữu hạn là bắt buộc.');
    }

    const domainEntity = new HighScore({
      playerName: input.playerName,
      avatar: input.avatar,
      score: input.score,
      wave: input.wave,
      kills: input.kills,
      maxCombo: input.maxCombo,
      favoriteWeapon: input.favoriteWeapon,
    });

    const result = await this.repository.save(domainEntity);

    return {
      success: true,
      message: 'Lưu điểm số vào bảng xếp hạng thành công!',
      rank: result.rank,
      data: result.entry.toJSON(),
    };
  }
}
