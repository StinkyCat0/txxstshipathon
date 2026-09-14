/**
 * Post detail modal: the post plus its comment thread and a reply composer.
 * Comments are fetched flat and nested one level by `parent_id`.
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type Comment, type Post } from '@/lib/api';
import { useSession } from '@/lib/session';
import { relativeTime } from '@/lib/time';

function CommentRow({
  comment,
  onReply,
  onOpenProfile,
}: {
  comment: Comment;
  onReply: (comment: Comment) => void;
  onOpenProfile: (userId: number) => void;
}) {
  return (
    <View style={styles.comment}>
      <Pressable onPress={() => onOpenProfile(comment.author_id)}>
        <Image source={{ uri: mediaUrl(comment.author_photo) }} style={styles.commentAvatar} />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <ThemedText type="smallBold">{comment.author_name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {relativeTime(comment.created_at)}
          </ThemedText>
        </View>
        <ThemedText type="small">{comment.text}</ThemedText>
        <Pressable onPress={() => onReply(comment)} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            Reply
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function PostModal({
  post,
  onClose,
  onLike,
  onOpenProfile,
  onCommentAdded,
}: {
  post: Post | null;
  onClose: () => void;
  onLike: (post: Post) => void;
  onOpenProfile: (userId: number) => void;
  /** Bump the feed card's comment count after a successful post. */
  onCommentAdded: (postId: number) => void;
}) {
  const { userId } = useSession();
  const theme = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const postId = post?.id ?? null;

  useEffect(() => {
    setComments([]);
    setDraft('');
    setReplyTo(null);
    if (postId === null) return;
    let cancelled = false;
    setLoading(true);
    api
      .getComments(postId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        // leave the thread empty; user can reopen
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const send = async () => {
    if (postId === null || userId === null || userId === 0) return;
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const comment = await api.addComment(postId, userId, {
        text,
        parent_id: replyTo?.id ?? null,
      });
      setComments((prev) => [...prev, comment]);
      setDraft('');
      setReplyTo(null);
      onCommentAdded(postId);
    } catch {
      // keep the draft so the user can retry
    } finally {
      setSending(false);
    }
  };

  const roots = comments.filter((c) => c.parent_id === null);
  const repliesOf = (id: number) => comments.filter((c) => c.parent_id === id);

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.modal}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <ThemedText type="linkPrimary" onPress={onClose}>
              Close
            </ThemedText>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll}>
              {post && (
                <PostCard post={post} onLike={onLike} onOpenProfile={onOpenProfile} />
              )}

              <ThemedText type="smallBold" themeColor="textSecondary">
                {comments.length === 1 ? '1 comment' : `${comments.length} comments`}
              </ThemedText>

              {loading ? (
                <ActivityIndicator style={styles.loading} />
              ) : roots.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No comments yet. Start the conversation.
                </ThemedText>
              ) : (
                roots.map((root) => (
                  <View key={root.id} style={styles.thread}>
                    <CommentRow
                      comment={root}
                      onReply={setReplyTo}
                      onOpenProfile={onOpenProfile}
                    />
                    {repliesOf(root.id).map((reply) => (
                      <View key={reply.id} style={styles.replyIndent}>
                        <CommentRow
                          comment={reply}
                          onReply={setReplyTo}
                          onOpenProfile={onOpenProfile}
                        />
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            {replyTo && (
              <View style={styles.replyBanner}>
                <ThemedText type="small" themeColor="textSecondary">
                  Replying to {replyTo.author_name}
                </ThemedText>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <View style={styles.composer}>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? `Reply to ${replyTo.author_name}…` : 'Add a comment…'}
                placeholderTextColor={theme.textSecondary}
                multiline
              />
              <Pressable onPress={send} disabled={sending || draft.trim().length === 0}>
                <ThemedText
                  type="linkPrimary"
                  style={{ opacity: draft.trim().length === 0 ? 0.4 : 1 }}>
                  {sending ? 'Sending…' : 'Send'}
                </ThemedText>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },
  flex: { flex: 1 },
  topBar: { paddingVertical: Spacing.two },
  scroll: { gap: Spacing.three, paddingBottom: Spacing.four },
  loading: { marginTop: Spacing.three },
  thread: { gap: Spacing.two },
  replyIndent: { paddingLeft: Spacing.five },
  comment: { flexDirection: 'row', gap: Spacing.two },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBody: { flex: 1, gap: Spacing.half },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    maxHeight: 120,
  },
});
