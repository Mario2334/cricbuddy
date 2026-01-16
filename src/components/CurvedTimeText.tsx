/**
 * CurvedTimeText Component
 * 
 * Renders text along a circular arc path using SVG textPath.
 * Used for displaying elapsed and remaining time around the progress ring.
 * 
 * Feature: curved-timer-compact-metrics
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.5
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Text, TextPath, Defs } from 'react-native-svg';
import {
  generateArcPath,
  ensureMinimumFontSize,
  getArcDirection,
  calculateEffectiveRadius,
} from '../utils/curvedTextUtils';

export interface CurvedTimeTextProps {
  text: string;
  radius: number;
  startAngle: number; // degrees, 0 = top (12 o'clock position)
  endAngle: number;   // degrees
  fontSize: number;
  color: string;
  side: 'left' | 'right'; // left = elapsed (counter-clockwise), right = remaining (clockwise)
  labelOffset?: number;   // pixels outside the ring (default: 10)
  containerSize?: number; // Size of the parent container (diameter)
}

/**
 * CurvedTimeText renders text along a circular arc
 * 
 * - Left side: text flows counter-clockwise (bottom to top) for elapsed time
 * - Right side: text flows clockwise (top to bottom) for remaining time
 */
export const CurvedTimeText: React.FC<CurvedTimeTextProps> = ({
  text,
  radius,
  startAngle,
  endAngle,
  fontSize,
  color,
  side,
  labelOffset = 10,
  containerSize,
}) => {
  // Ensure minimum font size for legibility (Requirement 1.3, 2.3)
  const safeFontSize = ensureMinimumFontSize(fontSize);
  
  // Calculate effective radius with offset (text positioned outside the ring)
  const effectiveRadius = calculateEffectiveRadius(radius, labelOffset);
  
  // Use provided container size or calculate based on effective radius
  const svgSize = containerSize || (effectiveRadius + safeFontSize + 10) * 2;
  const center = svgSize / 2;
  
  // Determine arc direction based on side
  // Left side: counter-clockwise (elapsed time)
  // Right side: clockwise (remaining time)
  const clockwise = getArcDirection(side);
  
  // Generate unique path ID for textPath reference
  const pathId = `curved-text-path-${side}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate the arc path centered in the SVG
  const arcPath = generateArcPath(
    center,
    center,
    effectiveRadius,
    startAngle,
    endAngle,
    clockwise
  );

  return (
    <View 
      style={[styles.container, { width: svgSize, height: svgSize }]}
      pointerEvents="none"
    >
      <Svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
      >
        <Defs>
          <Path id={pathId} d={arcPath} fill="none" />
        </Defs>
        <Text
          fill={color}
          fontSize={safeFontSize}
          fontWeight="600"
          fontFamily="monospace"
          textAnchor="middle"
        >
          <TextPath href={`#${pathId}`} startOffset="50%">
            {text}
          </TextPath>
        </Text>
      </Svg>
    </View>
  );
};

// Re-export utility functions for external use
export { 
  generateArcPath, 
  ensureMinimumFontSize, 
  getArcDirection, 
  calculateEffectiveRadius 
} from '../utils/curvedTextUtils';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});

export default CurvedTimeText;
