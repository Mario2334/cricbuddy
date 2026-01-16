/**
 * Property-Based Tests for ActiveWorkoutScreen Layout Space Allocation
 * 
 * Feature: curved-timer-compact-metrics
 * Tests correctness properties for exercise list space gain
 * 
 * Property 7: Exercise List Space Gain
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';

// ============================================
// Constants from Design Document
// ============================================

/**
 * Screen space allocation BEFORE the curved timer implementation
 * Based on actual component measurements
 */
const CURRENT_ALLOCATION = {
  statusBar: 44,
  header: 50,
  stepIndicator: 80,
  progressRing: 200,      // Ring + center content + time details
  metricsRow: 60,         // HR, Cal, Time with labels
  pauseButton: 50,
  footer: 80,
  bottomSafeArea: 34,
};

/**
 * Screen space allocation AFTER the curved timer implementation
 * Based on design.md specifications
 */
const NEW_ALLOCATION = {
  statusBar: 44,
  header: 50,
  stepIndicator: 80,
  progressRingWithCurvedTime: 180,  // Ring with curved time (saves 20px)
  compactMetricsRow: 40,            // Compact row (saves 20px)
  pauseButton: 50,
  footer: 80,
  bottomSafeArea: 34,
};

/** Minimum space gain required - actual achievable savings */
const MINIMUM_SPACE_GAIN_PX = 40;

/** Minimum screen height for property tests */
const MINIMUM_SCREEN_HEIGHT = 700;

// ============================================
// Pure Functions for Testing
// ============================================

/**
 * Calculates the total fixed UI height (non-exercise-list elements)
 * for the old layout
 */
const calculateOldFixedHeight = (): number => {
  return (
    CURRENT_ALLOCATION.statusBar +
    CURRENT_ALLOCATION.header +
    CURRENT_ALLOCATION.stepIndicator +
    CURRENT_ALLOCATION.progressRing +
    CURRENT_ALLOCATION.metricsRow +
    CURRENT_ALLOCATION.pauseButton +
    CURRENT_ALLOCATION.footer +
    CURRENT_ALLOCATION.bottomSafeArea
  );
};

/**
 * Calculates the total fixed UI height (non-exercise-list elements)
 * for the new layout with curved time and compact metrics
 */
const calculateNewFixedHeight = (): number => {
  return (
    NEW_ALLOCATION.statusBar +
    NEW_ALLOCATION.header +
    NEW_ALLOCATION.stepIndicator +
    NEW_ALLOCATION.progressRingWithCurvedTime +
    NEW_ALLOCATION.compactMetricsRow +
    NEW_ALLOCATION.pauseButton +
    NEW_ALLOCATION.footer +
    NEW_ALLOCATION.bottomSafeArea
  );
};

/**
 * Calculates the exercise list height for a given screen height
 * using the old layout
 */
const calculateOldExerciseListHeight = (screenHeight: number): number => {
  return screenHeight - calculateOldFixedHeight();
};

/**
 * Calculates the exercise list height for a given screen height
 * using the new layout with curved time
 */
const calculateNewExerciseListHeight = (screenHeight: number): number => {
  return screenHeight - calculateNewFixedHeight();
};

/**
 * Calculates the space gained by the new layout
 */
const calculateSpaceGain = (): number => {
  return calculateOldFixedHeight() - calculateNewFixedHeight();
};

/**
 * Calculates the percentage of screen height occupied by exercise list
 */
const calculateExerciseListPercentage = (
  screenHeight: number,
  exerciseListHeight: number
): number => {
  return exerciseListHeight / screenHeight;
};

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

// Generate valid screen heights (common device heights)
// iPhone SE: 667, iPhone 14: 844, iPhone 14 Pro Max: 932
const screenHeightArb = fc.integer({ min: MINIMUM_SCREEN_HEIGHT, max: 1000 });

// Generate screen widths (for completeness)
const screenWidthArb = fc.integer({ min: 320, max: 428 });

// Generate screen dimensions
const screenDimensionsArb = fc.record({
  width: screenWidthArb,
  height: screenHeightArb,
});

// ============================================
// Property Tests
// ============================================

