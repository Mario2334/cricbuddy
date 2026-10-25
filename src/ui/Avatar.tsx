import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { fonts, glass, shadows } from '../theme';
import { teamColor, teamInitials } from '../utils/matchDisplay';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  ring?: string;
}

/** Photo avatar that falls back to coloured initials, inside a soft glass ring. */
export function Avatar({ name, uri, size = 40, ring }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const { bg, fg } = teamColor(name);
  const showImage = !!uri && !failed && /^https?:\/\//.test(uri);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: ring || glass.rim,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          onError={() => setFailed(true)}
          style={{ width: size - 4, height: size - 4, borderRadius: size / 2 }}
        />
      ) : (
        <AppText
          style={{ fontFamily: fonts.displayBold, fontSize: size * 0.38, lineHeight: size * 0.46, letterSpacing: -0.3 }}
          color={fg}
        >
          {teamInitials(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    ...shadows.soft,
  },
});

export default Avatar;
