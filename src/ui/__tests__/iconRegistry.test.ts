import { icons, type IconName } from '../icons';

describe('icon registry', () => {
  it('maps every semantic name to a component', () => {
    for (const [name, Glyph] of Object.entries(icons)) {
      expect(typeof Glyph).toBe('function');
      expect(name).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });

  it('covers the tab bar and the core date/status glyphs', () => {
    const required: IconName[] = ['home', 'find', 'stats', 'team', 'calendar', 'clock', 'live', 'checkCircle', 'bat', 'ball'];
    for (const name of required) {
      expect(icons).toHaveProperty(name);
    }
  });
});
