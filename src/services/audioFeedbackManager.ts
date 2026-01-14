/**
 * AudioFeedbackManager - Manages audio cues, alerts, and motivational sounds during workouts
 * 
 * This service handles all audio feedback for the interactive workout session including:
 * - Timer completion sounds
 * - Exercise transition alerts
 * - Milestone celebration sounds
 * - Motivational audio cues
 * - Background audio configuration
 * - Audio interruption handling
 */

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimerType, WorkoutMilestone } from '../types/timer';
import { hapticFeedbackManager, HapticFeedbackType } from './hapticFeedbackManager';

// Audio settings interface
export interface AudioSettings {
  enabled: boolean;
  volume: number;
  timerSounds: boolean;
  motivationalCues: boolean;
  backgroundMusic: boolean;
}

// Motivational cue types
export type MotivationalCueType = 'start_exercise' | 'halfway_point' | 'final_push' | 'rest_over';

// Audio interruption types
export type AudioInterruption = 'began' | 'ended';

// Audio file mappings
const AUDIO_FILES = {
  timer_completion: require('../../assets/audio/timer_complete.wav'),
  rest_completion: require('../../assets/audio/rest_complete.wav'),
  exercise_transition: require('../../assets/audio/transition.wav'),
  milestone_quarter: require('../../assets/audio/milestone_small.wav'),
  milestone_half: require('../../assets/audio/milestone_medium.wav'),
  milestone_complete: require('../../assets/audio/milestone_large.wav'),
  motivational_start: require('../../assets/audio/lets_go.wav'),
  motivational_halfway: require('../../assets/audio/halfway_there.wav'),
  motivational_final: require('../../assets/audio/final_push.wav'),
  motivational_rest_over: require('../../assets/audio/back_to_work.wav'),
} as const;

// Default audio settings
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  volume: 0.7,
  timerSounds: true,
  motivationalCues: true,
  backgroundMusic: false,
};

// Storage key for audio settings
const AUDIO_SETTINGS_KEY = 'interactive_workout_audio_settings';

/**
 * AudioFeedbackManager class
 * Manages all audio feedback for interactive workout sessions
 */
export class AudioFeedbackManager {
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
  private soundObjects: Map<string, Audio.Sound> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the audio feedback manager
   * Sets up audio session and loads settings
   */
  private async initialize(): Promise<void> {
    try {
      // Configure audio session for workout app
      await this.configureBackgroundAudio();
      
      // Load saved settings
      await this.loadSettings();
      
      // Pre-load critical audio files
      await this.preloadAudioFiles();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AudioFeedbackManager:', error);
      // Continue with default settings if initialization fails
      this.isInitialized = true;
    }
  }

