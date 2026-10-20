import express from 'express';
import { sanitizeDomainText } from './domain/entities/HighScore.js';
import { InMemoryHighScoreRepository } from './infrastructure/repositories/InMemoryHighScoreRepository.js';
import { SubmitHighScoreUseCase } from './application/use-cases/SubmitHighScoreUseCase.js';
import { GetLeaderboardUseCase } from './application/use-cases/GetLeaderboardUseCase.js';
import { GetHealthUseCase } from './application/use-cases/GetHealthUseCase.js';
import { HighScoreController } from './interfaces/http/controllers/HighScoreController.js';
import { HealthController } from './interfaces/http/controllers/HealthController.js';
import { createApiRouter } from './interfaces/http/routes/apiRoutes.js';
import { buildExpressApp } from './infrastructure/web/expressApp.js';

// Backward compatibility re-export of sanitizeText and HighScoreEntry
export const sanitizeText = sanitizeDomainText;

export interface HighScoreEntry {
  id: string;
  playerName: string;
  avatar?: string;
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  favoriteWeapon: string;
  createdAt: string;
}

/**
 * Clean Architecture Composition Root:
 * Wires Domain Entities -> Application Ports/UseCases -> Interface Controllers -> Infrastructure Express App
 */
export function createServer(): express.Application {
  const repository = new InMemoryHighScoreRepository(true);
  const submitUseCase = new SubmitHighScoreUseCase(repository);
  const getLeaderboardUseCase = new GetLeaderboardUseCase(repository);
  const getHealthUseCase = new GetHealthUseCase();

  const highScoreController = new HighScoreController(submitUseCase, getLeaderboardUseCase);
  const healthController = new HealthController(getHealthUseCase);

  const apiRouter = createApiRouter(highScoreController, healthController);
  const app = buildExpressApp(apiRouter);

  return app;
}

const app = createServer();
const PORT = process.env.PORT || 3001;
const isMain = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
);

if (isMain) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`⚡ Cyberpunk Neon Survivors Server is RUNNING!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🎮 Game Arcade: http://localhost:${PORT}`);
    console.log(`🏆 Highscore API: http://localhost:${PORT}/api/highscores`);
    console.log(`🏗️ Architecture: Clean Architecture (Hexagonal / Onion)`);
    console.log(`====================================================`);
  });
}

export default app;
