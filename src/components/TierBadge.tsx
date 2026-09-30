import React from 'react';
import { type Tier, TIER_THEMES } from '../types';

interface TierBadgeProps {
  tier: Tier;
  size?: number;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 44 }) => {
  const theme = TIER_THEMES[tier] || TIER_THEMES.Iron;

  // Abbreviation for tier
  const getAbbreviation = (t: Tier): string => {
    switch (t) {
      case 'Iron': return 'I';
      case 'Bronze': return 'B';
      case 'Silver': return 'S';
      case 'Gold': return 'G';
      case 'Platinum': return 'P';
      case 'Emerald': return 'E';
      case 'Diamond': return 'D';
      case 'Master': return 'M';
      case 'Challenger': return 'C';
      case 'Semi-Pro': return 'PRO';
      default: return 'I';
    }
  };

  const isSemiPro = tier === 'Semi-Pro';

  return (
    <div
      className="tier-badge-container"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: isSemiPro
          ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 25%, #3b82f6 50%, #06b6d4 75%, #10b981 90%, #fbbf24 100%)'
          : theme.gradient,
        backgroundSize: isSemiPro ? '250% 250%' : '100% 100%',
        animation: isSemiPro ? 'proPrismShimmer 5s ease infinite' : undefined,
        boxShadow: isSemiPro
          ? '0 0 16px rgba(139, 92, 246, 0.6), 0 0 8px rgba(6, 182, 212, 0.4), inset 0 0 6px rgba(255, 255, 255, 0.4)'
          : `0 0 12px ${theme.shadow}`,
        border: isSemiPro ? '1px solid rgba(255, 255, 255, 0.5)' : undefined,
      }}
    >
      <div
        className="tier-badge-inner"
        style={{
          backgroundColor: isSemiPro ? 'rgba(10, 15, 29, 0.82)' : 'rgba(0, 0, 0, 0.25)',
          fontSize: `${Math.max(10, size * (isSemiPro ? 0.27 : 0.32))}px`,
          fontWeight: isSemiPro ? '900' : '800',
          letterSpacing: isSemiPro ? '0.5px' : 'normal',
          color: isSemiPro ? '#ffffff' : undefined,
          textShadow: isSemiPro ? '0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(56, 189, 248, 0.8)' : undefined,
        }}
      >
        {getAbbreviation(tier)}
      </div>
    </div>
  );
};
