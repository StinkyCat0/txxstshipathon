/**
 * Feed tab: composer + list of posts from other users.
 * Pull-to-refresh, refetch on focus, like toggles, comment thread modal.
 */
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { PostModal } from '@/components/post-modal';
import { ProfileModal } from '@/components/profile-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type Post, type Profile } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function FeedScreen() {
  const { userId } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [me, setMe] = useState<Profile | null>(null);

  const load = useCallback(
    async (initial = false) => {
      if (userId === null || userId === 0) return;
      if (initial) setLoading(true);
      try {
        setPosts(await api.getFeed(userId));
      } catch {
        // keep stale posts on failure
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(posts.length === 0);
    }, [load]),
  );

  // Own profile for the header avatar.
  useEffect(() => {
    if (!userId) return;
    api.getProfile(userId).then(setMe).catch(() => {});
  }, [userId]);

  const onLike = async (post: Post) => {
    if (userId === null || userId === 0) return;
    // optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p,
      ),
    );
    setOpenPost((prev) =>
      prev && prev.id === post.id
        ? { ...prev, liked_by_me: !prev.liked_by_me, like_count: prev.like_count + (prev.liked_by_me ? -1 : 1) }
        : prev,
    );
    try {
      const res = await api.toggleLike(post.id, userId);
      const sync = (p: Post) =>
        p.id === post.id ? { ...p, liked_by_me: res.liked, like_count: res.like_count } : p;
      setPosts((prev) => prev.map(sync));
      setOpenPost((prev) => (prev ? sync(prev) : prev));
    } catch {
      // revert on failure
      const revert = (p: Post) =>
        p.id === post.id ? { ...p, liked_by_me: post.liked_by_me, like_count: post.like_count } : p;
      setPosts((prev) => prev.map(revert));
      setOpenPost((prev) => (prev ? revert(prev) : prev));
    }
  };

  const onOpenProfile = async (authorId: number) => {
    try {
      setViewing(await api.getProfile(authorId));
    } catch {
      // profile unavailable; ignore
    }
  };

  const onCommentAdded = (postId: number) => {
    const bump = (p: Post) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p);
    setPosts((prev) => prev.map(bump));
    setOpenPost((prev) => (prev ? bump(prev) : prev));
  };
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Wordmark width={110} />
          <Pressable
            accessibilityLabel="Your profile"
            onPress={() => router.navigate('/profile')}
            hitSlop={8}>
            <Image
              source={{ uri: mediaUrl(me?.photos[0]) }}
              style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}
              contentFit="cover"
            />
          </Pressable>
        </View>
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={onLike}
              onOpenProfile={onOpenProfile}
              onOpenComments={setOpenPost}
            />
          )}
          ListHeaderComponent={
            <View style={[styles.composerWrap, { borderBottomColor: theme.border }]}>
              <PostComposer onPosted={(post) => setPosts((prev) => [post, ...prev])} />
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                {loading ? 'Loading feed…' : 'No posts yet. Be the first!'}
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
      <ProfileModal profile={viewing} onClose={() => setViewing(null)} />
      <PostModal
        post={openPost}
        onClose={() => setOpenPost(null)}
        onLike={onLike}
        onOpenProfile={onOpenProfile}
        onCommentAdded={onCommentAdded}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  list: {
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  composerWrap: {
    padding: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
