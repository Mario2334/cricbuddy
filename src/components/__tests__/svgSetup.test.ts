/**
 * SVG Setup Verification Test
 * 
 * Verifies that react-native-svg is properly installed and can be imported.
 * The actual SVG rendering is tested at runtime on the device.
 * This test verifies the mock is properly configured for unit testing.
 */

import * as svg from 'react-native-svg';
import { Svg, Path, Text, G, Defs, TextPath, TSpan, Circle } from 'react-native-svg';

describe('react-native-svg setup', () => {
  it('should be able to import react-native-svg module', () => {
    // This test verifies that the package mock is properly configured
    expect(svg).toBeDefined();
    expect(svg.Svg).toBeDefined();
    expect(svg.Path).toBeDefined();
    expect(svg.Text).toBeDefined();
    expect(svg.G).toBeDefined();
    expect(svg.Defs).toBeDefined();
    expect(svg.TextPath).toBeDefined();
  });

  it('should export all required SVG components for curved text', () => {
    // Verify all components needed for curved text are available
    expect(Svg).toBeDefined();
    expect(Path).toBeDefined();
    expect(Text).toBeDefined();
    expect(G).toBeDefined();
    expect(Defs).toBeDefined();
    expect(TextPath).toBeDefined();
    expect(TSpan).toBeDefined();
    expect(Circle).toBeDefined();
  });

  it('should have components that can be used as React components', () => {
    // Verify components have displayName set (indicating they are valid React components)
    expect(typeof Svg).toBe('function');
    expect(typeof Path).toBe('function');
    expect(typeof Text).toBe('function');
    expect(typeof TextPath).toBe('function');
  });
});
