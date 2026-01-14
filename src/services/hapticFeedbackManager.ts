/**
 * HapticFeedbackManager - Manages haptic feedback for interactive workout sessions
 * 
 * This service handles all haptic feedback including:
 * - Button press feedback
 * - Gesture feedback
 * - Timer completion haptics
 * - Customizable intensity settings
 * - Different haptic patterns for various interaction types
 */

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Haptic feedback settings interface
export interface HapticSettings {
  enabled: boolean;
  intensity: HapticIntensity;
  buttonFeedback: boolean;
  gestureFeedback: boolean;
  timerFeedback: boolean;
}

// Haptic intensity levels
export type HapticIntensity = 'light' | 'medium' | 'heavy';

// Haptic feedback types for different interactions
export type HapticFeedbackType = 
  | 'button_press'
  | 'gesture_swipe'
  | 'gesture_tap'
  | 'timer_complete'
  | 'timer_start'
  | 'timer_pause'
  | 'timer_resume'
  | 'timer_skip'
  | 'exercise_complete'
  | 'set_complete'
  | 'milestone_reached'
  | 'error'
  | 'success'
  | 'warning';

// Default haptic settings
const DEFAULT_HAPTIC_SETTINGS: HapticSettings = {
  enabled: true,
  intensity: 'medium',
  buttonFeedback: true,
  gestureFeedback: true,
  timerFeedback: true,
};

// Storage key for haptic settings
const HAPTIC_SETTINGS_KEY = 'interactive_workout_haptic_settings';

/**
 * HapticFeedbackManager class
 * Manages all haptic feedback for interactive workout sessions
 */
export class HapticFeedbackManager {
  private settings: HapticSettings = DEFAULT_HAPTIC_SETTINGS;
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the haptic feedback manager
   * Loads settings and checks device capabilities
   */
  private async initialize(): Promise<void> {
    try {
      // Load saved settings
      await this.loadSettings();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize HapticFeedbackManager:', error);
      // Continue with default settings if initialization fails
      this.isInitialized = true;
    }
  }

  /**
   * Load haptic settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem(HAPTIC_SETTINGS_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_HAPTIC_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Failed to load haptic settings:', error);
    }
  }

  /**
   * Save haptic settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAPTIC_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save haptic settings:', error);
    }
  }

  /**
   * Trigger haptic feedback based on interaction type
   */
  async triggerFeedback(feedbackType: HapticFeedbackType): Promise<void> {
    if (!this.settings.enabled) {
      return;
    }

    try {
      // Check if specific feedback type is enabled
      if (!this.isFeedbackTypeEnabled(feedbackType)) {
        return;
      }

      // Map feedback type to appropriate haptic pattern
      const hapticType = this.getHapticTypeForFeedback(feedbackType);
      const impactStyle = this.getImpactStyleForIntensity();

      switch (hapticType) {
        case 'impact':
          await Haptics.impactAsync(impactStyle);
          break;
        case 'notification':
          const notificationStyle = this.getNotificationStyleForFeedback(feedbackType);
          await Haptics.notificationAsync(notificationStyle);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
        default:
          await Haptics.impactAsync(impactStyle);
      }
    } catch (error) {
      console.error(`Failed to trigger haptic feedback for ${feedbackType}:`, error);
    }
  }

  /**
   * Check if a specific feedback type is enabled
   */
  private isFeedbackTypeEnabled(feedbackType: HapticFeedbackType): boolean {
    switch (feedbackType) {
      case 'button_press':
        return this.settings.buttonFeedback;
      case 'gesture_swipe':
      case 'gesture_tap':
        return this.settings.gestureFeedback;
      case 'timer_complete':
      case 'timer_start':
      case 'timer_pause':
      case 'timer_resume':
      case 'timer_skip':
        return this.settings.timerFeedback;
      default:
        return true; // Enable other feedback types by default
    }
  }

  /**
   * Get haptic type for feedback
   */
  private getHapticTypeForFeedback(feedbackType: HapticFeedbackType): 'impact' | 'notification' | 'selection' {
    switch (feedbackType) {
      case 'button_press':
      case 'gesture_tap':
        return 'selection';
      case 'timer_complete':
      case 'exercise_complete':
      case 'set_complete':
      case 'milestone_reached':
        return 'notification';
      case 'gesture_swipe':
      case 'timer_start':
      case 'timer_pause':
      case 'timer_resume':
      case 'timer_skip':
        return 'impact';
      case 'error':
      case 'success':
      case 'warning':
        return 'notification';
      default:
        return 'impact';
    }
  }