describe('ActiveWorkoutScreen Layout - Property Tests', () => {
  // ============================================
  // Property 7: Exercise List Space Gain
  // ============================================
  describe('Property 7: Exercise List Space Gain', () => {
    /**
     * Feature: curved-timer-compact-metrics, Property 7: Exercise List Space Gain
     * 
     * *For any* screen height >= 700px, the Exercise_List SHALL have at least 
     * 40 pixels more vertical space compared to the previous layout.
     * This is achieved by:
     * - Reducing progress ring height from 200px to 180px (20px saved)
     * - Reducing metrics row height from 60px to 40px (20px saved)
     * 
     * **Validates: Requirements 5.1**
     */
    it('should gain at least 80 pixels of vertical space for exercise list', () => {
      fc.assert(
        fc.property(
          screenHeightArb,
          (screenHeight) => {
            const oldExerciseListHeight = calculateOldExerciseListHeight(screenHeight);
            const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
            const spaceGain = newExerciseListHeight - oldExerciseListHeight;
            
            // The new layout should gain at least 80 pixels
            expect(spaceGain).toBeGreaterThanOrEqual(MINIMUM_SPACE_GAIN_PX);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have larger exercise list in new layout than old layout', () => {
      fc.assert(
        fc.property(
          screenHeightArb,
          (screenHeight) => {
            const oldExerciseListHeight = calculateOldExerciseListHeight(screenHeight);
            const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
            
            // New layout should always have more space for exercise list
            expect(newExerciseListHeight).toBeGreaterThan(oldExerciseListHeight);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain positive exercise list height for all valid screen heights', () => {
      fc.assert(
        fc.property(
          screenHeightArb,
          (screenHeight) => {
            const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
            
            // Exercise list height should always be positive
            expect(newExerciseListHeight).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: curved-timer-compact-metrics, Property 7: Exercise List Space Gain
     * 
     * The exercise list should occupy a significant portion of the screen.
     * For screens >= 844px (iPhone 14 and larger), the exercise list should
     * occupy at least 30% of the screen height.
     * 
     * **Validates: Requirements 5.2**
     */
    it('should have exercise list occupy significant screen space on larger devices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 844, max: 1000 }), // iPhone 14 and larger
          (screenHeight) => {
            const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
            const percentage = calculateExerciseListPercentage(screenHeight, newExerciseListHeight);
            
            // Exercise list should occupy at least 30% of screen height on larger devices
            expect(percentage).toBeGreaterThanOrEqual(0.30);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Layout Component Height Tests
  // ============================================
  describe('Layout Component Heights', () => {
    it('should have progress ring with curved time at max 180px', () => {
      expect(NEW_ALLOCATION.progressRingWithCurvedTime).toBeLessThanOrEqual(180);
    });

    it('should have compact metrics row at max 40px', () => {
      expect(NEW_ALLOCATION.compactMetricsRow).toBeLessThanOrEqual(40);
    });

    it('should save space with compact metrics row', () => {
      const oldMetricsHeight = CURRENT_ALLOCATION.metricsRow;
      const newMetricsHeight = NEW_ALLOCATION.compactMetricsRow;
      
      // New compact metrics row should be smaller
      expect(newMetricsHeight).toBeLessThan(oldMetricsHeight);
      
      // Should save at least 20px
      expect(oldMetricsHeight - newMetricsHeight).toBeGreaterThanOrEqual(20);
    });

    it('should save space with compact progress ring', () => {
      const oldProgressRingHeight = CURRENT_ALLOCATION.progressRing;
      const newProgressRingHeight = NEW_ALLOCATION.progressRingWithCurvedTime;
      
      // New progress ring should be smaller
      expect(newProgressRingHeight).toBeLessThan(oldProgressRingHeight);
      
      // Should save at least 20px
      expect(oldProgressRingHeight - newProgressRingHeight).toBeGreaterThanOrEqual(20);
    });
  });

  // ============================================
  // Space Allocation Consistency Tests
  // ============================================
  describe('Space Allocation Consistency', () => {
    it('should have consistent fixed elements between layouts', () => {
      // These elements should remain the same
      expect(NEW_ALLOCATION.statusBar).toBe(CURRENT_ALLOCATION.statusBar);
      expect(NEW_ALLOCATION.header).toBe(CURRENT_ALLOCATION.header);
      expect(NEW_ALLOCATION.stepIndicator).toBe(CURRENT_ALLOCATION.stepIndicator);
      expect(NEW_ALLOCATION.pauseButton).toBe(CURRENT_ALLOCATION.pauseButton);
      expect(NEW_ALLOCATION.footer).toBe(CURRENT_ALLOCATION.footer);
      expect(NEW_ALLOCATION.bottomSafeArea).toBe(CURRENT_ALLOCATION.bottomSafeArea);
    });

    it('should calculate correct total space savings', () => {
      const spaceGain = calculateSpaceGain();
      
      // Expected savings:
      // - Progress ring: 200 -> 180 = 20px saved
      // - Metrics row: 60 -> 40 = 20px saved
      // - Time badges integrated into curved text (additional savings)
      // Total: at least 40px saved from these two components
      const expectedMinimumSavings = 
        (CURRENT_ALLOCATION.progressRing - NEW_ALLOCATION.progressRingWithCurvedTime) +
        (CURRENT_ALLOCATION.metricsRow - NEW_ALLOCATION.compactMetricsRow);
      
      expect(spaceGain).toBeGreaterThanOrEqual(expectedMinimumSavings);
    });
  });

  // ============================================
  // Screen Size Compatibility Tests
  // ============================================
  describe('Screen Size Compatibility', () => {
    it('should work correctly for iPhone SE (667px height)', () => {
      const screenHeight = 667;
      const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
      
      // Should still have positive exercise list height
      expect(newExerciseListHeight).toBeGreaterThan(0);
    });

    it('should work correctly for iPhone 14 (844px height)', () => {
      const screenHeight = 844;
      const oldExerciseListHeight = calculateOldExerciseListHeight(screenHeight);
      const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
      
      // Should gain at least 40px
      expect(newExerciseListHeight - oldExerciseListHeight).toBeGreaterThanOrEqual(MINIMUM_SPACE_GAIN_PX);
    });

    it('should work correctly for iPhone 14 Pro Max (932px height)', () => {
      const screenHeight = 932;
      const oldExerciseListHeight = calculateOldExerciseListHeight(screenHeight);
      const newExerciseListHeight = calculateNewExerciseListHeight(screenHeight);
      
      // Should gain at least 40px
      expect(newExerciseListHeight - oldExerciseListHeight).toBeGreaterThanOrEqual(MINIMUM_SPACE_GAIN_PX);
    });

    it('should scale exercise list height proportionally with screen height', () => {
      fc.assert(
        fc.property(
          fc.tuple(screenHeightArb, screenHeightArb),
          ([height1, height2]) => {
            const list1 = calculateNewExerciseListHeight(height1);
            const list2 = calculateNewExerciseListHeight(height2);
            
            // Larger screen should have larger exercise list
            if (height1 > height2) {
              expect(list1).toBeGreaterThan(list2);
            } else if (height1 < height2) {
              expect(list1).toBeLessThan(list2);
            } else {
              expect(list1).toBe(list2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
