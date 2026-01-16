/**
 * Utility functions for CurvedTimeText Component
 * 
 * These functions handle arc path calculations and text positioning
 * for curved text rendering around the progress ring.
 * 
 * Feature: curved-timer-compact-metrics
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.5
 */

/**
 * Converts degrees to radians
 */
export const degreesToRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Calculates a point on a circle given center, radius, and angle
 * Angle is in degrees, 0 = top (12 o'clock), clockwise positive
 */
export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } => {
  // Convert to standard math coordinates (0 = right, counter-clockwise positive)
  // Then adjust so 0 = top and clockwise is positive
  const angleInRadians = degreesToRadians(angleInDegrees - 90);
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

/**
 * Generates an SVG arc path for curved text
 * 
 * @param centerX - X coordinate of arc center
 * @param centerY - Y coordinate of arc center
 * @param radius - Radius of the arc
 * @param startAngle - Starting angle in degrees (0 = top)
 * @param endAngle - Ending angle in degrees
 * @param clockwise - Direction of the arc
 */
export const generateArcPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean
): string => {
  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  
  // Calculate arc sweep
  let angleDiff = endAngle - startAngle;
  if (clockwise && angleDiff < 0) {
    angleDiff += 360;
  } else if (!clockwise && angleDiff > 0) {
    angleDiff -= 360;
  }
  
  const largeArcFlag = Math.abs(angleDiff) > 180 ? 1 : 0;
  const sweepFlag = clockwise ? 1 : 0;
  
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};

/**
 * Ensures font size meets minimum legibility requirement
 */
export const ensureMinimumFontSize = (fontSize: number): number => {
  const MIN_FONT_SIZE = 12;
  return Math.max(fontSize, MIN_FONT_SIZE);
};

/**
 * Determines if the arc direction is clockwise based on side
 * Left side (elapsed time): counter-clockwise
 * Right side (remaining time): clockwise
 */
export const getArcDirection = (side: 'left' | 'right'): boolean => {
  return side === 'right';
};

/**
 * Calculates the effective radius for text positioning
 * Text is positioned outside the ring by labelOffset
 */
export const calculateEffectiveRadius = (radius: number, labelOffset: number): number => {
  return radius + labelOffset;
};
