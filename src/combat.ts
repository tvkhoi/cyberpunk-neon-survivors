import { CombatDomainService } from './domain/services/CombatDomainService.js';

/**
 * Combat damage & crit calculation engine following Clean Architecture Domain rules
 */
export function calculateDamage(
  baseDamage: number,
  damageMultiplier: number = 1.0,
  critChance: number = 0.15,
  critMultiplier: number = 2.0,
  roll: number = Math.random()
): { finalDamage: number; isCrit: boolean } {
  return CombatDomainService.calculateDamage(
    baseDamage,
    damageMultiplier,
    critChance,
    critMultiplier,
    roll
  );
}
