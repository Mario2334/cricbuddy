import { springs } from '../motion';

// Damping ratio ζ = d / (2·√(k·m)); ≥ 0.7 keeps motion smooth (no cartoon bounce).
const dampingRatio = ({ damping, stiffness, mass }: { damping: number; stiffness: number; mass: number }) =>
  damping / (2 * Math.sqrt(stiffness * mass));

describe('springs', () => {
  it.each(Object.entries(springs))('%s is near critically damped', (_name, spring) => {
    expect(dampingRatio(spring)).toBeGreaterThanOrEqual(0.7);
  });
});
