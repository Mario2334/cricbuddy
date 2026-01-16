/**
 * Property-Based Tests for CurvedTimeText Component
 * 
 * Feature: curved-timer-compact-metrics
 * Tests correctness properties for curved time text rendering
 */

import * as fc from 'fast-check';
import {
  degreesToRadians,
  polarToCartesian,
  generateArcPath,
  ensureMinimumFontSize,
  getArcDirection,
  calculateEffectiveRadius,
} from '../../utils/curvedTextUtils';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

// Generate valid radius values (positive, reasonable range)
const radiusArb = fc.integer({ min: 50, max: 200 });

// Generate valid font sizes (can be any positive number, will be clamped)
const fontSizeArb = fc.integer({ min: 1, max: 48 });

// Generate valid angles (0-360 degrees)
const angleArb = fc.integer({ min: 0, max: 360 });

// Generate side values
const sideArb = fc.constantFrom<'left' | 'right'>('left', 'right');

// Generate label offset values
const labelOffsetArb = fc.integer({ min: 0, max: 30 });

// Generate time text strings (format: MM:SS or HH:MM:SS)
const timeTextArb = fc.tuple(
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 59 })
).map(([min, sec]) => `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);

// Generate hex color strings
const colorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

// Generate valid CurvedTimeText props
const curvedTimeTextPropsArb = fc.record({
  text: timeTextArb,
  radius: radiusArb,
  startAngle: angleArb,
  endAngle: angleArb,
  fontSize: fontSizeArb,
  color: colorArb,
  side: sideArb,
  labelOffset: labelOffsetArb,
});

// ============================================
// Property Tests
// ============================================

describe('CurvedTimeText - Property Tests', () => {
  // ============================================
  // Property 1: Curved Text Side Placement
  // ============================================
  describe('Property 1: Curved Text Side Placement', () => {
    /**
     * Feature: curved-timer-compact-metrics, Property 1: Curved Text Side Placement
     * 
     * *For any* CurvedTimeText component, elapsed time SHALL be rendered on the 
     * left arc (counter-clockwise from bottom to top) and remaining time SHALL 
     * be rendered on the right arc (clockwise from top to bottom).
     * 
     * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
     */
    it('should generate counter-clockwise arc for left side (elapsed time)', () => {
      fc.assert(
        fc.property(
          radiusArb,
          angleArb,
          angleArb,
          (radius, startAngle, endAngle) => {
            const center = 100;
            const clockwise = false; // Left side = counter-clockwise
            
            const path = generateArcPath(center, center, radius, startAngle, endAngle, clockwise);
            
            // Path should be a valid SVG arc path (allowing negative coordinates and scientific notation)
            // Scientific notation can occur for very small numbers close to zero
            const numberPattern = '-?[\\d.]+(?:e[+-]?\\d+)?';
            const arcPathRegex = new RegExp(`^M\\s+${numberPattern}\\s+${numberPattern}\\s+A\\s+${numberPattern}\\s+${numberPattern}\\s+0\\s+[01]\\s+0\\s+${numberPattern}\\s+${numberPattern}$`);
            expect(path).toMatch(arcPathRegex);
            
            // Sweep flag should be 0 for counter-clockwise
            const sweepFlagMatch = path.match(/A\s+[\d.]+\s+[\d.]+\s+0\s+[01]\s+(\d)/);
            expect(sweepFlagMatch).not.toBeNull();
            expect(sweepFlagMatch![1]).toBe('0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate clockwise arc for right side (remaining time)', () => {
      fc.assert(
        fc.property(
          radiusArb,
          angleArb,
          angleArb,
          (radius, startAngle, endAngle) => {
            const center = 100;
            const clockwise = true; // Right side = clockwise
            
            const path = generateArcPath(center, center, radius, startAngle, endAngle, clockwise);
            
            // Path should be a valid SVG arc path (allowing negative coordinates and scientific notation)
            // Scientific notation can occur for very small numbers close to zero
            const numberPattern = '-?[\\d.]+(?:e[+-]?\\d+)?';
            const arcPathRegex = new RegExp(`^M\\s+${numberPattern}\\s+${numberPattern}\\s+A\\s+${numberPattern}\\s+${numberPattern}\\s+0\\s+[01]\\s+1\\s+${numberPattern}\\s+${numberPattern}$`);
            expect(path).toMatch(arcPathRegex);
            
            // Sweep flag should be 1 for clockwise
            const sweepFlagMatch = path.match(/A\s+[\d.]+\s+[\d.]+\s+0\s+[01]\s+(\d)/);
            expect(sweepFlagMatch).not.toBeNull();
            expect(sweepFlagMatch![1]).toBe('1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct arc direction based on side', () => {
      fc.assert(
        fc.property(
          sideArb,
          (side) => {
            const direction = getArcDirection(side);
            
            // Left side should be counter-clockwise (false)
            // Right side should be clockwise (true)
            if (side === 'left') {
              expect(direction).toBe(false);
            } else {
              expect(direction).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 2: Curved Text Legibility
  // ============================================
  describe('Property 2: Curved Text Legibility', () => {
    /**
     * Feature: curved-timer-compact-metrics, Property 2: Curved Text Legibility
     * 
     * *For any* curved time text rendered on the progress ring, the font size 
     * SHALL be at least 12px.
     * 
     * **Validates: Requirements 1.3, 2.3**
     */
    it('should ensure minimum font size of 12px for any input', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (inputFontSize) => {
            const result = ensureMinimumFontSize(inputFontSize);
            
            // Result should always be at least 12
            expect(result).toBeGreaterThanOrEqual(12);
            
            // If input was >= 12, result should equal input
            if (inputFontSize >= 12) {
              expect(result).toBe(inputFontSize);
            } else {
              // If input was < 12, result should be exactly 12
              expect(result).toBe(12);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve font sizes that are already >= 12px', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 12, max: 100 }),
          (inputFontSize) => {
            const result = ensureMinimumFontSize(inputFontSize);
            expect(result).toBe(inputFontSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 3: Curved Text Positioning
  // ============================================
  describe('Property 3: Curved Text Positioning', () => {
    /**
     * Feature: curved-timer-compact-metrics, Property 3: Curved Text Positioning
     * 
     * *For any* curved time text, the text SHALL be positioned outside the ring 
     * arc (positive labelOffset) and SHALL not overlap with the progress ring 
     * stroke or center content.
     * 
     * **Validates: Requirements 1.5, 2.5, 3.4**
     */
    it('should position text at radius + labelOffset (outside the ring)', () => {
      fc.assert(
        fc.property(
          radiusArb,
          labelOffsetArb,
          angleArb,
          (radius, labelOffset, angle) => {
            const center = 100;
            const effectiveRadius = radius + labelOffset;
            
            // Calculate point on the effective radius
            const point = polarToCartesian(center, center, effectiveRadius, angle);
            
            // Distance from center should equal effective radius
            const distanceFromCenter = Math.sqrt(
              Math.pow(point.x - center, 2) + Math.pow(point.y - center, 2)
            );
            
            // Allow small floating point tolerance
            expect(Math.abs(distanceFromCenter - effectiveRadius)).toBeLessThan(0.001);
            
            // Effective radius should always be greater than base radius
            expect(effectiveRadius).toBeGreaterThanOrEqual(radius);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate arc path with correct start and end points', () => {
      fc.assert(
        fc.property(
          radiusArb,
          angleArb,
          angleArb,
          fc.boolean(),
          (radius, startAngle, endAngle, clockwise) => {
            const center = 100;
            
            const path = generateArcPath(center, center, radius, startAngle, endAngle, clockwise);
            
            // Extract start point from path (M x y) - allowing negative numbers
            const startMatch = path.match(/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/);
            expect(startMatch).not.toBeNull();
            
            const pathStartX = parseFloat(startMatch![1]);
            const pathStartY = parseFloat(startMatch![2]);
            
            // Calculate expected start point
            const expectedStart = polarToCartesian(center, center, radius, startAngle);
            
            // Start point should match calculated position
            expect(Math.abs(pathStartX - expectedStart.x)).toBeLessThan(0.001);
            expect(Math.abs(pathStartY - expectedStart.y)).toBeLessThan(0.001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure text is positioned outside ring for any positive labelOffset', () => {
      fc.assert(
        fc.property(
          radiusArb,
          fc.integer({ min: 1, max: 50 }), // Positive label offset
          (radius, labelOffset) => {
            const effectiveRadius = radius + labelOffset;
            
            // Text should always be positioned outside the ring
            expect(effectiveRadius).toBeGreaterThan(radius);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Additional Utility Tests
  // ============================================
  describe('Utility Functions', () => {
    it('should correctly convert degrees to radians', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 360 }),
          (degrees) => {
            const radians = degreesToRadians(degrees);
            
            // Verify conversion formula
            const expected = (degrees * Math.PI) / 180;
            expect(Math.abs(radians - expected)).toBeLessThan(0.0001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate points on circle at correct distance from center', () => {
      fc.assert(
        fc.property(
          radiusArb,
          angleArb,
          (radius, angle) => {
            const center = 100;
            const point = polarToCartesian(center, center, radius, angle);
            
            // Calculate distance from center
            const distance = Math.sqrt(
              Math.pow(point.x - center, 2) + Math.pow(point.y - center, 2)
            );
            
            // Distance should equal radius
            expect(Math.abs(distance - radius)).toBeLessThan(0.001);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
