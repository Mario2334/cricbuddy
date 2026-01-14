/**
 * Timer Controls Component
 * 
 * Provides interactive controls for managing timers during workout sessions,
 * including pause/resume/skip functionality with haptic feedback and gestures.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Vibration,
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

interface TimerControlsProps {
  timer: ActiveTimer;
  theme: WorkoutTheme;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop?: () => void;
  onAdjust?: (seconds: number) => void; // +/- seconds adjustment
  showAdjustControls?: boolean; // Show +15s/-15s buttons
  showStopButton?: boolean; // Show stop button for workout timer
  enableGestures?: boolean; // Enable swipe and tap gestures
  enableHaptics?: boolean; // Enable haptic feedback
  layout?: 'horizontal' | 'vertical' | 'compact';
  size?: 'small' | 'medium' | 'large';
}

/**
 * Interactive timer controls with gesture support and haptic feedback
 */
export const TimerControls: React.FC<TimerControlsProps> = ({
  timer,
  theme,
  onPause,
  onResume,
  onSkip,
  onStop,
  onAdjust,
  showAdjustControls = false,
  showStopButton = false,
  enableGestures = true,
  enableHaptics = true,
  layout = 'horizontal',
  size = 'medium',
}) => {
  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enableHaptics) return;
    
    // Use Vibration API for haptic feedback
    switch (type) {
      case 'light':
        Vibration.vibrate(10);
        break;
      case 'medium':
        Vibration.vibrate(25);
        break;
      case 'heavy':
        Vibration.vibrate(50);
        break;
    }
  }, [enableHaptics]);

  // Handle pause/resume with haptic feedback
  const handlePauseResume = useCallback(() => {
    triggerHaptic('medium');
    if (timer.state === 'running') {
      onPause();
    } else if (timer.state === 'paused') {
      onResume();
    }
  }, [timer.state, onPause, onResume, triggerHaptic]);

  // Handle skip with confirmation for important timers
  const handleSkip = useCallback(() => {
    triggerHaptic('heavy');
    
    // Show confirmation for workout timer or long exercise timers
    if (timer.type === 'workout' || (timer.type === 'exercise' && timer.remaining > 300)) {
      Alert.alert(
        'Skip Timer',
        `Are you sure you want to skip this ${timer.type} timer?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Skip', 
            style: 'destructive',
            onPress: onSkip 
          },
        ]
      );
    } else {
      onSkip();
    }
  }, [timer.type, timer.remaining, onSkip, triggerHaptic]);

  // Handle stop with confirmation
  const handleStop = useCallback(() => {
    if (!onStop) return;
    
    triggerHaptic('heavy');
    Alert.alert(
      'Stop Timer',
      'Are you sure you want to stop this timer? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: onStop 
        },
      ]
    );
  }, [onStop, triggerHaptic]);

  // Handle timer adjustment
  const handleAdjust = useCallback((seconds: number) => {
    if (!onAdjust) return;
    
    triggerHaptic('light');
    onAdjust(seconds);
  }, [onAdjust, triggerHaptic]);

  // Handle tap gesture for pause/resume
  const handleTapGesture = useCallback((event: TapGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE && enableGestures) {
      handlePauseResume();
    }
  }, [handlePauseResume, enableGestures]);

  // Handle pan gesture for swipe-to-skip
  const handlePanGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END && enableGestures) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Detect swipe right with sufficient velocity and distance
      if (translationX > 80 && velocityX > 800) {
        handleSkip();
      }
    }
  }, [handleSkip, enableGestures]);

  // Get size-specific dimensions
  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { buttonSize: 40, iconSize: 18, fontSize: 12 };
      case 'large':
        return { buttonSize: 64, iconSize: 28, fontSize: 16 };
      default:
        return { buttonSize: 52, iconSize: 24, fontSize: 14 };
    }
  };

  const { buttonSize, iconSize, fontSize } = getButtonSize();

  // Get timer state specific styling
  const getTimerStateStyle = () => {
    switch (timer.state) {
      case 'running':
        return {
          primaryColor: theme.primaryColor,
          backgroundColor: `${theme.primaryColor}15`,
          borderColor: theme.primaryColor,
        };
      case 'paused':
        return {
          primaryColor: '#F97316',
          backgroundColor: '#FFF7ED',
          borderColor: '#F97316',
        };
      case 'completed':
        return {
          primaryColor: '#4CAF50',
          backgroundColor: '#F0FDF4',
          borderColor: '#4CAF50',
        };
      default:
        return {
          primaryColor: '#666',
          backgroundColor: '#F5F5F5',
          borderColor: '#E0E0E0',
        };
    }
  };

  const stateStyle = getTimerStateStyle();

  // Render main control buttons
  const renderMainControls = () => {
    if (timer.state === 'completed') {
      return (
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.primaryButton,
            {
              width: buttonSize * 1.5,
              height: buttonSize,
              backgroundColor: stateStyle.backgroundColor,
              borderColor: stateStyle.borderColor,
            },
          ]}
          onPress={handleSkip}
        >
          <Ionicons name="checkmark-circle" size={iconSize} color={stateStyle.primaryColor} />
          <Text style={[styles.buttonText, { fontSize, color: stateStyle.primaryColor }]}>
            Done
          </Text>
        </TouchableOpacity>
      );
    }

    const controls = [];

    // Pause/Resume button
    controls.push(
      <TouchableOpacity
        key="pause-resume"
        style={[
          styles.controlButton,
          styles.primaryButton,
          {
            width: buttonSize,
            height: buttonSize,
            backgroundColor: stateStyle.backgroundColor,
            borderColor: stateStyle.borderColor,
          },
        ]}
        onPress={handlePauseResume}
      >
        <Ionicons
          name={timer.state === 'running' ? 'pause' : 'play'}
          size={iconSize}
          color={stateStyle.primaryColor}
        />
        {size !== 'small' && (
          <Text style={[styles.buttonText, { fontSize, color: stateStyle.primaryColor }]}>
            {timer.state === 'running' ? 'Pause' : 'Resume'}
          </Text>
        )}
      </TouchableOpacity>
    );

    // Skip button
    controls.push(
      <TouchableOpacity
        key="skip"
        style={[
          styles.controlButton,
          styles.secondaryButton,
          {
            width: buttonSize,
            height: buttonSize,
          },
        ]}
        onPress={handleSkip}
      >
        <Ionicons name="play-skip-forward" size={iconSize - 2} color="#666" />
        {size !== 'small' && (
          <Text style={[styles.buttonText, { fontSize, color: '#666' }]}>
            Skip
          </Text>
        )}
      </TouchableOpacity>
    );

    // Stop button (for workout timer)
    if (showStopButton && onStop) {
      controls.push(
        <TouchableOpacity
          key="stop"
          style={[
            styles.controlButton,
            styles.dangerButton,
            {
              width: buttonSize,
              height: buttonSize,
            },
          ]}
          onPress={handleStop}
        >
          <Ionicons name="stop" size={iconSize - 2} color="#EF4444" />
          {size !== 'small' && (
            <Text style={[styles.buttonText, { fontSize, color: '#EF4444' }]}>
              Stop
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    return controls;
  };

  // Render adjustment controls
  const renderAdjustmentControls = () => {
    if (!showAdjustControls || !onAdjust || timer.state === 'completed') {
      return null;
    }

    return (
      <View style={[
        styles.adjustmentContainer,
        layout === 'vertical' && styles.adjustmentContainerVertical
      ]}>
        <Text style={[styles.adjustmentLabel, { color: theme.textColor }]}>
          Adjust Time
        </Text>
        
        <View style={styles.adjustmentButtons}>
          <TouchableOpacity
            style={[styles.adjustmentButton, styles.decreaseButton]}
            onPress={() => handleAdjust(-15)}
          >
            <Ionicons name="remove" size={16} color="#EF4444" />
            <Text style={[styles.adjustmentButtonText, { color: '#EF4444' }]}>
              15s
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adjustmentButton, styles.increaseButton]}
            onPress={() => handleAdjust(15)}
          >
            <Ionicons name="add" size={16} color="#4CAF50" />
            <Text style={[styles.adjustmentButtonText, { color: '#4CAF50' }]}>
              15s
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render gesture hints
  const renderGestureHints = () => {
    if (!enableGestures || size === 'small') {
      return null;
    }

    return (
      <View style={styles.gestureHints}>
        <Text style={[styles.gestureHintText, { color: theme.textColor }]}>
          Tap to {timer.state === 'running' ? 'pause' : 'resume'} • Swipe right to skip
        </Text>
      </View>
    );
  };

  // Render timer status
  const renderTimerStatus = () => {
    if (size === 'small') return null;

    const statusText = timer.state === 'running' ? 'Running' :
                      timer.state === 'paused' ? 'Paused' :
                      timer.state === 'completed' ? 'Completed' : 'Stopped';

    const statusColor = timer.state === 'running' ? theme.primaryColor :
                       timer.state === 'paused' ? '#F97316' :
                       timer.state === 'completed' ? '#4CAF50' : '#666';

    return (
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>
        <Text style={[styles.timerTypeText, { color: theme.textColor }]}>
          {timer.type.toUpperCase()} TIMER
        </Text>
      </View>
    );
  };

  // Main content
  const controlsContent = (
    <View style={[
      styles.container,
      layout === 'vertical' && styles.containerVertical,
      layout === 'compact' && styles.containerCompact,
    ]}>
      {renderTimerStatus()}
      
      <View style={[
        styles.controlsContainer,
        layout === 'vertical' && styles.controlsContainerVertical,
        layout === 'compact' && styles.controlsContainerCompact,
      ]}>
        {renderMainControls()}
      </View>

      {renderAdjustmentControls()}
      {renderGestureHints()}
    </View>
  );

  // Wrap with gesture handlers if gestures are enabled
  if (enableGestures && timer.state !== 'completed') {
    return (
      <PanGestureHandler onGestureEvent={handlePanGesture}>
        <View>
          <TapGestureHandler onGestureEvent={handleTapGesture}>
            <View>
              {controlsContent}
            </View>
          </TapGestureHandler>
        </View>
      </PanGestureHandler>
    );
  }

  return controlsContent;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  containerVertical: {
    paddingVertical: 20,
  },
  containerCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerTypeText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  controlsContainerVertical: {
    flexDirection: 'column',
    gap: 12,
  },
  controlsContainerCompact: {
    gap: 8,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 2,
    gap: 4,
  },
  primaryButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  dangerButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  adjustmentContainer: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  adjustmentContainerVertical: {
    marginBottom: 12,
  },
  adjustmentLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  adjustmentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
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
  },
  gestureHints: {
    alignItems: 'center',
    marginTop: 4,
  },
  gestureHintText: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.6,
  },
});