  /**
   * Configure background audio session
   * Allows audio to play during workouts even when app is backgrounded
   */
  async configureBackgroundAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to configure background audio:', error);
    }
  }

  /**
   * Pre-load critical audio files for instant playback
   * Loads timer completion and rest completion sounds
   */
  private async preloadAudioFiles(): Promise<void> {
    const criticalSounds = [
      'timer_completion',
      'rest_completion',
      'exercise_transition',
    ];

    for (const soundKey of criticalSounds) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          AUDIO_FILES[soundKey as keyof typeof AUDIO_FILES],
          { shouldPlay: false, volume: this.settings.volume }
        );
        this.soundObjects.set(soundKey, sound);
      } catch (error) {
        console.error(`Failed to preload sound ${soundKey}:`, error);
      }
    }
  }

  /**
   * Load audio settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem(AUDIO_SETTINGS_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  }

  /**
   * Save audio settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save audio settings:', error);
    }
  }

  /**
   * Play timer completion sound based on timer type
   * Different sounds for exercise vs rest timer completion
   * Also triggers appropriate haptic feedback
   */
  async playTimerCompletion(timerType: TimerType): Promise<void> {
    if (!this.settings.enabled || !this.settings.timerSounds) {
      return;
    }

    try {
      let soundKey: string;
      switch (timerType) {
        case 'exercise':
          soundKey = 'timer_completion';
          break;
        case 'rest':
          soundKey = 'rest_completion';
          break;
        case 'workout':
          soundKey = 'timer_completion';
          break;
        default:
          soundKey = 'timer_completion';
      }

      // Play sound and haptic feedback simultaneously
      await Promise.all([
        this.playSound(soundKey),
        hapticFeedbackManager.triggerTimerFeedback('complete')
      ]);
    } catch (error) {
      console.error('Failed to play timer completion sound:', error);
    }
  }

  /**
   * Play exercise transition sound
   * Played when moving between exercises
   * Also triggers haptic feedback
   */
  async playExerciseTransition(): Promise<void> {
    if (!this.settings.enabled || !this.settings.timerSounds) {
      return;
    }

    try {
      await Promise.all([
        this.playSound('exercise_transition'),
        hapticFeedbackManager.triggerFeedback('exercise_complete')
      ]);
    } catch (error) {
      console.error('Failed to play exercise transition sound:', error);
    }
  }

  /**
   * Play milestone celebration sound
   * Different sounds for different milestone levels
   * Also triggers celebration haptic feedback
   */
  async playMilestoneSound(milestone: WorkoutMilestone): Promise<void> {
    if (!this.settings.enabled || !this.settings.timerSounds) {
      return;
    }

    try {
      let soundKey: string;
      switch (milestone.celebrationLevel) {
        case 'small':
          soundKey = 'milestone_quarter';
          break;
        case 'medium':
          soundKey = 'milestone_half';
          break;
        case 'large':
          soundKey = 'milestone_complete';
          break;
        default:
          soundKey = 'milestone_quarter';
      }

      await Promise.all([
        this.playSound(soundKey),
        hapticFeedbackManager.triggerMilestone()
      ]);
    } catch (error) {
      console.error('Failed to play milestone sound:', error);
    }
  }

  /**
   * Play motivational audio cue
   * Context-aware motivational sounds during workout
   */
  async playMotivationalCue(cueType: MotivationalCueType): Promise<void> {
    if (!this.settings.enabled || !this.settings.motivationalCues) {
      return;
    }

    try {
      let soundKey: string;
      switch (cueType) {
        case 'start_exercise':
          soundKey = 'motivational_start';
          break;
        case 'halfway_point':
          soundKey = 'motivational_halfway';
          break;
        case 'final_push':
          soundKey = 'motivational_final';
          break;
        case 'rest_over':
          soundKey = 'motivational_rest_over';
          break;
        default:
          soundKey = 'motivational_start';
      }

      await this.playSound(soundKey);
    } catch (error) {
      console.error('Failed to play motivational cue:', error);
    }
  }

  /**
   * Play a sound by key
   * Handles both preloaded and on-demand sound loading
   */
  private async playSound(soundKey: string): Promise<void> {
    try {
      // Check if sound is preloaded
      let sound = this.soundObjects.get(soundKey);
      
      if (!sound) {
        // Load sound on demand
        const audioFile = AUDIO_FILES[soundKey as keyof typeof AUDIO_FILES];
        if (!audioFile) {
          console.warn(`Audio file not found for key: ${soundKey}`);
          return;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          audioFile,
          { shouldPlay: false, volume: this.settings.volume }
        );
        sound = newSound;
        this.soundObjects.set(soundKey, sound);
      }

      // Set volume and play
      await sound.setVolumeAsync(this.settings.volume);
      await sound.replayAsync();
    } catch (error) {
      console.error(`Failed to play sound ${soundKey}:`, error);
    }
  }

  /**
   * Set audio volume (0-1)
   */
  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    
    // Update volume for all loaded sounds
    this.soundObjects.forEach(async (sound) => {
      try {
        await sound.setVolumeAsync(this.settings.volume);
      } catch (error) {
        console.error('Failed to update sound volume:', error);
      }
    });
  }

  /**
   * Enable or disable audio feedback
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  /**
   * Get current audio settings
   */
  getAudioSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Update audio settings
   */
  updateAudioSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Handle audio interruption (phone calls, other apps)
   */
  handleInterruption(interruption: AudioInterruption): void {
    switch (interruption) {
      case 'began':
        // Audio session was interrupted, pause any ongoing sounds
        this.pauseAllSounds();
        break;
      case 'ended':
        // Audio session interruption ended, can resume if needed
        // Note: We don't auto-resume sounds as they are typically short
        break;
    }
  }

  /**
   * Pause all currently playing sounds
   */
  private async pauseAllSounds(): Promise<void> {
    this.soundObjects.forEach(async (sound, key) => {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
        }
      } catch (error) {
        console.error(`Failed to pause sound ${key}:`, error);
      }
    });
  }

  /**
   * Clean up resources
   * Unload all sounds and clear cache
   */
  async cleanup(): Promise<void> {
    this.soundObjects.forEach(async (sound, key) => {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error(`Failed to unload sound ${key}:`, error);
      }
    });
    this.soundObjects.clear();
  }

  /**
   * Check if audio feedback manager is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Trigger haptic feedback for button interactions
   * Convenience method for UI components
   */
  async triggerButtonHaptic(): Promise<void> {
    await hapticFeedbackManager.triggerButtonPress();
  }

  /**
   * Trigger haptic feedback for gesture interactions
   * Convenience method for gesture handlers
   */
  async triggerGestureHaptic(gestureType: 'swipe' | 'tap'): Promise<void> {
    await hapticFeedbackManager.triggerGesture(gestureType);
  }

  /**
   * Trigger haptic feedback for timer controls
   * Used by timer control components
   */
  async triggerTimerControlHaptic(action: 'start' | 'pause' | 'resume' | 'skip'): Promise<void> {
    await hapticFeedbackManager.triggerTimerFeedback(action);
  }

  /**
   * Get haptic feedback manager instance
   * For direct access to haptic settings
   */
  getHapticManager() {
    return hapticFeedbackManager;
  }
}

// Export singleton instance
export const audioFeedbackManager = new AudioFeedbackManager();