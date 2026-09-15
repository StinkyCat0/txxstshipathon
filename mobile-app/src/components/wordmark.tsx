/**
 * risqué wordmark: SVG with heart diacritics, light/dark variants.
 * Source art is 361×118 (~3.06:1).
 */
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const sources = {
  light: require('@/assets/images/wordmark-light.svg'),
  dark: require('@/assets/images/wordmark-dark.svg'),
};

export function Wordmark({
  width = 120,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const scheme = useColorScheme();
  const source = scheme === 'dark' ? sources.dark : sources.light;
  return (
    <Image
      source={source}
      style={[{ width, aspectRatio: 361 / 118 }, style]}
      contentFit="contain"
    />
  );
}
