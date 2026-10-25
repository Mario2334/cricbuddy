import React from 'react';
import { View } from 'react-native';
import { colors, palette } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { IconTile } from '../../../ui/IconTile';
import { tableStyles as t } from './tableStyles';

const COLS = { o: 40, m: 30, r: 36, w: 30, econ: 50 } as const;

export interface BowlingTableProps {
  bowling: any[];
}

/** Bowler, O, M, R, W, Econ. */
export function BowlingTable({ bowling }: BowlingTableProps) {
  return (
    <View style={t.card}>
      <View style={t.clip}>
        <View style={t.titleRow}>
          <IconTile icon="ball" tone="teal" size="sm" style={t.titleIcon} />
          <AppText variant="h3">Bowling</AppText>
        </View>
        <View style={t.header}>
          <AppText style={t.headName}>Bowler</AppText>
          <AppText style={[t.headText, { width: COLS.o }]}>O</AppText>
          <AppText style={[t.headText, { width: COLS.m }]}>M</AppText>
          <AppText style={[t.headText, { width: COLS.r }]}>R</AppText>
          <AppText style={[t.headText, { width: COLS.w }]}>W</AppText>
          <AppText style={[t.headText, { width: COLS.econ }]}>Econ</AppText>
        </View>
        {bowling.map((bowler: any, index: number) => {
          const wickets = Number(bowler.wickets) || 0;
          return (
            <View key={bowler.player_id || `bowler-${index}`} style={[t.row, index % 2 === 1 && t.rowAlt]}>
              <View style={t.nameCell}>
                <AppText variant="smallStrong" numberOfLines={1}>
                  {bowler.name || 'Unknown'}
                </AppText>
              </View>
              <AppText style={[t.num, { width: COLS.o }]}>{bowler.overs || 0}</AppText>
              <AppText style={[t.num, { width: COLS.m }]}>{bowler.maidens || 0}</AppText>
              <AppText style={[t.num, { width: COLS.r }]}>{bowler.runs || 0}</AppText>
              <AppText style={[t.num, { width: COLS.w }]} color={wickets > 0 ? palette.green700 : colors.text}>
                {bowler.wickets || 0}
              </AppText>
              <AppText style={[t.num, { width: COLS.econ }]} color={colors.textSoft}>
                {bowler.economy_rate || '0.00'}
              </AppText>
            </View>
          );
        })}
      </View>
      <View pointerEvents="none" style={t.rim} />
    </View>
  );
}

export default BowlingTable;
