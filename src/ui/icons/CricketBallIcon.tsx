import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { IconProps } from 'phosphor-react-native';

/** A cricket ball in Phosphor's 256 grid and prop shape (regular / fill / duotone). */
export function CricketBallIcon({
  size = 24,
  color = '#000',
  weight = 'regular',
  duotoneColor,
  duotoneOpacity = 0.2,
  style,
  testID,
}: IconProps) {
  const stroke = weight === 'bold' ? 20 : weight === 'light' || weight === 'thin' ? 10 : 16;
  const seamColor = weight === 'fill' ? 'rgba(255,255,255,0.85)' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" style={style} testID={testID}>
      {weight === 'duotone' ? (
        <Circle cx={128} cy={128} r={96} fill={duotoneColor ?? color} opacity={duotoneOpacity} />
      ) : null}
      <Circle
        cx={128}
        cy={128}
        r={96}
        fill={weight === 'fill' ? color : 'none'}
        stroke={color}
        strokeWidth={weight === 'fill' ? 0 : stroke}
      />
      <Path d="M104 36 C 132 86, 132 170, 104 220" stroke={seamColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
      <Path
        d="M152 36 C 124 86, 124 170, 152 220"
        stroke={seamColor}
        strokeWidth={stroke * 0.7}
        strokeDasharray="10 14"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default CricketBallIcon;