  /**
   * Get impact style based on intensity setting
   */
  private getImpactStyleForIntensity(): Haptics.ImpactFeedbackStyle {
    switch (this.settings.intensity) {
      case 'light':
        return Haptics.ImpactFeedbackStyle.Light;
      case 'medium':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'heavy':
        return Haptics.ImpactFeedbackStyle.Heavy;
      default:
        return Haptics.ImpactFeedbackStyle.Medium;
    }
  }

  /**
   * Get notification style for specific feedback types
   */
  private getNotificationStyleForFeedback(feedbackType: HapticFeedbackType): Haptics.NotificationFeedbackType {
    switch (feedbackType) {
      case 'timer_complete':
      case 'exercise_complete':
      case 'set_complete':
      case 'milestone_reached':
      case 'success':
        return Haptics.NotificationFeedbackType.Success;
      case 'error':
        return Haptics.NotificationFeedbackType.Error;
      case 'warning':
        return Haptics.NotificationFeedbackType.Warning;
      default:
        return Haptics.NotificationFeedbackType.Success;
    }
  }

  /**
   * Trigger button press haptic feedback
   * Convenience method for common button interactions
   */
  async triggerButtonPress(): Promise<void> {
    await this.triggerFeedback('button_press');
  }

  /**
   * Trigger gesture haptic feedback
   * Convenience method for gesture interactions
   */
  async triggerGesture(gestureType: 'swipe' | 'tap'): Promise<void> {
    const feedbackType = gestureType === 'swipe' ? 'gesture_swipe' : 'gesture_tap';
    await this.triggerFeedback(feedbackType);
  }

  /**
   * Trigger timer-related haptic feedback
   * Convenience method for timer interactions
   */
  async triggerTimerFeedback(timerAction: 'start' | 'pause' | 'resume' | 'skip' | 'complete'): Promise<void> {
    const feedbackType = `timer_${timerAction}` as HapticFeedbackType;
    await this.triggerFeedback(feedbackType);
  }

  /**
   * Trigger exercise completion haptic feedback
   * Special pattern for exercise milestones
   */
  async triggerExerciseComplete(): Promise<void> {
    await this.triggerFeedback('exercise_complete');
  }

  /**
   * Trigger set completion haptic feedback
   * Pattern for set completion
   */
  async triggerSetComplete(): Promise<void> {
    await this.triggerFeedback('set_complete');
  }

  /**
   * Trigger milestone haptic feedback
   * Special celebration pattern for workout milestones
   */
  async triggerMilestone(): Promise<void> {
    await this.triggerFeedback('milestone_reached');
  }

  /**
   * Trigger success haptic feedback
   * General success pattern
   */
  async triggerSuccess(): Promise<void> {
    await this.triggerFeedback('success');
  }

  /**
   * Trigger error haptic feedback
   * Error notification pattern
   */
  async triggerError(): Promise<void> {
    await this.triggerFeedback('error');
  }

  /**
   * Trigger warning haptic feedback
   * Warning notification pattern
   */
  async triggerWarning(): Promise<void> {
    await this.triggerFeedback('warning');
  }

  /**
   * Set haptic feedback enabled/disabled
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  /**
   * Set haptic intensity
   */
  setIntensity(intensity: HapticIntensity): void {
    this.settings.intensity = intensity;
    this.saveSettings();
  }

  /**
   * Get current haptic settings
   */
  getHapticSettings(): HapticSettings {
    return { ...this.settings };
  }

  /**
   * Update haptic settings
   */
  updateHapticSettings(newSettings: Partial<HapticSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Check if haptic feedback is available on device
   */
  async isHapticAvailable(): Promise<boolean> {
    try {
      // Try to trigger a light haptic to test availability
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    } catch (error) {
      console.warn('Haptic feedback not available on this device:', error);
      return false;
    }
  }

  /**
   * Check if haptic feedback manager is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const hapticFeedbackManager = new HapticFeedbackManager();