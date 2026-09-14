/**
 * You tab: own profile preview (ProfileView) plus compact editing —
 * basics, photos, and 3 prompt slots — and sign out.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, mediaUrl, type Profile, type PromptAnswer } from '@/lib/api';
import { PROMPT_CHOICES, promptLabel } from '@/lib/prompts';
import { useSession } from '@/lib/session';

const PROMPT_SLOTS = 3;

export default function ProfileScreen() {
  const { userId, signOut } = useSession();
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [prompts, setPrompts] = useState<PromptAnswer[]>([]);
  const [saving, setSaving] = useState(false);

  const hydrate = (p: Profile) => {
    setProfile(p);
    setName(p.name);
    setAge(String(p.age));
    setBio(p.bio);
    setPrompts(
      Array.from(
        { length: PROMPT_SLOTS },
        (_, i) => p.prompts[i] ?? { prompt_key: PROMPT_CHOICES[i].key, answer: '' },
      ),
    );
  };

  const load = useCallback(async () => {
    if (userId === null || userId === 0) return;
    try {
      hydrate(await api.getProfile(userId));
    } catch {
      // keep stale profile on failure
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveBasics = async () => {
    if (userId === null || userId === 0) return;
    setSaving(true);
    try {
      const patch: Parameters<typeof api.updateUser>[1] = { name, bio };
      const ageNum = parseInt(age, 10);
      if (!Number.isNaN(ageNum)) patch.age = ageNum;
      setProfile(await api.updateUser(userId, patch));
    } catch {
      // ignore; user can retry
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = async () => {
    if (userId === null || userId === 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    try {
      await api.uploadPhoto(userId, asset.uri, { fileName: asset.fileName, mimeType: asset.mimeType });
      await load();
    } catch (e) {
      Alert.alert('Upload failed', String(e));
    }
  };

  const savePrompts = async () => {
    if (userId === null || userId === 0) return;
    setSaving(true);
    try {
      const filled = prompts.filter((p) => p.answer.trim().length > 0);
      setProfile(await api.setPrompts(userId, filled));
    } catch {
      // ignore; user can retry
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {profile && <ProfileView profile={profile} />}

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Edit profile
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Name
            </ThemedText>
            <TextInput style={inputStyle} value={name} onChangeText={setName} />
            <ThemedText type="small" themeColor="textSecondary">
              Age
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            <ThemedText type="small" themeColor="textSecondary">
              Bio
            </ThemedText>
            <TextInput
              style={[inputStyle, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              multiline
            />
            <Pressable onPress={saveBasics} disabled={saving}>
              <ThemedText type="linkPrimary">{saving ? 'Saving…' : 'Save basics'}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Photos
            </ThemedText>
            <View style={styles.photoRow}>
              {(profile?.photos ?? []).map((p) => (
                <Image key={p} source={{ uri: mediaUrl(p) }} style={styles.photoThumb} />
              ))}
              <Pressable
                onPress={addPhoto}
                style={[styles.addPhoto, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText themeColor="textSecondary">+</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Prompts
            </ThemedText>
            {prompts.map((slot, i) => (
              <View key={i} style={styles.promptSlot}>
                <View style={styles.chips}>
                  {PROMPT_CHOICES.map((choice) => (
                    <Pressable
                      key={choice.key}
                      onPress={() =>
                        setPrompts((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, prompt_key: choice.key } : p)),
                        )
                      }>
                      <ThemedView
                        type={
                          slot.prompt_key === choice.key ? 'backgroundSelected' : 'backgroundElement'
                        }
                        style={styles.chip}>
                        <ThemedText type="small">{choice.label}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={inputStyle}
                  value={slot.answer}
                  onChangeText={(text) =>
                    setPrompts((prev) => prev.map((p, j) => (j === i ? { ...p, answer: text } : p)))
                  }
                  placeholder={`${promptLabel(slot.prompt_key)}…`}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            ))}
            <Pressable onPress={savePrompts} disabled={saving}>
              <ThemedText type="linkPrimary">{saving ? 'Saving…' : 'Save prompts'}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.signOut}>
            <Pressable onPress={signOut}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Signing out returns to the user picker — switch user from there.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: { fontSize: 24, lineHeight: 30 },
  fieldGroup: { gap: Spacing.two },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  bioInput: { minHeight: 72, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photoThumb: { width: 72, height: 96, borderRadius: Spacing.two },
  addPhoto: {
    width: 72,
    height: 96,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptSlot: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  signOut: { gap: Spacing.one, alignItems: 'flex-start' },
});
