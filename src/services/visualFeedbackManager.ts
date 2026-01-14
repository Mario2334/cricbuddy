/**
 * Visual Feedback Manager for Interactive Workout Sessions
 * 
 * Manages visual animations, progress indicators, theme transitions,
 * and milestone celebrations during interactive workout sessions.
 */

import { 
  WorkoutPhase, 
  WorkoutTheme, 
  WorkoutMilestone, 
  PHASE_THEMES 
} from '../types/timer';

/**
 * Animation configuration for different types of visual feedback
 */
interface AnimationConfig {
  duration: number;        // Animation duration in milliseconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;          // Optional delay before animation starts
}

/**
 * Progress update callback for real-time visual updates
 */
type ProgressCallback = (progress: number) => void;

/**
 * Animation completion callback
 */
type AnimationCallback = () => void;

/**
 * Visual feedback manager class that handles all visual animations
 * and progress indicators during interactive workout sessions
 */
export class VisualFeedbackManager {
  private currentTheme: WorkoutTheme;
  private progressCallbacks: Map<string, ProgressCallback>;
  private animationCallbacks: Map<string, AnimationCallback>;
  private activeAnimations: Set<string>;

  constructor() {
    this.currentTheme = PHASE_THEMES.warmup; // Default to warmup theme
    this.progressCallbacks = new Map();
    this.animationCallbacks = new Map();
    this.activeAnimations = new Set();
  }

  // ============================================
  // THEME MANAGEMENT
  // ============================================

  /**
   * Set the visual theme based on workout phase
   * @param phase - The current workout phase
   */
  setPhaseTheme(phase: WorkoutPhase): void {
    const newTheme = PHASE_THEMES[phase];
    if (!newTheme) {
      console.warn(`Unknown workout phase: ${phase}`);
      return;
    }

    this.currentTheme = newTheme;
    this.notifyThemeChange(newTheme);
  }

  /**
   * Get the current workout theme
   * @returns Current WorkoutTheme
   */
  getCurrentTheme(): WorkoutTheme {
    return { ...this.currentTheme };
  }

  /**
   * Get theme for a specific phase without changing current theme
   * @param phase - The workout phase to get theme for
   * @returns WorkoutTheme for the specified phase
   */
  getPhaseTheme(phase: WorkoutPhase): WorkoutTheme {
    return { ...PHASE_THEMES[phase] };
  }

  // ============================================
  // PROGRESS ANIMATIONS
  // ============================================

