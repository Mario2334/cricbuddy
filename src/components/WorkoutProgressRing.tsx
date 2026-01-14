/**
 * Workout Progress Ring Component
 * 
 * Displays overall workout progress with animated circular progress indicator,
 * milestone celebrations, and phase-based visual feedback.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutTheme, WorkoutPhase, WorkoutMilestone } from '../types/timer';

interface WorkoutProgressRingProps {
  progress: number; // 0-100 percentage
  theme: WorkoutTheme;
  phase: WorkoutPhase;
  elapsedTime: string; // Formatted time string (MM:SS)
  estimatedRemainingTime?: string; // Formatted time string (MM:SS)
  completedExercises: number;
  totalExercises: number;
  onMilestone?: (milestone: WorkoutMilestone) => void;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

/**
 * Animated circular progress ring showing overall workout progress
 */
export const WorkoutProgressRing: React.FC<WorkoutProgressRingProps> = ({
  progress,
  theme,
  phase,
  elapsedTime,
  estimatedRemainingTime,
  completedExercises,
  totalExercises,
  onMilestone,
  size = 'medium',
  showDetails = true,
}) => {
  // Animation values
  const [progressAnimation] = useState(new Animated.Value(0));
  const [celebrationAnimation] = useState(new Animated.Value(0));
  const [phaseTransitionAnimation] = useState(new Animated.Value(1));

  // Component state
  const [lastMilestone, setLastMilestone] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animate progress changes
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();

    // Check for milestone triggers
    checkForMilestones(progress);
  }, [progress, progressAnimation]);

  // Animate phase transitions
  useEffect(() => {
    setIsTransitioning(true);
    Animated.sequence([
      Animated.timing(phaseTransitionAnimation, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(phaseTransitionAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => setIsTransitioning(false));
  }, [phase, phaseTransitionAnimation]);

  // Check for milestone celebrations
  const checkForMilestones = (currentProgress: number) => {
    const milestones = [25, 50, 75, 100];
    
    for (const milestone of milestones) {
      if (currentProgress >= milestone && lastMilestone < milestone) {
        setLastMilestone(milestone);
        triggerMilestoneCelebration(milestone);
        break;
      }
    }
  };

  // Trigger milestone celebration
  const triggerMilestoneCelebration = (milestone: number) => {
    const milestoneData: WorkoutMilestone = {
      type: milestone === 25 ? 'quarter' : 
            milestone === 50 ? 'half' : 
            milestone === 75 ? 'three_quarters' : 'complete',
      message: milestone === 25 ? 'Great start! 25% complete!' :
               milestone === 50 ? 'Halfway there! Keep it up!' :
               milestone === 75 ? 'Almost done! Final push!' :
               'Workout Complete! Amazing job!',
      celebrationLevel: milestone === 25 ? 'small' :
                       milestone === 50 ? 'medium' :
                       milestone === 75 ? 'medium' : 'large',
    };

    // Trigger celebration animation
    Animated.sequence([
      Animated.timing(celebrationAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(celebrationAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Notify parent component
    if (onMilestone) {
      onMilestone(milestoneData);
    }
  };

  // Get size-specific dimensions
  const getDimensions = () => {
    const screenWidth = Dimensions.get('window').width;
    
    switch (size) {
      case 'small':
        return { 
          diameter: Math.min(screenWidth * 0.3, 120), 
          strokeWidth: 6, 
          fontSize: 16,
          detailFontSize: 10,
        };
      case 'large':
        return { 
          diameter: Math.min(screenWidth * 0.7, 280), 
          strokeWidth: 12, 
          fontSize: 32,
          detailFontSize: 14,
        };
      default:
        return { 
          diameter: Math.min(screenWidth * 0.5, 200), 
          strokeWidth: 8, 
          fontSize: 24,
          detailFontSize: 12,
        };
    }
  };

  const { diameter, strokeWidth, fontSize, detailFontSize } = getDimensions();
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash offset for progress
  const strokeDashoffset = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  // Get phase-specific icon
  const getPhaseIcon = () => {
    switch (phase) {
      case 'warmup':
        return 'flame-outline';
      case 'strength':
        return 'barbell-outline';
      case 'core':
        return 'body-outline';
      case 'cooldown':
        return 'snow-outline';
      default:
        return 'fitness-outline';
    }
  };

  // Get phase display name
  const getPhaseDisplayName = () => {
    switch (phase) {
      case 'warmup':
        return 'Warm Up';
      case 'strength':
        return 'Strength';
      case 'core':
        return 'Core';
      case 'cooldown':
        return 'Cool Down';
      default:
        return 'Workout';
    }
  };

  // Render progress ring
  const renderProgressRing = () => (
    <View style={[styles.progressRingContainer, { width: diameter, height: diameter }]}>
      {/* Background circle */}
      <View
        style={[
          styles.progressRingBackground,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: strokeWidth,
            borderColor: `${theme.progressColor}15`, // 15% opacity
          },
        ]}
      />
      
      {/* Progress circle */}
      <Animated.View
        style={[
          styles.progressRing,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: theme.progressColor,
            transform: [
              { rotate: '-90deg' },
              { scale: phaseTransitionAnimation },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: diameter / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: theme.progressColor,
              transform: [
                { rotate: progressAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0deg', '360deg'],
                }) },
              ],
            },
          ]}
        />
      </Animated.View>

      {/* Celebration overlay */}
      <Animated.View
        style={[
          styles.celebrationOverlay,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            opacity: celebrationAnimation,
            transform: [
              { scale: celebrationAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.1],
              }) },
            ],
          },
        ]}
      />
    </View>
  );

  // Render center content
  const renderCenterContent = () => (
    <Animated.View
      style={[
        styles.centerContent,
        {
          width: diameter - strokeWidth * 2,
          height: diameter - strokeWidth * 2,
          borderRadius: (diameter - strokeWidth * 2) / 2,
          backgroundColor: theme.backgroundColor,
          transform: [{ scale: phaseTransitionAnimation }],
        },
      ]}
    >
      {/* Progress percentage */}
      <Text
        style={[
          styles.progressPercentage,
          {
            fontSize,
            color: theme.textColor,
          },
        ]}
      >
        {Math.round(progress)}%
      </Text>

      {/* Phase indicator */}
      <View style={styles.phaseIndicator}>
        <Ionicons
          name={getPhaseIcon() as any}
          size={fontSize / 2}
          color={theme.primaryColor}
        />
        <Text
          style={[
            styles.phaseText,
            {
              fontSize: detailFontSize,
              color: theme.primaryColor,
            },
          ]}
        >
          {getPhaseDisplayName()}
        </Text>
      </View>

      {/* Exercise progress */}
      {showDetails && totalExercises > 0 && (
        <Text
          style={[
            styles.exerciseProgress,
            {
              fontSize: detailFontSize - 2,
              color: theme.textColor,
              opacity: 0.7,
            },
          ]}
        >
          {completedExercises}/{totalExercises} exercises
        </Text>
      )}
    </Animated.View>
  );

  // Render time details
  const renderTimeDetails = () => {
    if (!showDetails || size === 'small') {
      return null;
    }

    return (
      <View style={styles.timeDetails}>
        <View style={styles.timeDetailItem}>
          <Ionicons name="time-outline" size={16} color={theme.textColor} />
          <Text style={[styles.timeDetailLabel, { color: theme.textColor }]}>
            Elapsed
          </Text>
          <Text style={[styles.timeDetailValue, { color: theme.primaryColor }]}>
            {elapsedTime}
          </Text>
        </View>

        {estimatedRemainingTime && (
          <View style={styles.timeDetailItem}>
            <Ionicons name="hourglass-outline" size={16} color={theme.textColor} />
            <Text style={[styles.timeDetailLabel, { color: theme.textColor }]}>
              Remaining
            </Text>
            <Text style={[styles.timeDetailValue, { color: theme.accentColor }]}>
              {estimatedRemainingTime}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render milestone indicator
  const renderMilestoneIndicator = () => {
    if (lastMilestone === 0) {
      return null;
    }

    const milestoneIcon = lastMilestone === 100 ? 'trophy' : 'star';
    const milestoneColor = lastMilestone === 100 ? '#FFD700' : theme.accentColor;

    return (
      <Animated.View
        style={[
          styles.milestoneIndicator,
          {
            opacity: celebrationAnimation,
            transform: [
              { scale: celebrationAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }) },
            ],
          },
        ]}
      >
        <Ionicons name={milestoneIcon} size={20} color={milestoneColor} />
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.progressContainer}>
        {renderProgressRing()}
        {renderCenterContent()}
        {renderMilestoneIndicator()}
      </View>
      {renderTimeDetails()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginVertical: 8,
  },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressRingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingBackground: {
    position: 'absolute',
  },
  progressRing: {
    position: 'absolute',
  },
  celebrationOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressPercentage: {
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  phaseText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseProgress: {
    fontWeight: '500',
    textAlign: 'center',
  },
  milestoneIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  timeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 16,
    gap: 16,
  },
  timeDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  timeDetailLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  timeDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});