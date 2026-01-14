/**
 * Interactive Timer Component for Workout Sessions
 * 
 * Displays exercise and rest timers with interactive controls,
 * visual progress indicators, and gesture recognition.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  PanGestureHandler,
  TapGestureHandler,
  State,
  PanGestureHandlerGestureEvent, 
  TapGestureHandlerGestureEvent 
} from 'react-native-gesture-handler';
import { ActiveTimer, TimerType, WorkoutTheme } from '../types/timer';

interface InteractiveTimerProps {
  timer: ActiveTimer;
  theme: WorkoutTheme;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onAdjust?: (seconds: number) => void; // +/- seconds adjustment
  showAdjustControls?: boolean; // Show +15s/-15s buttons for rest timers
  size?: 'small' | 'medium' | 'large';
  showGestures?: boolean; // Enable swipe-to-skip and tap-to-pause
}

/**
 * Interactive timer component with visual progress and gesture controls
 */
export const InteractiveTimer: React.FC<InteractiveTimerProps> = ({
  timer,
  theme,
  onPause,
  onResume,
  onSkip,
  onAdjust,
  showAdjustControls = false,
  size = 'medium',
  showGestures = true,
}) => {
  // Animation values
  const [progressAnimation] = useState(new Animated.Value(timer.progress));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [flashAnimation] = useState(new Animated.Value(0));

  // Component state
  const [isFlashing, setIsFlashing] = useState(false);

  // Update progress animation when timer progress changes
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: timer.progress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [timer.progress, progressAnimation]);

  // Pulse animation for running timers
  useEffect(() => {
    if (timer.state === 'running') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [timer.state, pulseAnimation]);

  // Flash animation for timer completion
  useEffect(() => {
    if (timer.state === 'completed' && !isFlashing) {
      setIsFlashing(true);
      Animated.sequence([
        Animated.timing(flashAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => setIsFlashing(false));
    }
  }, [timer.state, flashAnimation, isFlashing]);

  // Handle tap gesture for pause/resume
  const handleTapGesture = useCallback((event: TapGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE && showGestures) {
      if (timer.state === 'running') {
        onPause();
      } else if (timer.state === 'paused') {
        onResume();
      }
    }
  }, [timer.state, onPause, onResume, showGestures]);

  // Handle pan gesture for swipe-to-skip
  const handlePanGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END && showGestures) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Detect swipe right with sufficient velocity and distance
      if (translationX > 50 && velocityX > 500) {
        onSkip();
      }
    }
  }, [onSkip, showGestures]);

  // Get size-specific dimensions
  const getDimensions = () => {
    switch (size) {
      case 'small':
        return { diameter: 80, strokeWidth: 6, fontSize: 16 };
      case 'large':
        return { diameter: 200, strokeWidth: 12, fontSize: 32 };
      default:
        return { diameter: 120, strokeWidth: 8, fontSize: 24 };
    }
  };

  const { diameter, strokeWidth, fontSize } = getDimensions();
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash offset for progress
  const strokeDashoffset = circumference * (1 - timer.progress);

  // Get timer type specific styling
  const getTimerTypeStyle = () => {
    switch (timer.type) {
      case 'exercise':
        return {
          backgroundColor: theme.primaryColor,
          borderColor: theme.primaryColor,
        };
      case 'rest':
        return {
          backgroundColor: theme.secondaryColor,
          borderColor: theme.accentColor,
        };
      case 'workout':
        return {
          backgroundColor: theme.backgroundColor,
          borderColor: theme.textColor,
        };
      default:
        return {
          backgroundColor: theme.primaryColor,
          borderColor: theme.primaryColor,
        };
    }
  };

  const timerTypeStyle = getTimerTypeStyle();

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render circular progress indicator
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
            borderColor: `${theme.progressColor}20`, // 20% opacity
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
            borderColor: theme.progressColor,
            transform: [{ rotate: '-90deg' }],
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
                { rotate: `${timer.progress * 360}deg` },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );

  // Render timer display
  const renderTimerDisplay = () => (
    <Animated.View
      style={[
        styles.timerDisplay,
        {
          width: diameter - strokeWidth * 2,
          height: diameter - strokeWidth * 2,
          borderRadius: (diameter - strokeWidth * 2) / 2,
          backgroundColor: flashAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [timerTypeStyle.backgroundColor, '#FFFFFF'],
          }),
        },
        {
          transform: [{ scale: pulseAnimation }],
        },
      ]}
    >
      <Text
        style={[
          styles.timerTime,
          {
            fontSize,
            color: timer.state === 'completed' ? theme.primaryColor : theme.textColor,
          },
        ]}
      >
        {timer.displayTime}
      </Text>
      
      {timer.type !== 'workout' && (
        <Text style={[styles.timerType, { color: theme.textColor, opacity: 0.7 }]}>
          {timer.type.toUpperCase()}
        </Text>
      )}
      
      {timer.state === 'paused' && (
        <View style={styles.pausedIndicator}>
          <Ionicons name="pause" size={fontSize / 2} color={theme.textColor} />
        </View>
      )}
    </Animated.View>
  );

  // Render control buttons
  const renderControls = () => {
    if (timer.state === 'completed') {
      return (
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={[styles.controlButton, styles.skipButton]} onPress={onSkip}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.controlButtonText, { color: '#4CAF50' }]}>Done</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.controlsContainer}>
        {/* Pause/Resume button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.playPauseButton]}
          onPress={timer.state === 'running' ? onPause : onResume}
        >
          <Ionicons
            name={timer.state === 'running' ? 'pause' : 'play'}
            size={20}
            color={theme.primaryColor}
          />
          <Text style={[styles.controlButtonText, { color: theme.primaryColor }]}>
            {timer.state === 'running' ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>

        {/* Skip button */}
        <TouchableOpacity style={[styles.controlButton, styles.skipButton]} onPress={onSkip}>
          <Ionicons name="play-skip-forward" size={20} color="#666" />
          <Text style={[styles.controlButtonText, { color: '#666' }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render adjustment controls for rest timers
  const renderAdjustmentControls = () => {
    if (!showAdjustControls || !onAdjust || timer.type !== 'rest') {
      return null;
    }

    return (
      <View style={styles.adjustmentContainer}>
        <TouchableOpacity
          style={[styles.adjustmentButton, styles.decreaseButton]}
          onPress={() => onAdjust(-15)}
        >
          <Ionicons name="remove" size={16} color="#666" />
          <Text style={styles.adjustmentButtonText}>15s</Text>
        </TouchableOpacity>

        <Text style={styles.adjustmentLabel}>Adjust Rest Time</Text>

        <TouchableOpacity
          style={[styles.adjustmentButton, styles.increaseButton]}
          onPress={() => onAdjust(15)}
        >
          <Ionicons name="add" size={16} color="#666" />
          <Text style={styles.adjustmentButtonText}>15s</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render gesture instructions
  const renderGestureHints = () => {
    if (!showGestures || size === 'small') {
      return null;
    }

    return (
      <View style={styles.gestureHints}>
        <Text style={styles.gestureHintText}>
          Tap to {timer.state === 'running' ? 'pause' : 'resume'} • Swipe right to skip
        </Text>
      </View>
    );
  };

  const timerContent = (
    <View style={[styles.container, { opacity: timer.state === 'stopped' ? 0.5 : 1 }]}>
      <View style={styles.timerContainer}>
        {renderProgressRing()}
        {renderTimerDisplay()}
      </View>
      {renderControls()}
      {renderAdjustmentControls()}
      {renderGestureHints()}
    </View>
  );

  // Wrap with gesture handlers if gestures are enabled
  if (showGestures) {
    return (
      <PanGestureHandler onGestureEvent={handlePanGesture}>
        <Animated.View>
          <TapGestureHandler onGestureEvent={handleTapGesture}>
            <Animated.View>
              {timerContent}
            </Animated.View>
          </TapGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    );
  }

  return timerContent;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timerContainer: {
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
  timerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timerTime: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  timerType: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 1,
  },
  pausedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  playPauseButton: {
    backgroundColor: '#E3F2FD',
  },
  skipButton: {
    backgroundColor: '#F5F5F5',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adjustmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  adjustmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 4,
  },
  decreaseButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  increaseButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#C8E6C9',
  },
  adjustmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  adjustmentLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  gestureHints: {
    alignItems: 'center',
    marginTop: 8,
  },
  gestureHintText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});