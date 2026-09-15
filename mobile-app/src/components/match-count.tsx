/**
 * Heart + ongoing match count ("♥ 6 matches"). Sits beside a user's name in
 * feed cards, profiles, and the swipe deck.
 */
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function MatchCount({
  count,
  size = 14,
  color,
  style,
}: {
  count: number;
  /** Icon size. */
  size?: number;
  /** Overrides the label color for surfaces that don't use the theme text. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]}>
      <SymbolView
        name="heart.fill"
        size={size}
        tintColor={theme.accent}
        fallback={
          <ThemedText style={{ color: theme.accent, fontSize: size }}>♥</ThemedText>
        }
      />
      <ThemedText
        type="small"
        themeColor={color ? undefined : 'textSecondary'}
        style={color ? { color } : undefined}>
        {count} matches
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
