import { Router } from 'express';
import { HighScoreController } from '../controllers/HighScoreController.js';
import { HealthController } from '../controllers/HealthController.js';

export function createApiRouter(
  highScoreController: HighScoreController,
  healthController: HealthController
): Router {
  const router = Router();

  router.get('/health', healthController.getHealth);
  router.get('/highscores', highScoreController.getLeaderboard);
  router.post('/highscores', highScoreController.submitScore);

  return router;
}
