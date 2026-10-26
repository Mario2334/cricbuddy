import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../../theme';
import { Chip } from '../../../ui/Chip';
import { SectionCard } from '../../../ui/SectionCard';
import { Skeleton } from '../../../ui/Skeleton';
import type { AiReport, PoolPlayer } from '../types';
import { roleLabel } from '../utils/format';
import { PlayerRow } from './PlayerRow';

export interface BestXIICardProps {
  ai: AiReport | null;
  pool: PoolPlayer[];
  animateIndex?: number;
}

/** The eleven in the model's order, then the twelfth man. */
export function BestXIICard({ ai, pool, animateIndex }: BestXIICardProps) {
  const byId = new Map(pool.map(p => [p.player_id, p]));
  const eleven = ai?.best_xii.filter(p => !p.is_twelfth) ?? [];
  const twelfth = ai?.best_xii.find(p => p.is_twelfth) ?? null;
  return (
    <SectionCard title="Best XII" icon="crown" iconTone="amber" subtitle={ai ? `${eleven.length} to start · ${twelfth ? `${twelfth.name} as 12th man` : 'no reserve named'}` : undefined} animateIndex={animateIndex}>
      {!ai ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={44} />
          ))}
        </View>
      ) : (
        <>
          {eleven.map((p, i) => {
            const pooled = byId.get(p.player_id);
            const maybe = pooled?.availability === 'maybe';
            return (
              <PlayerRow
                key={p.player_id}
                index={i + 1}
                name={p.name}
                photo={pooled?.photo}
                subtitle={`${roleLabel(p.role)}${maybe ? ' · maybe' : ''}`}
                note={p.why}
                right={maybe ? <Chip size="sm" label="Maybe" tone="yellow" selected haptic={false} /> : undefined}
                last={!twelfth && i === eleven.length - 1}
              />
            );
          })}
          {twelfth ? (
            <PlayerRow
              name={twelfth.name}
              photo={byId.get(twelfth.player_id)?.photo}
              subtitle={`${roleLabel(twelfth.role)}${byId.get(twelfth.player_id)?.availability === 'maybe' ? ' · maybe' : ''}`}
              note={twelfth.why}
              right={<Chip size="sm" label="12th man" tone="neutral" selected haptic={false} />}
              last
            />
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: space.sm },
});

export default BestXIICard;
