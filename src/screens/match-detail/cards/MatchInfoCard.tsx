import React from 'react';
import { InfoRow } from '../../../ui/InfoRow';
import type { IconName } from '../../../ui/icons';
import { SectionCard } from '../../../ui/SectionCard';
import { rowTone } from '../styleUtils';

export interface MatchInfoCardProps {
  tournamentName: string;
  teamNames: { team1: string; team2: string };
  groundName?: string;
  city?: string;
  animateIndex?: number;
}

export function MatchInfoCard({ tournamentName, teamNames, groundName, city, animateIndex }: MatchInfoCardProps) {
  const rows: Array<{ key: string; icon: IconName; label: string; value: string }> = [
    { key: 'tournament', icon: 'trophy', label: 'Tournament', value: tournamentName },
    { key: 'teams', icon: 'team', label: 'Teams', value: `${teamNames.team1} vs ${teamNames.team2}` },
  ];
  if (groundName) rows.push({ key: 'ground', icon: 'pin', label: 'Ground', value: groundName });
  if (city) rows.push({ key: 'city', icon: 'city', label: 'City', value: city });

  return (
    <SectionCard title="Match Information" icon="stadium" animateIndex={animateIndex}>
      {rows.map((row, i) => (
        <InfoRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          value={row.value}
          tone={rowTone(i)}
          last={i === rows.length - 1}
        />
      ))}
    </SectionCard>
  );
}

export default MatchInfoCard;
