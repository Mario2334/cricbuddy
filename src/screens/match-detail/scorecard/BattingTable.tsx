import React from 'react';
import { View } from 'react-native';
import { colors, palette } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { IconTile } from '../../../ui/IconTile';
import { tableStyles as t } from './tableStyles';

const COLS = { rb: 64, fours: 32, sixes: 32, sr: 54 } as const;

export interface BattingTableProps {
  batting: any[];
}

/** Batter, R(B), 4s, 6s, SR. Not-out batters get a green bar and a star. */
export function BattingTable({ batting }: BattingTableProps) {
  return (
    <View style={t.card}>
      <View style={t.clip}>
        <View style={t.titleRow}>
          <IconTile icon="bat" tone="emerald" size="sm" style={t.titleIcon} />
          <AppText variant="h3">Batting</AppText>
        </View>
        <View style={t.header}>
          <AppText style={t.headName}>Batter</AppText>
          <AppText style={[t.headText, { width: COLS.rb }]}>R(B)</AppText>
          <AppText style={[t.headText, { width: COLS.fours }]}>4s</AppText>
          <AppText style={[t.headText, { width: COLS.sixes }]}>6s</AppText>
          <AppText style={[t.headText, { width: COLS.sr }]}>SR</AppText>
        </View>
        {batting.map((batsman: any, index: number) => {
          const notOut = batsman.how_to_out === 'not out';
          return (
            <View key={batsman.player_id || `batsman-${index}`} style={[t.row, index % 2 === 1 && t.rowAlt]}>
              {notOut ? <View style={t.notOutBar} /> : null}
              <View style={t.nameCell}>
                <AppText variant="smallStrong" numberOfLines={1} color={notOut ? palette.green700 : colors.text}>
                  {batsman.name || 'Unknown'}
                  {notOut ? '*' : ''}
                </AppText>
                {batsman.how_to_out && !notOut ? (
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {batsman.how_to_out}
                  </AppText>
                ) : null}
              </View>
              <AppText style={[t.num, { width: COLS.rb }]} numberOfLines={1}>
                {batsman.runs || 0}({batsman.balls || 0})
              </AppText>
              <AppText style={[t.num, { width: COLS.fours }]}>{batsman['4s'] || 0}</AppText>
              <AppText style={[t.num, { width: COLS.sixes }]}>{batsman['6s'] || 0}</AppText>
              <AppText style={[t.num, { width: COLS.sr }]} color={colors.textSoft}>
                {batsman.SR || '0.00'}
              </AppText>
            </View>
          );
        })}
      </View>
      <View pointerEvents="none" style={t.rim} />
    </View>
  );
}

export default BattingTable;
