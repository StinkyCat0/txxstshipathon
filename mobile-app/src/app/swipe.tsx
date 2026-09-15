/**
 * Swipe tab: tinder-style deck. Top card is the LAST element of `deck`
 * (we pop from the end so the array order matches fetch order).
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type Profile } from '@/lib/api';
import { promptLabel } from '@/lib/prompts';
import { useSession } from '@/lib/session';

const SWIPE_THRESHOLD = 120;
const OFFSCREEN_MS = 220;

type Direction = 'left' | 'right';

function SwipeCard({
  profile,
  onSwiped,
  onExpand,
}: {
  profile: Profile;
  onSwiped: (direction: Direction) => void;
  onExpand: () => void;
}) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const fling = useCallback(
    (direction: Direction) => {
      'worklet';
      translateX.value = withTiming(
        (direction === 'right' ? 1 : -1) * width * 1.5,
        { duration: OFFSCREEN_MS },
        () => runOnJS(onSwiped)(direction),
      );
    },
    [onSwiped, translateX, width],
  );

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        fling(e.translationX > 0 ? 'right' : 'left');
      } else {
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onExpand)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-width / 2, width / 2], [-10, 10])}deg` },
    ],
  }));

  const photo = mediaUrl(profile.photos[0]);
  const firstPrompt = profile.prompts[0];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
          animatedStyle,
        ]}>
        {/* Photo fills the whole card, cropped to keep every edge covered. */}
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
            <ThemedText type="title" themeColor="textSecondary">
              {profile.name.charAt(0)}
            </ThemedText>
          </View>
        )}

        {/* Scrim: keeps the overlay text readable without backing it. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          locations={[0.35, 1]}
          style={styles.gradient}
        />

        {/* Info block: name/age, bio, first prompt — tap expands full profile. */}
        <View style={styles.cardInfo}>
          <View style={styles.cardInfoRow}>
            <View style={styles.cardInfoText}>
              <ThemedText type="subtitle" style={styles.cardName}>
                {profile.name}, {profile.age}
              </ThemedText>
              {!!profile.bio && (
                <ThemedText numberOfLines={2} style={styles.cardBio}>
                  {profile.bio}
                </ThemedText>
              )}
            </View>
            <View style={styles.cardActions}>
              <Pressable
                accessibilityLabel="Pass"
                onPress={() => fling('left')}
                style={[
                  styles.cardAction,
                  styles.cardActionAbove,
                  { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText style={styles.cardActionGlyph}>✕</ThemedText>
              </Pressable>
              <Pressable
                accessibilityLabel="Like"
                onPress={() => fling('right')}
                style={[styles.cardAction, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.cardActionGlyph, { color: theme.accent }]}>
                  ♥
                </ThemedText>
              </Pressable>
            </View>
          </View>
          {!!firstPrompt && (
            // Keeps its backing, but translucent so the photo reads through.
            <View
              style={[
                styles.promptCard,
                { backgroundColor: `${theme.backgroundSelected}B3` },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {promptLabel(firstPrompt.prompt_key)}
              </ThemedText>
              <ThemedText numberOfLines={2} style={styles.promptAnswer}>
                {firstPrompt.answer}
              </ThemedText>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function SwipeScreen() {
  const { userId } = useSession();
  const theme = useTheme();
  const [deck, setDeck] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Profile | null>(null);
  const [expanded, setExpanded] = useState<Profile | null>(null);
  const topRef = useRef<Profile | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    api
      .getDeck(userId)
      .then(setDeck)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const top = deck.length > 0 ? deck[deck.length - 1] : null;
  const next = deck.length > 1 ? deck[deck.length - 2] : null;
  topRef.current = top;

  const swipeProfile = useCallback(
    (swiped: Profile, direction: Direction) => {
      if (!userId) return;
      setDeck((d) => d.filter((p) => p.id !== swiped.id));
      api
        .swipe(userId, swiped.id, direction)
        .then((res) => {
          if (res.matched) setMatch(swiped);
        })
        .catch(() => {});
    },
    [userId],
  );

  const handleSwiped = useCallback(
    (direction: Direction) => {
      const swiped = topRef.current;
      if (swiped) swipeProfile(swiped, direction);
    },
    [swipeProfile],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.deckArea}>
            {loading && deck.length === 0 ? null : top === null ? (
              <View style={styles.empty}>
                <ThemedText type="subtitle">No one new</ThemedText>
                <ThemedText themeColor="textSecondary">Check back later.</ThemedText>
                <Pressable
                  onPress={load}
                  style={[styles.refreshButton, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Refresh</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                {next && (
                  <View
                    style={[
                      styles.card,
                      styles.cardBehind,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}>
                    {mediaUrl(next.photos[0]) ? (
                      <Image
                        source={{ uri: mediaUrl(next.photos[0]) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                )}
                <SwipeCard
                  key={top.id}
                  profile={top}
                  onSwiped={handleSwiped}
                  onExpand={() => setExpanded(top)}
                />
              </>
            )}
          </View>

          {/* Pass/like live on the card itself; no bottom button row. */}
        </SafeAreaView>
      </ThemedView>

      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        <View style={styles.matchBackdrop}>
          <ThemedView type="backgroundElement" style={styles.matchCard}>
            <ThemedText type="subtitle">It&apos;s a match!</ThemedText>
            {!!match && (
              <ThemedText themeColor="textSecondary">
                You and {match.name} liked each other.
              </ThemedText>
            )}
            <Pressable
              onPress={() => setMatch(null)}
              style={[styles.refreshButton, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">Dismiss</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Expanded profile: full ProfileView with match / go-back actions.
          Nested provider — modals get their own window on iOS. */}
      <Modal
        visible={!!expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(null)}>
        <SafeAreaProvider>
          <ThemedView style={styles.expanded}>
            <SafeAreaView style={styles.expandedSafe} edges={['top', 'bottom']}>
              <ScrollView contentContainerStyle={styles.expandedScroll}>
                {expanded && <ProfileView profile={expanded} />}
              </ScrollView>
              <View style={styles.expandedButtons}>
                <Pressable
                  onPress={() => setExpanded(null)}
                  style={[styles.expandedButton, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Go back</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (expanded) swipeProfile(expanded, 'right');
                    setExpanded(null);
                  }}
                  style={[styles.expandedButton, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    ♥ Match
                  </ThemedText>
                </Pressable>
              </View>
            </SafeAreaView>
          </ThemedView>
        </SafeAreaProvider>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
  },
  deckArea: { flex: 1 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Spacing.four,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBehind: {
    transform: [{ scale: 0.95 }],
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    pointerEvents: 'none',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stacked in the info block: the heart sits inline with the name, and the
  // pass button floats directly above it, out of flow so it can't push the
  // text down.
  cardActions: {
    flexDirection: 'column',
  },
  cardActionAbove: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: Spacing.two,
  },
  cardAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardActionGlyph: { fontSize: 20, lineHeight: 24 },
  cardInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardInfoText: { flex: 1, gap: Spacing.two },
  cardName: { color: '#fff', fontSize: 26, lineHeight: 32 },
  cardBio: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 20 },
  promptCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  promptAnswer: { fontSize: 16, lineHeight: 22 },
  expanded: { flex: 1 },
  expandedSafe: { flex: 1, paddingHorizontal: Spacing.three },
  expandedScroll: { gap: Spacing.three, paddingBottom: Spacing.four },
  expandedButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  expandedButton: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 999,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  refreshButton: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  matchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  matchCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
});