  /**
   * Animate exercise completion with visual feedback
   * @param exerciseId - ID of the completed exercise
   * @returns Promise that resolves when animation completes
   */
  async animateExerciseCompletion(exerciseId: string): Promise<void> {
    const animationId = `exercise-completion-${exerciseId}`;
    
    if (this.activeAnimations.has(animationId)) {
      return; // Animation already in progress
    }

    this.activeAnimations.add(animationId);

    try {
      // Trigger completion animation sequence
      await this.runCompletionAnimation(animationId, {
        duration: 800,
        easing: 'ease-out'
      });

      // Show checkmark and success feedback
      await this.showSuccessFeedback(exerciseId, {
        duration: 400,
        easing: 'ease-in-out'
      });

    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Animate set completion with visual feedback
   * @param setId - ID of the completed set
   * @returns Promise that resolves when animation completes
   */
  async animateSetCompletion(setId: string): Promise<void> {
    const animationId = `set-completion-${setId}`;
    
    if (this.activeAnimations.has(animationId)) {
      return;
    }

    this.activeAnimations.add(animationId);

    try {
      // Quick set completion animation
      await this.runCompletionAnimation(animationId, {
        duration: 300,
        easing: 'ease-out'
      });

    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Animate phase transition with theme change
   * @param fromPhase - Previous workout phase
   * @param toPhase - New workout phase
   * @returns Promise that resolves when transition completes
   */
  async animatePhaseTransition(fromPhase: WorkoutPhase, toPhase: WorkoutPhase): Promise<void> {
    const animationId = `phase-transition-${fromPhase}-${toPhase}`;
    
    if (this.activeAnimations.has(animationId)) {
      return;
    }

    this.activeAnimations.add(animationId);

    try {
      // Fade out current theme
      await this.fadeOutTheme({
        duration: 300,
        easing: 'ease-in'
      });

      // Change theme
      this.setPhaseTheme(toPhase);

      // Fade in new theme
      await this.fadeInTheme({
        duration: 400,
        easing: 'ease-out'
      });

    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Animate workout milestone celebration
   * @param milestone - The milestone to celebrate
   * @returns Promise that resolves when celebration completes
   */
  async animateMilestone(milestone: WorkoutMilestone): Promise<void> {
    const animationId = `milestone-${milestone.type}`;
    
    if (this.activeAnimations.has(animationId)) {
      return;
    }

    this.activeAnimations.add(animationId);

    try {
      const config = this.getMilestoneAnimationConfig(milestone.celebrationLevel);
      
      // Show milestone celebration
      await this.showMilestoneCelebration(milestone, config);

    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  // ============================================
  // TIMER VISUAL UPDATES
  // ============================================

  /**
   * Update timer progress visualization
   * @param timerId - ID of the timer to update
   * @param progress - Progress value between 0 and 1
   */
  updateTimerProgress(timerId: string, progress: number): void {
    // Clamp progress between 0 and 1
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Notify registered callbacks
    const callback = this.progressCallbacks.get(timerId);
    if (callback) {
      callback(clampedProgress);
    }

    // Update circular progress indicators
    this.updateCircularProgress(timerId, clampedProgress);
  }

  /**
   * Show timer completion animation
   * @param timerId - ID of the completed timer
   * @returns Promise that resolves when animation completes
   */
  async showTimerCompletion(timerId: string): Promise<void> {
    const animationId = `timer-completion-${timerId}`;
    
    if (this.activeAnimations.has(animationId)) {
      return;
    }

    this.activeAnimations.add(animationId);

    try {
      // Flash completion animation
      await this.flashCompletion(timerId, {
        duration: 500,
        easing: 'ease-in-out'
      });

    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  // ============================================
  // OVERALL PROGRESS INDICATORS
  // ============================================

  /**
   * Update overall workout progress
   * @param progress - Progress percentage (0-100)
   */
  updateOverallProgress(progress: number): void {
    // Clamp progress between 0 and 100
    const clampedProgress = Math.max(0, Math.min(100, progress));
    
    // Update overall progress ring
    this.updateProgressRing('overall', clampedProgress / 100);
    
    // Check for milestone triggers
    this.checkMilestones(clampedProgress);
  }

  /**
   * Update exercise-specific progress
   * @param exerciseId - ID of the exercise
   * @param progress - Progress value between 0 and 1
   */
  updateExerciseProgress(exerciseId: string, progress: number): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Update exercise progress indicator
    this.updateProgressRing(exerciseId, clampedProgress);
  }

  // ============================================
  // CALLBACK MANAGEMENT
  // ============================================

  /**
   * Register a callback for timer progress updates
   * @param timerId - ID of the timer to monitor
   * @param callback - Function to call with progress updates
   */
  subscribeToTimerProgress(timerId: string, callback: ProgressCallback): void {
    this.progressCallbacks.set(timerId, callback);
  }

  /**
   * Unregister a timer progress callback
   * @param timerId - ID of the timer to stop monitoring
   */
  unsubscribeFromTimerProgress(timerId: string): void {
    this.progressCallbacks.delete(timerId);
  }

  /**
   * Register a callback for animation completion
   * @param animationId - ID of the animation to monitor
   * @param callback - Function to call when animation completes
   */
  subscribeToAnimationCompletion(animationId: string, callback: AnimationCallback): void {
    this.animationCallbacks.set(animationId, callback);
  }

  /**
   * Unregister an animation completion callback
   * @param animationId - ID of the animation to stop monitoring
   */
  unsubscribeFromAnimationCompletion(animationId: string): void {
    this.animationCallbacks.delete(animationId);
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Clear all active animations and callbacks
   */
  cleanup(): void {
    this.activeAnimations.clear();
    this.progressCallbacks.clear();
    this.animationCallbacks.clear();
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Notify theme change to registered callbacks
   * @param theme - New theme to apply
   */
  private notifyThemeChange(theme: WorkoutTheme): void {
    // In a real implementation, this would trigger UI updates
    // For now, we'll just log the theme change
    console.log('Theme changed to:', theme);
  }

  /**
   * Run a completion animation
   * @param animationId - Unique ID for the animation
   * @param config - Animation configuration
   */
  private async runCompletionAnimation(animationId: string, config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Trigger completion callback if registered
        const callback = this.animationCallbacks.get(animationId);
        if (callback) {
          callback();
        }
        resolve();
      }, config.duration);
    });
  }

  /**
   * Show success feedback animation
   * @param exerciseId - ID of the exercise
   * @param config - Animation configuration
   */
  private async showSuccessFeedback(exerciseId: string, config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, config.duration);
    });
  }

  /**
   * Fade out current theme
   * @param config - Animation configuration
   */
  private async fadeOutTheme(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, config.duration);
    });
  }

  /**
   * Fade in new theme
   * @param config - Animation configuration
   */
  private async fadeInTheme(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, config.duration);
    });
  }

  /**
   * Get animation configuration for milestone celebration level
   * @param level - Celebration level
   * @returns Animation configuration
   */
  private getMilestoneAnimationConfig(level: 'small' | 'medium' | 'large'): AnimationConfig {
    switch (level) {
      case 'small':
        return { duration: 600, easing: 'ease-out' };
      case 'medium':
        return { duration: 1000, easing: 'ease-in-out' };
      case 'large':
        return { duration: 1500, easing: 'ease-in-out' };
      default:
        return { duration: 800, easing: 'ease-out' };
    }
  }

  /**
   * Show milestone celebration animation
   * @param milestone - Milestone to celebrate
   * @param config - Animation configuration
   */
  private async showMilestoneCelebration(milestone: WorkoutMilestone, config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      // In a real implementation, this would trigger celebration animations
      console.log(`Celebrating milestone: ${milestone.type} - ${milestone.message}`);
      setTimeout(resolve, config.duration);
    });
  }

  /**
   * Update circular progress indicator
   * @param id - ID of the progress indicator
   * @param progress - Progress value between 0 and 1
   */
  private updateCircularProgress(id: string, progress: number): void {
    // In a real implementation, this would update actual UI components
    console.log(`Updating circular progress for ${id}: ${Math.round(progress * 100)}%`);
  }

  /**
   * Update progress ring visualization
   * @param id - ID of the progress ring
   * @param progress - Progress value between 0 and 1
   */
  private updateProgressRing(id: string, progress: number): void {
    // In a real implementation, this would update actual progress ring components
    console.log(`Updating progress ring for ${id}: ${Math.round(progress * 100)}%`);
  }

  /**
   * Flash completion animation for timers
   * @param timerId - ID of the timer
   * @param config - Animation configuration
   */
  private async flashCompletion(timerId: string, config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      // In a real implementation, this would trigger flash animation
      console.log(`Timer ${timerId} completed with flash animation`);
      setTimeout(resolve, config.duration);
    });
  }

  /**
   * Check for milestone triggers based on progress
   * @param progress - Current progress percentage (0-100)
   */
  private checkMilestones(progress: number): void {
    // Check for quarter milestone
    if (progress >= 25 && progress < 50) {
      this.triggerMilestone('quarter');
    }
    // Check for half milestone
    else if (progress >= 50 && progress < 75) {
      this.triggerMilestone('half');
    }
    // Check for three-quarters milestone
    else if (progress >= 75 && progress < 100) {
      this.triggerMilestone('three_quarters');
    }
    // Check for completion milestone
    else if (progress >= 100) {
      this.triggerMilestone('complete');
    }
  }

  /**
   * Trigger a milestone celebration
   * @param type - Type of milestone to trigger
   */
  private triggerMilestone(type: 'quarter' | 'half' | 'three_quarters' | 'complete'): void {
    const milestones: Record<typeof type, WorkoutMilestone> = {
      quarter: {
        type: 'quarter',
        message: 'Great start! 25% complete!',
        celebrationLevel: 'small'
      },
      half: {
        type: 'half',
        message: 'Halfway there! Keep it up!',
        celebrationLevel: 'medium'
      },
      three_quarters: {
        type: 'three_quarters',
        message: 'Almost done! Final push!',
        celebrationLevel: 'medium'
      },
      complete: {
        type: 'complete',
        message: 'Workout Complete! Amazing job!',
        celebrationLevel: 'large'
      }
    };

    const milestone = milestones[type];
    if (milestone) {
      this.animateMilestone(milestone);
    }
  }
}

/**
 * Singleton instance of VisualFeedbackManager
 * Provides global access to visual feedback functionality
 */
export const visualFeedbackManager = new VisualFeedbackManager();

/**
 * Hook for React components to access visual feedback manager
 * @returns VisualFeedbackManager instance
 */
export const useVisualFeedback = () => {
  return visualFeedbackManager;
};