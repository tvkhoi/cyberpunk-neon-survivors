export interface AvatarConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  visorColor: string;
  desc: string;
  speedBonus: number;
  shieldBonus: number;
  critBonus: number;
  energyBonus: number;
}

export const AVATAR_ARCHETYPES: Record<string, AvatarConfig> = {
  phantom: {
    id: 'phantom',
    name: 'CYBER PHANTOM',
    icon: '⚡',
    color: '#00f0ff',
    visorColor: '#ff007f',
    desc: '+15% Tốc độ di chuyển & lướt né',
    speedBonus: 1.15,
    shieldBonus: 0,
    critBonus: 0,
    energyBonus: 0,
  },
  titan: {
    id: 'titan',
    name: 'NEO TITAN',
    icon: '🛡️',
    color: '#10b981',
    visorColor: '#f59e0b',
    desc: '+35 Giáp ảo & Hồi phục giáp nhanh',
    speedBonus: 1.0,
    shieldBonus: 35,
    critBonus: 0,
    energyBonus: 0,
  },
  reaper: {
    id: 'reaper',
    name: 'VORTEX REAPER',
    icon: '🩸',
    color: '#f43f5e',
    visorColor: '#00f0ff',
    desc: '+15% Tỷ lệ sát thương bạo kích (Crit)',
    speedBonus: 1.0,
    shieldBonus: 0,
    critBonus: 0.15,
    energyBonus: 0,
  },
  valkyrie: {
    id: 'valkyrie',
    name: 'QUANTUM VALKYRIE',
    icon: '🌟',
    color: '#f59e0b',
    visorColor: '#8b5cf6',
    desc: '+30 Năng lượng Bullet-Time làm chậm',
    speedBonus: 1.05,
    shieldBonus: 0,
    critBonus: 0,
    energyBonus: 30,
  },
};

export class PlayerProfile {
  public name: string;
  public avatar: AvatarConfig;

  constructor(name: string = 'CYBER_V', avatarId: string = 'phantom') {
    this.name = name.trim().slice(0, 15) || 'CYBER_V';
    this.avatar = AVATAR_ARCHETYPES[avatarId] || AVATAR_ARCHETYPES.phantom;
  }

  public updateProfile(name: string, avatarId: string): void {
    if (name && typeof name === 'string') {
      this.name = name.trim().slice(0, 15) || 'CYBER_V';
    }
    if (avatarId && AVATAR_ARCHETYPES[avatarId]) {
      this.avatar = AVATAR_ARCHETYPES[avatarId];
    }
  }
}
