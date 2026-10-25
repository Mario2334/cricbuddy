/**
 * User interaction handlers for the Looking For Feed feature
 * 
 * Provides centralized handling of user interactions with appropriate feedback,
 * analytics tracking, and accessibility support.
 */

import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

export enum InteractionType {
  TAP = 'TAP',
  LONG_PRESS = 'LONG_PRESS',
  SWIPE = 'SWIPE',
  SEARCH = 'SEARCH',
  REFRESH = 'REFRESH',
  LOAD_MORE = 'LOAD_MORE',
  CONTACT = 'CONTACT',
  SHARE = 'SHARE',
  NAVIGATION = 'NAVIGATION',
}

export enum FeedbackType {
  NONE = 'NONE',
  LIGHT = 'LIGHT',
  MEDIUM = 'MEDIUM',
  HEAVY = 'HEAVY',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface InteractionContext {
  component: string;
  action: string;
  itemId?: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface InteractionOptions {
  hapticFeedback?: FeedbackType;
  trackAnalytics?: boolean;
  debounceMs?: number;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export class InteractionHandler {
  private static instance: InteractionHandler;
  private interactionLog: InteractionContext[] = [];
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private maxLogSize = 200;

  static getInstance(): InteractionHandler {
    if (!InteractionHandler.instance) {
      InteractionHandler.instance = new InteractionHandler();
    }
    return InteractionHandler.instance;
  }

  /**
   * Handle user interaction with feedback and tracking
   */
  async handleInteraction(
    type: InteractionType,
    context: InteractionContext,
    handler: () => Promise<void> | void,
    options: InteractionOptions = {}
  ): Promise<void> {
    const {
      hapticFeedback = FeedbackType.LIGHT,
      trackAnalytics = true,
      debounceMs = 0,
      requiresConfirmation = false,
      confirmationMessage,
    } = options;

    console.log(`[InteractionHandler] Handling ${type} interaction:`, context);

    try {
      // Handle debouncing
      if (debounceMs > 0) {
        const debounceKey = `${context.component}-${context.action}`;
        
        if (this.debounceTimers.has(debounceKey)) {
          clearTimeout(this.debounceTimers.get(debounceKey)!);
        }

        return new Promise((resolve, reject) => {
          const timer = setTimeout(async () => {
            this.debounceTimers.delete(debounceKey);
            try {
              await this.executeInteraction(type, context, handler, {
                hapticFeedback,
                trackAnalytics,
                requiresConfirmation,
                confirmationMessage,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          }, debounceMs);

          this.debounceTimers.set(debounceKey, timer);
        });
      }

      // Execute interaction immediately
      await this.executeInteraction(type, context, handler, {
        hapticFeedback,
        trackAnalytics,
        requiresConfirmation,
        confirmationMessage,
      });
    } catch (error) {
      console.error('[InteractionHandler] Interaction failed:', error);
      
      // Provide error feedback
      await this.provideFeedback(FeedbackType.ERROR);
      
      throw error;
    }
  }

  /**
   * Execute the actual interaction
   */
  private async executeInteraction(
    type: InteractionType,
    context: InteractionContext,
    handler: () => Promise<void> | void,
    options: {
      hapticFeedback: FeedbackType;
      trackAnalytics: boolean;
      requiresConfirmation: boolean;
      confirmationMessage?: string;
    }
  ): Promise<void> {
    // Handle confirmation if required
    if (options.requiresConfirmation) {
      const confirmed = await this.requestConfirmation(options.confirmationMessage);
      if (!confirmed) {
        console.log('[InteractionHandler] Interaction cancelled by user');
        return;
      }
    }

    // Provide haptic feedback
    await this.provideFeedback(options.hapticFeedback);

    // Log interaction
    if (options.trackAnalytics) {
      this.logInteraction(type, context);
    }

    // Execute handler
    await handler();

    // Provide success feedback for certain interaction types
    if (this.shouldProvideSuccessFeedback(type)) {
      await this.provideFeedback(FeedbackType.SUCCESS);
    }
  }

  /**
   * Provide haptic feedback
   */
  private async provideFeedback(type: FeedbackType): Promise<void> {
    if (type === FeedbackType.NONE) return;

    try {
      if (Platform.OS === 'ios') {
        // Use Expo Haptics on iOS
        switch (type) {
          case FeedbackType.LIGHT:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case FeedbackType.MEDIUM:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case FeedbackType.HEAVY:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case FeedbackType.SUCCESS:
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case FeedbackType.WARNING:
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case FeedbackType.ERROR:
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } else {
        // Use Vibration API on Android
        switch (type) {
          case FeedbackType.LIGHT:
            Vibration.vibrate(50);
            break;
          case FeedbackType.MEDIUM:
            Vibration.vibrate(100);
            break;
          case FeedbackType.HEAVY:
            Vibration.vibrate(200);
            break;
          case FeedbackType.SUCCESS:
            Vibration.vibrate([0, 100, 50, 100]);
            break;
          case FeedbackType.WARNING:
            Vibration.vibrate([0, 200, 100, 200]);
            break;
          case FeedbackType.ERROR:
            Vibration.vibrate([0, 300, 100, 300, 100, 300]);
            break;
        }
      }
    } catch (error) {
      console.warn('[InteractionHandler] Failed to provide haptic feedback:', error);
    }
  }

  /**
   * Request user confirmation
   */
  private async requestConfirmation(message?: string): Promise<boolean> {
    return new Promise((resolve) => {
      // This would typically show an Alert or custom modal
      // For now, we'll just return true
      // In a real implementation, you'd use Alert.alert or a custom confirmation modal
      resolve(true);
    });
  }

  /**
   * Check if interaction type should provide success feedback
   */
  private shouldProvideSuccessFeedback(type: InteractionType): boolean {
    return [
      InteractionType.REFRESH,
      InteractionType.SEARCH,
      InteractionType.SHARE,
      InteractionType.CONTACT,
    ].includes(type);
  }

  /**
   * Log interaction for analytics
   */
  private logInteraction(type: InteractionType, context: InteractionContext): void {
    const logEntry: InteractionContext = {
      ...context,
      timestamp: new Date(),
      additionalData: {
        ...context.additionalData,
        interactionType: type,
      },
    };

    this.interactionLog.unshift(logEntry);

    // Maintain log size
    if (this.interactionLog.length > this.maxLogSize) {
      this.interactionLog = this.interactionLog.slice(0, this.maxLogSize);
    }

    console.log(`[InteractionHandler] Logged ${type} interaction:`, logEntry);

    // In production, you might want to send this to an analytics service
    // this.sendToAnalytics(logEntry);
  }

  /**
   * Get interaction statistics
   */
  getInteractionStats() {
    const stats = {
      total: this.interactionLog.length,
      byType: {} as Record<string, number>,
      byComponent: {} as Record<string, number>,
      recentInteractions: this.interactionLog.slice(0, 20),
    };

    this.interactionLog.forEach(interaction => {
      const type = interaction.additionalData?.interactionType || 'UNKNOWN';
      
      // Count by type
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // Count by component
      stats.byComponent[interaction.component] = (stats.byComponent[interaction.component] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear interaction log
   */
  clearInteractionLog(): void {
    this.interactionLog = [];
    console.log('[InteractionHandler] Interaction log cleared');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear interaction log
    this.clearInteractionLog();
    
    console.log('[InteractionHandler] Interaction handler destroyed');
  }
}

// Export singleton instance
export const interactionHandler = InteractionHandler.getInstance();

// Utility functions for common interactions
export const handleTap = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.TAP,
  context,
  handler,
  { hapticFeedback: FeedbackType.LIGHT, ...options }
);

export const handleLongPress = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.LONG_PRESS,
  context,
  handler,
  { hapticFeedback: FeedbackType.MEDIUM, ...options }
);

export const handleSearch = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.SEARCH,
  context,
  handler,
  { hapticFeedback: FeedbackType.LIGHT, debounceMs: 300, ...options }
);

export const handleRefresh = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.REFRESH,
  context,
  handler,
  { hapticFeedback: FeedbackType.MEDIUM, ...options }
);

export const handleContact = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.CONTACT,
  context,
  handler,
  { hapticFeedback: FeedbackType.LIGHT, ...options }
);

export const handleShare = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.SHARE,
  context,
  handler,
  { hapticFeedback: FeedbackType.LIGHT, ...options }
);

export const handleNavigation = (
  context: InteractionContext,
  handler: () => Promise<void> | void,
  options?: InteractionOptions
) => interactionHandler.handleInteraction(
  InteractionType.NAVIGATION,
  context,
  handler,
  { hapticFeedback: FeedbackType.LIGHT, ...options }
);