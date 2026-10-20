export interface CombatDamageResult {
  finalDamage: number;
  isCrit: boolean;
}

export class CombatDomainService {
  /**
   * Pure calculation of combat damage and critical hit rules
   */
  public static calculateDamage(
    baseDamage: number,
    damageMultiplier: number = 1.0,
    critChance: number = 0.15,
    critMultiplier: number = 2.0,
    roll: number = Math.random()
  ): CombatDamageResult {
    const isCrit = roll < critChance;
    const finalDamage = Math.round(
      baseDamage * damageMultiplier * (isCrit ? critMultiplier : 1.0)
    );
    return { finalDamage, isCrit };
  }
}
