/**
 * Basic tests for AudioFeedbackManager
 * Tests core functionality and integration with haptic feedback
 */

import { AudioFeedbackManager } from '../audioFeedbackManager';
import { HapticFeedbackManager } from '../hapticFeedbackManager';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setVolumeAsync: jest.fn().mockResolvedValue(undefined),
          replayAsync: jest.fn().mockResolvedValue(undefined),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
          pauseAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        }
      })
    }
  }
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('AudioFeedbackManager', () => {
  let audioManager: AudioFeedbackManager;

  beforeEach(() => {
    audioManager = new AudioFeedbackManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize successfully', () => {
    expect(audioManager).toBeDefined();
    expect(audioManager.isReady()).toBe(true);
  });

  test('should get default audio settings', () => {
    const settings = audioManager.getAudioSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.volume).toBe(0.7);
    expect(settings.timerSounds).toBe(true);
    expect(settings.motivationalCues).toBe(true);
  });

  test('should update volume setting', () => {
    audioManager.setVolume(0.5);
    const settings = audioManager.getAudioSettings();
    expect(settings.volume).toBe(0.5);
  });

  test('should clamp volume to valid range', () => {
    audioManager.setVolume(1.5);
    expect(audioManager.getAudioSettings().volume).toBe(1);
    
    audioManager.setVolume(-0.5);
    expect(audioManager.getAudioSettings().volume).toBe(0);
  });

  test('should enable/disable audio', () => {
    audioManager.setEnabled(false);
    expect(audioManager.getAudioSettings().enabled).toBe(false);
    
    audioManager.setEnabled(true);
    expect(audioManager.getAudioSettings().enabled).toBe(true);
  });

  test('should update audio settings', () => {
    const newSettings = {
      timerSounds: false,
      motivationalCues: false,
    };
    
    audioManager.updateAudioSettings(newSettings);
    const settings = audioManager.getAudioSettings();
    
    expect(settings.timerSounds).toBe(false);
    expect(settings.motivationalCues).toBe(false);
    expect(settings.enabled).toBe(true); // Should preserve other settings
  });
});

describe('HapticFeedbackManager', () => {
  let hapticManager: HapticFeedbackManager;

  beforeEach(() => {
    hapticManager = new HapticFeedbackManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize successfully', () => {
    expect(hapticManager).toBeDefined();
    expect(hapticManager.isReady()).toBe(true);
  });

  test('should get default haptic settings', () => {
    const settings = hapticManager.getHapticSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.intensity).toBe('medium');
    expect(settings.buttonFeedback).toBe(true);
    expect(settings.gestureFeedback).toBe(true);
    expect(settings.timerFeedback).toBe(true);
  });

  test('should update intensity setting', () => {
    hapticManager.setIntensity('heavy');
    const settings = hapticManager.getHapticSettings();
    expect(settings.intensity).toBe('heavy');
  });

  test('should enable/disable haptic feedback', () => {
    hapticManager.setEnabled(false);
    expect(hapticManager.getHapticSettings().enabled).toBe(false);
    
    hapticManager.setEnabled(true);
    expect(hapticManager.getHapticSettings().enabled).toBe(true);
  });

  test('should update haptic settings', () => {
    const newSettings = {
      buttonFeedback: false,
      gestureFeedback: false,
    };
    
    hapticManager.updateHapticSettings(newSettings);
    const settings = hapticManager.getHapticSettings();
    
    expect(settings.buttonFeedback).toBe(false);
    expect(settings.gestureFeedback).toBe(false);
    expect(settings.enabled).toBe(true); // Should preserve other settings
  });
});