/**
 * Bottom tab bar: Home / Discover / big center + / Matches / Profile.
 * Custom bar (not NativeTabs) so the center compose button can sit
 * elevated between the tab items. Opaque background for readability.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostComposerModal } from './post-composer';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = SymbolViewProps['name'];

function TabItem({
  isFocused,
  icon,
  label,
  style,
  ...props
}: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : theme.textSecondary;
  return (
    <Pressable {...props} style={[style as StyleProp<ViewStyle>, styles.tabItem]}>
      <SymbolView
        name={icon}
        size={22}
        tintColor={color}
        fallback={<ThemedText style={{ color }}>●</ThemedText>}
      />
      <ThemedText style={[styles.tabLabel, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  return (
    <Tabs style={styles.tabs}>
      <TabSlot style={styles.slot} />
      <TabList
        style={[
          styles.bar,
          {
            backgroundColor: theme.backgroundElement,
            borderTopColor: theme.backgroundSelected,
            paddingBottom: insets.bottom + Spacing.two,
          },
        ]}>
        <TabTrigger name="index" href="/" asChild>
          <TabItem icon="house" label="Home" />
        </TabTrigger>
        <TabTrigger name="swipe" href="/swipe" asChild>
          <TabItem icon="rectangle.stack" label="Discover" />
        </TabTrigger>

        {/* Center compose button — opens the post composer modal. */}
        <Pressable
          accessibilityLabel="New post"
          onPress={() => setComposing(true)}
          style={({ pressed }) => [
            styles.plusButton,
            { backgroundColor: theme.accentSoft },
            pressed && { opacity: 0.8 },
          ]}>
          <ThemedText style={[styles.plusGlyph, { color: theme.accent }]}>+</ThemedText>
        </Pressable>

        <TabTrigger name="leaderboard" href="/leaderboard" asChild>
          <TabItem icon="heart" label="Matches" />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <TabItem icon="person.crop.circle" label="Profile" />
        </TabTrigger>
      </TabList>
      <PostComposerModal
        visible={composing}
        onClose={() => setComposing(false)}
        onPosted={() => router.navigate('/')}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabs: { flex: 1 },
  slot: { flex: 1, height: '100%' },
  bar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  tabLabel: { fontSize: 11, fontWeight: 600 },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -Spacing.four,
    marginHorizontal: Spacing.two,
  },
  plusGlyph: { fontSize: 30, lineHeight: 34, fontWeight: 500 },
});
