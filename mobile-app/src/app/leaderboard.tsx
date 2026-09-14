/**
 * Leaderboard tab: users ranked by score (matches + likes + right swipes).
 * Pull-to-refresh, refetch on focus, row press opens ProfileModal.
 */
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileModal } from '@/components/profile-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type LeaderboardEntry, type Profile } from '@/lib/api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<Profile | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const data = await api.getLeaderboard();
      setEntries([...data].sort((a, b) => b.score - a.score));
    } catch {
      // keep stale entries on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(entries.length === 0);
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onOpenProfile = async (userId: number) => {
    try {
      setViewing(await api.getProfile(userId));
    } catch {
      // profile unavailable; ignore
    }
  };

  const renderRow = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const medal = index < 3 ? MEDALS[index] : null;
    return (
      <Pressable onPress={() => onOpenProfile(item.user_id)}>
        <ThemedView
          type={index < 3 ? 'backgroundSelected' : 'backgroundElement'}
          style={styles.row}>
          <View style={styles.rank}>
            {medal ? (
              <ThemedText style={styles.medal}>{medal}</ThemedText>
            ) : (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {index + 1}
              </ThemedText>
            )}
          </View>
          <Image source={{ uri: mediaUrl(item.photo) }} style={styles.avatar} />
          <View style={styles.info}>
            <ThemedText type="smallBold">{item.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.matches} matches · {item.post_likes + item.right_swipes_received} likes
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{item.score} pts</ThemedText>
        </ThemedView>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                {loading ? 'Loading leaderboard…' : 'No rankings yet.'}
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
      <ProfileModal profile={viewing} onClose={() => setViewing(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  list: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  rank: { width: 28, alignItems: 'center' },
  medal: { fontSize: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  info: { flex: 1, gap: Spacing.half },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
