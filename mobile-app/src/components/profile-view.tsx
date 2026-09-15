/**
 * Hinge-style profile renderer: interleaved photos and prompt cards.
 * Used by the swipe deck, feed/leaderboard profile modal, and the You tab.
 */
import { Image } from 'expo-image';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mediaUrl, type Profile } from '@/lib/api';
import { promptLabel } from '@/lib/prompts';

type Block = { kind: 'photo' | 'prompt'; index: number };

export function ProfileView({ profile }: { profile: Profile }) {
  // Interleave: photo[0], prompt[0], photo[1], prompt[1], ...
  const blocks: Block[] = [];
  const n = Math.max(profile.photos.length, profile.prompts.length);
  for (let i = 0; i < n; i++) {
    if (i < profile.photos.length) blocks.push({ kind: 'photo', index: i });
    if (i < profile.prompts.length) blocks.push({ kind: 'prompt', index: i });
  }

  // Name/age/bio sit under the lead photo. With no photos there is nothing to
  // sit under, so they lead.
  const lead = blocks[0]?.kind === 'photo' ? blocks[0] : null;
  const rest = lead ? blocks.slice(1) : blocks;

  return (
    <View style={styles.root}>
      {lead && (
        <Image
          source={{ uri: mediaUrl(profile.photos[lead.index]) }}
          style={styles.photo}
          contentFit="cover"
        />
      )}
      <View style={styles.header}>
        <ThemedText type="subtitle">
          {profile.name}, {profile.age}
        </ThemedText>
        {!!profile.bio && (
          <ThemedText themeColor="textSecondary" style={styles.bio}>
            {profile.bio}
          </ThemedText>
        )}
      </View>
      {rest.map((b, i) =>
        b.kind === 'photo' ? (
          <Image
            key={`p${i}`}
            source={{ uri: mediaUrl(profile.photos[b.index]) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <ThemedView key={`q${i}`} type="backgroundSelected" style={styles.promptCard}>
            <ThemedText type="small" themeColor="textSecondary">
              {promptLabel(profile.prompts[b.index].prompt_key)}
            </ThemedText>
            <ThemedText style={styles.answer}>{profile.prompts[b.index].answer}</ThemedText>
          </ThemedView>
        ),
      )}
    </View>
  );
}

/** Read-only profile in a modal — feed cards and leaderboard rows open this. */
export function ProfileModal({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!profile} animationType="slide" onRequestClose={onClose}>
      {/* Modals get their own window on iOS — a nested provider is required
          for SafeAreaView to see the modal's insets. */}
      <SafeAreaProvider>
        <ThemedView style={styles.modal}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <ThemedText type="linkPrimary" onPress={onClose} style={styles.close}>
              Close
            </ThemedText>
            <ScrollView contentContainerStyle={styles.scroll}>
              {profile && <ProfileView profile={profile} />}
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  header: { gap: Spacing.one },
  bio: { fontSize: 15 },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: Spacing.three },
  promptCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  answer: { fontSize: 18, lineHeight: 26 },
  modal: { flex: 1 },
  modalSafe: { flex: 1, paddingHorizontal: Spacing.three },
  close: { paddingVertical: Spacing.two },
  scroll: { paddingBottom: Spacing.six },
});
