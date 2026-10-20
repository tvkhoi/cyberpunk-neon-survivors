import { Request, Response } from 'express';
import { GetHealthUseCase } from '../../../application/use-cases/GetHealthUseCase.js';

export class HealthController {
  constructor(private readonly getHealthUseCase: GetHealthUseCase) {}

  public getHealth = (_req: Request, res: Response): void => {
    const result = this.getHealthUseCase.execute();
    res.json(result);
  };
}
