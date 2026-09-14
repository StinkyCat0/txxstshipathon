/**
 * Swipe tab: tinder-style deck. Top card is the LAST element of `deck`
 * (we pop from the end so the array order matches fetch order).
 */
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

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
}: {
  profile: Profile;
  onSwiped: (direction: Direction) => void;
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
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { backgroundColor: theme.backgroundElement }, animatedStyle]}>
        {photo ? (
          <>
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.cardOverlay}>
              <ThemedText type="subtitle" style={styles.overlayName}>
                {profile.name}, {profile.age}
              </ThemedText>
              {!!firstPrompt && (
                <View style={styles.overlayPrompt}>
                  <ThemedText type="small" style={styles.overlayPromptLabel}>
                    {promptLabel(firstPrompt.prompt_key)}
                  </ThemedText>
                  <ThemedText style={styles.overlayAnswer}>{firstPrompt.answer}</ThemedText>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.cardBody}>
            <ProfileView profile={profile} />
          </View>
        )}
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

  const handleSwiped = useCallback(
    (direction: Direction) => {
      const swiped = topRef.current;
      if (!swiped || !userId) return;
      setDeck((d) => d.slice(0, -1));
      api
        .swipe(userId, swiped.id, direction)
        .then((res) => {
          if (res.matched) setMatch(swiped);
        })
        .catch(() => {});
    },
    [userId],
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
                  <View style={[styles.card, styles.cardBehind, { backgroundColor: theme.backgroundElement }]}>
                    {mediaUrl(next.photos[0]) ? (
                      <Image
                        source={{ uri: mediaUrl(next.photos[0]) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.cardBody}>
                        <ProfileView profile={next} />
                      </View>
                    )}
                  </View>
                )}
                <SwipeCard key={top.id} profile={top} onSwiped={handleSwiped} />
              </>
            )}
          </View>

          {top !== null && (
            <View style={styles.buttons}>
              <Pressable
                accessibilityLabel="Pass"
                onPress={() => handleSwiped('left')}
                style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.buttonGlyph}>✕</ThemedText>
              </Pressable>
              <Pressable
                accessibilityLabel="Like"
                onPress={() => handleSwiped('right')}
                style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={[styles.buttonGlyph, styles.heart]}>♥</ThemedText>
              </Pressable>
            </View>
          )}
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
    overflow: 'hidden',
  },
  cardBehind: {
    transform: [{ scale: 0.95 }],
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.four,
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayName: { color: '#fff' },
  overlayPrompt: { gap: Spacing.half },
  overlayPromptLabel: { color: 'rgba(255,255,255,0.8)' },
  overlayAnswer: { color: '#fff', fontSize: 18, lineHeight: 26 },
  cardBody: { flex: 1, padding: Spacing.three },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingTop: Spacing.three,
  },
  roundButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGlyph: { fontSize: 28, lineHeight: 34 },
  heart: { color: '#e5484d' },
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
