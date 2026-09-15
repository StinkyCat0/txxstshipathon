/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111216', // Charcoal
    background: '#FDF3F4', // blush-tinted white
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FADADD', // Blush Pink
    textSecondary: '#8E8E93', // Soft Gray
    accent: '#D97A93', // deep rose — hearts, links, active states
    accentSoft: '#FADADD', // Blush Pink fill for pills/cards
    border: '#EAE2E3', // hairline divider on the flush feed wall
  },
  dark: {
    text: '#FFFFFF',
    background: '#141517',
    backgroundElement: '#1E2021',
    backgroundSelected: '#2A2C2E',
    textSecondary: '#8E8E93', // Soft Gray
    accent: '#E7A9B8',
    accentSoft: '#33262B',
    border: '#2E3032', // hairline divider on the flush feed wall
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 96, android: 96 }) ?? 96;
export const MaxContentWidth = 800;
