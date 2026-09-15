/**
 * Messages tab: matched users you can DM. Row opens a chat modal —
 * bubble thread + composer, polled while open.
 */
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type MatchEntry, type Message } from '@/lib/api';
import { useSession } from '@/lib/session';
import { relativeTime } from '@/lib/time';

const POLL_MS = 3000;

function ChatModal({
  match,
  onClose,
}: {
  match: MatchEntry | null;
  onClose: () => void;
}) {
  const { userId } = useSession();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const matchId = match?.match_id ?? null;

  const load = useCallback(async () => {
    if (matchId === null || !userId) return;
    try {
      setMessages(await api.getMessages(matchId, userId));
    } catch {
      // keep prior messages; next poll retries
    }
  }, [matchId, userId]);

  // Poll while the chat is open.
  useEffect(() => {
    setMessages([]);
    setDraft('');
    if (matchId === null) return;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [matchId, load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || matchId === null || !userId) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(matchId, userId, text);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch {
      // keep the draft so the user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!match} animationType="slide" onRequestClose={onClose}>
      {/* Modals get their own window on iOS — nested provider for insets. */}
      <SafeAreaProvider>
        <ThemedView style={styles.modal}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <View style={styles.chatHeader}>
              <ThemedText type="linkPrimary" onPress={onClose}>
                Back
              </ThemedText>
              {match && (
                <View style={styles.chatPeer}>
                  <Image
                    source={{ uri: mediaUrl(match.profile.photos[0]) }}
                    style={styles.chatAvatar}
                  />
                  <ThemedText type="smallBold">{match.profile.name}</ThemedText>
                </View>
              )}
              <View style={styles.chatHeaderSpacer} />
            </View>

            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.thread}
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: false })
                }>
                {messages.length === 0 ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.emptyChat}>
                    Say hi — you matched!
                  </ThemedText>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.bubble,
                          mine
                            ? [styles.bubbleMine, { backgroundColor: theme.accentSoft }]
                            : [styles.bubbleTheirs, { backgroundColor: theme.backgroundElement }],
                        ]}>
                        <ThemedText
                          style={mine ? { color: theme.accent } : undefined}>
                          {m.text}
                        </ThemedText>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.composer}>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message…"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
                <Pressable onPress={send} disabled={sending || draft.trim().length === 0}>
                  <ThemedText
                    type="linkPrimary"
                    style={{ opacity: draft.trim().length === 0 ? 0.4 : 1 }}>
                    {sending ? '…' : 'Send'}
                  </ThemedText>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

export default function MessagesScreen() {
  const { userId } = useSession();
  const theme = useTheme();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<MatchEntry | null>(null);

  const load = useCallback(
    async (initial = false) => {
      if (!userId) return;
      if (initial) setLoading(true);
      try {
        setMatches(await api.getMatches(userId));
      } catch {
        // keep prior list
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(matches.length === 0);
    }, [load]),
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={matches}
          keyExtractor={(m) => String(m.match_id)}
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
                {loading ? 'Loading matches…' : 'No matches yet. Keep swiping!'}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setOpen(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <Image
                source={{ uri: mediaUrl(item.profile.photos[0]) }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">
                  {item.profile.name}, {item.profile.age}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Matched {relativeTime(item.matched_at)}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          )}
        />
      </SafeAreaView>
      <ChatModal match={open} onClose={() => setOpen(null)} />
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
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#888' },
  rowBody: { flex: 1, gap: Spacing.half },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modal: { flex: 1 },
  modalSafe: { flex: 1, paddingHorizontal: Spacing.three },
  flex: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  chatPeer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  chatHeaderSpacer: { width: 32 },
  chatAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#888' },
  thread: { gap: Spacing.two, paddingVertical: Spacing.two, flexGrow: 1 },
  emptyChat: { textAlign: 'center', marginTop: Spacing.four },
  bubble: {
    maxWidth: '78%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    maxHeight: 120,
  },
});
