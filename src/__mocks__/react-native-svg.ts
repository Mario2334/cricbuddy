/**
 * Mock for react-native-svg
 * 
 * Provides mock implementations of SVG components for Jest testing.
 */

import React from 'react';

// Mock SVG component factory
const createMockComponent = (name: string) => {
  const MockComponent = ({ children, ...props }: any) => {
    return React.createElement(name, props, children);
  };
  MockComponent.displayName = name;
  return MockComponent;
};

// Export mock SVG components
export const Svg = createMockComponent('Svg');
export const Path = createMockComponent('Path');
export const Text = createMockComponent('Text');
export const TSpan = createMockComponent('TSpan');
export const TextPath = createMockComponent('TextPath');
export const G = createMockComponent('G');
export const Defs = createMockComponent('Defs');
export const Circle = createMockComponent('Circle');
export const Rect = createMockComponent('Rect');
export const Line = createMockComponent('Line');
export const Polygon = createMockComponent('Polygon');
export const Polyline = createMockComponent('Polyline');
export const Ellipse = createMockComponent('Ellipse');
export const LinearGradient = createMockComponent('LinearGradient');
export const RadialGradient = createMockComponent('RadialGradient');
export const Stop = createMockComponent('Stop');
export const ClipPath = createMockComponent('ClipPath');
export const Mask = createMockComponent('Mask');
export const Use = createMockComponent('Use');
export const Symbol = createMockComponent('Symbol');
export const Image = createMockComponent('Image');
export const ForeignObject = createMockComponent('ForeignObject');
export const Pattern = createMockComponent('Pattern');
export const Marker = createMockComponent('Marker');

export default Svg;
