import React from 'react';
import { SectionCard } from '../../../ui/SectionCard';
import type { AiReport, PoolPlayer } from '../types';
import { PlayerRow } from './PlayerRow';

export interface BattingOrderCardProps {
  ai: AiReport;
  pool: PoolPlayer[];
  animateIndex?: number;
}

export function BattingOrderCard({ ai, pool, animateIndex }: BattingOrderCardProps) {
  const byId = new Map(pool.map(p => [p.player_id, p]));
  const order = [...ai.batting_order].sort((a, b) => a.position - b.position);
  return (
    <SectionCard title="Batting order" icon="bat" iconTone="emerald" subtitle={`${order.slice(0, 2).map(o => o.name).join(' & ')} to open`} animateIndex={animateIndex}>
      {order.map((o, i) => {
        const pooled = byId.get(o.player_id);
        const usual = pooled?.agg?.batting.usual_pos;
        return (
          <PlayerRow
            key={o.player_id}
            index={o.position}
            name={o.name}
            photo={pooled?.photo}
            subtitle={usual ? `Usually bats at ${usual}` : undefined}
            note={o.why}
            last={i === order.length - 1}
          />
        );
      })}
    </SectionCard>
  );
}

export default BattingOrderCard;
