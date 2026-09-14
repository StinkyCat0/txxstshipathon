/**
 * One feed post: author header, text, optional image, like + comment actions.
 * Shared by the feed list and the post detail modal.
 */
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mediaUrl, type Post } from '@/lib/api';
import { relativeTime } from '@/lib/time';

export function PostCard({
  post,
  onLike,
  onOpenProfile,
  onOpenComments,
}: {
  post: Post;
  onLike: (post: Post) => void;
  onOpenProfile: (userId: number) => void;
  /** Omit to hide the comment action (e.g. inside the detail modal). */
  onOpenComments?: (post: Post) => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable style={styles.header} onPress={() => onOpenProfile(post.author_id)}>
        <Image source={{ uri: mediaUrl(post.author_photo) }} style={styles.avatar} />
        <ThemedText type="smallBold">
          {post.author_name}, {post.author_age}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {relativeTime(post.created_at)}
        </ThemedText>
      </Pressable>

      {!!post.text && <ThemedText>{post.text}</ThemedText>}
      {!!post.image && (
        <Image source={{ uri: mediaUrl(post.image) }} style={styles.image} contentFit="cover" />
      )}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => onLike(post)} hitSlop={8}>
          <SymbolView
            name={post.liked_by_me ? 'heart.fill' : 'heart'}
            size={18}
            tintColor={post.liked_by_me ? '#E0245E' : theme.textSecondary}
            fallback={
              <ThemedText style={{ color: post.liked_by_me ? '#E0245E' : theme.textSecondary }}>
                ♥
              </ThemedText>
            }
          />
          <ThemedText type="small" themeColor="textSecondary">
            {post.like_count}
          </ThemedText>
        </Pressable>

        {onOpenComments && (
          <Pressable style={styles.action} onPress={() => onOpenComments(post)} hitSlop={8}>
            <SymbolView
              name="bubble.left"
              size={18}
              tintColor={theme.textSecondary}
              fallback={<ThemedText themeColor="textSecondary">💬</ThemedText>}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {post.comment_count}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
    marginTop: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
