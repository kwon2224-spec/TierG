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
      default: return 'I';
    }
  };

  return (
    <div
      className="tier-badge-container"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: theme.gradient,
        boxShadow: `0 0 12px ${theme.shadow}`,
      }}
    >
      <div
        className="tier-badge-inner"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          fontSize: `${Math.max(10, size * 0.32)}px`,
        }}
      >
        {getAbbreviation(tier)}
      </div>
    </div>
  );
};
