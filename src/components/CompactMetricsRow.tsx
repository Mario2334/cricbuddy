/**
 * CompactMetricsRow Component
 * 
 * Displays workout metrics in vertical stacks on left and right sides.
 * Designed to be placed alongside the progress ring in the same row.
 * 
 * Left stack: Heart Rate, VO2 Max (stacked vertically)
 * Right stack: Calories, Remaining Time (stacked vertically)
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutTheme } from '../types/timer';

/**
 * Props for the CompactMetricsRow component
 */
export interface CompactMetricsRowProps {
  /** Current heart rate in BPM, null if unavailable */
  heartRate: number | null;
  /** Current VO2 max in mL/kg/min, null if unavailable */
  vo2Max?: number | null;
  /** Total calories burned */
  calories: number;
  /** Formatted active time string (MM:SS) */
  activeTime: string;
  /** Theme configuration for styling */
  theme: WorkoutTheme;
}

/** Maximum height constraint for the metrics row (Requirements: 4.2) */
export const METRICS_ROW_MAX_HEIGHT = 36;

/**
 * Formats heart rate for display, showing "--" for unavailable values
 * Requirements: 4.5
 */
export const formatHeartRate = (heartRate: number | null): string => {
  if (heartRate === null || heartRate === undefined) {
    return '--';
  }
  return Math.round(heartRate).toString();
};

/**
 * Formats VO2 max for display, showing "--" for unavailable values
 */
export const formatVo2Max = (vo2Max: number | null | undefined): string => {
  if (vo2Max === null || vo2Max === undefined) {
    return '--';
  }
  return vo2Max.toFixed(1);
};

/**
 * Formats calories for display
 */
export const formatCalories = (calories: number): string => {
  return Math.round(calories).toString();
};

/**
 * Left metrics stack component (Heart Rate, VO2 Max, Elapsed Time)
 */
export const LeftMetricsStack: React.FC<{
  heartRate: number | null;
  vo2Max: number | null | undefined;
  elapsedTime?: string;
  theme: WorkoutTheme;
}> = ({ heartRate, vo2Max, elapsedTime, theme }) => (
  <View style={styles.verticalStack}>
    {/* Heart Rate */}
    <View style={styles.metricCard}>
      <View style={[styles.iconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
        <Ionicons name="heart" size={14} color="#EF4444" />
      </View>
      <Text style={[styles.metricValue, { color: theme.textColor }]}>
        {formatHeartRate(heartRate)}
      </Text>
    </View>
    {/* VO2 Max */}
    <View style={styles.metricCard}>
      <View style={[styles.iconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
        <Ionicons name="pulse" size={14} color="#8B5CF6" />
      </View>
      <Text style={[styles.metricValue, { color: theme.textColor }]}>
        {formatVo2Max(vo2Max)}
      </Text>
    </View>
    {/* Elapsed Time */}
    {elapsedTime && (
      <View style={styles.metricCard}>
        <View style={[styles.iconBadge, { backgroundColor: `${theme.primaryColor}20` }]}>
          <Ionicons name="time" size={14} color={theme.primaryColor} />
        </View>
        <Text style={[styles.metricValue, { color: theme.textColor }]}>
          {elapsedTime}
        </Text>
      </View>
    )}
  </View>
);

/**
 * Right metrics stack component (Calories & Remaining Time)
 */
export const RightMetricsStack: React.FC<{
  calories: number;
  remainingTime: string;
  theme: WorkoutTheme;
}> = ({ calories, remainingTime, theme }) => (
  <View style={styles.verticalStack}>
    {/* Calories */}
    <View style={styles.metricCard}>
      <View style={[styles.iconBadge, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
        <Ionicons name="flame" size={14} color="#F97316" />
      </View>
      <Text style={[styles.metricValue, { color: theme.textColor }]}>
        {formatCalories(calories)}
      </Text>
    </View>
    {/* Remaining Time */}
    <View style={styles.metricCard}>
      <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
        <Ionicons name="hourglass-outline" size={14} color="#10B981" />
      </View>
      <Text style={[styles.metricValue, { color: theme.textColor }]}>
        {remainingTime}
      </Text>
    </View>
  </View>
);

/**
 * CompactMetricsRow - Legacy component for backward compatibility
 * Now renders as a horizontal row with two vertical stacks
 */
export const CompactMetricsRow: React.FC<CompactMetricsRowProps> = ({
  heartRate,
  vo2Max,
  calories,
  activeTime,
  theme,
}) => {
  return (
    <View style={styles.container}>
      <LeftMetricsStack heartRate={heartRate} vo2Max={vo2Max} theme={theme} />
      <RightMetricsStack calories={calories} remainingTime={activeTime} theme={theme} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  verticalStack: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 70,
  },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 5,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});

export default CompactMetricsRow;
