import { HealthResponseDTO } from '../dtos/HighScoreDTO.js';

export class GetHealthUseCase {
  public execute(): HealthResponseDTO {
    return {
      status: 'ok',
      game: 'Cyberpunk Neon Survivors',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
