/**
 * Feed composer: text plus an optional image, posted to the feed.
 * The image is uploaded first (POST /uploads), then the post is created
 * with the returned filename.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type Post } from '@/lib/api';
import { useSession } from '@/lib/session';

export function PostComposer({ onPosted }: { onPosted: (post: Post) => void }) {
  const { userId } = useSession();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);

  const canPost = !posting && (text.trim().length > 0 || asset !== null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const picked = result.assets?.[0];
    if (result.canceled || !picked) return;
    setAsset(picked);
  };

  const submit = async () => {
    if (!canPost || userId === null || userId === 0) return;
    setPosting(true);
    try {
      let image: string | null = null;
      if (asset) {
        image = (
          await api.uploadImage(asset.uri, {
            fileName: asset.fileName,
            mimeType: asset.mimeType,
          })
        ).path;
      }
      const post = await api.createPost(userId, { text: text.trim(), image });
      onPosted(post);
      setText('');
      setAsset(null);
    } catch (e) {
      Alert.alert('Could not post', String(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={text}
        onChangeText={setText}
        placeholder="Share something…"
        placeholderTextColor={theme.textSecondary}
        multiline
      />

      {asset && (
        <View style={styles.previewRow}>
          <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="cover" />
          <Pressable onPress={() => setAsset(null)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Remove
            </ThemedText>
          </Pressable>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={pickImage} hitSlop={8}>
          <SymbolView
            name="photo"
            size={20}
            tintColor={theme.textSecondary}
            fallback={<ThemedText themeColor="textSecondary">🖼</ThemedText>}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Photo
          </ThemedText>
        </Pressable>

        <Pressable onPress={submit} disabled={!canPost}>
          <ThemedText type="linkPrimary" style={{ opacity: canPost ? 1 : 0.4 }}>
            {posting ? 'Posting…' : 'Post'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

/** Composer in a slide-up modal — opened by the tab bar's + button. */
export function PostComposerModal({
  visible,
  onClose,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: (post: Post) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modals get their own window on iOS — nested provider for insets. */}
      <SafeAreaProvider>
        <ThemedView style={styles.modal}>
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <View style={styles.modalTopBar}>
              <ThemedText type="linkPrimary" onPress={onClose}>
                Cancel
              </ThemedText>
            </View>
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <PostComposer
                onPosted={(post) => {
                  onPosted(post);
                  onClose();
                }}
              />
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    fontSize: 16,
    minHeight: 44,
    maxHeight: 160,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  preview: { width: 88, height: 88, borderRadius: Spacing.two },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  modal: { flex: 1 },
  modalSafe: { flex: 1, paddingHorizontal: Spacing.three },
  modalTopBar: { paddingVertical: Spacing.two },
  flex: { flex: 1 },
});
