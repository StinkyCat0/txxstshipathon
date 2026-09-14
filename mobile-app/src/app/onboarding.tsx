/**
 * Onboarding: required profile setup before the tabs unlock.
 * Single scrollable screen — basics, photos, and 3 prompt slots.
 * "Start swiping" gates on >=1 photo and >=2 answered prompts (local check).
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api, mediaUrl, type Profile } from '@/lib/api';
import { PROMPT_CHOICES } from '@/lib/prompts';
import { useSession } from '@/lib/session';
import { useTheme } from '@/hooks/use-theme';

const PROMPT_SLOTS = 3;

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { userId } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [slots, setSlots] = useState<{ key: string | null; answer: string }[]>(
    Array.from({ length: PROMPT_SLOTS }, () => ({ key: null, answer: '' })),
  );

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await api.getProfile(userId);
      setProfile(p);
      setName(p.name);
      setAge(String(p.age));
      setBio(p.bio);
      setGender(p.gender);
      setInterestedIn(p.interested_in);
      setSlots(
        Array.from({ length: PROMPT_SLOTS }, (_, i) => ({
          key: p.prompts[i]?.prompt_key ?? null,
          answer: p.prompts[i]?.answer ?? '',
        })),
      );
    } catch (e) {
      setError(String(e));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBasics = async () => {
    if (!userId) return;
    const ageNum = Number(age);
    setSaving(true);
    setError(null);
    try {
      const p = await api.updateUser(userId, {
        name: name.trim(),
        age: Number.isFinite(ageNum) ? ageNum : 0,
        bio: bio.trim(),
        gender: gender.trim(),
        interested_in: interestedIn.trim(),
      });
      setProfile(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadPhoto(userId, asset.uri, { fileName: asset.fileName, mimeType: asset.mimeType });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const savePrompts = async (next = slots) => {
    if (!userId) return;
    const prompts = next
      .filter((s) => s.key && s.answer.trim())
      .map((s) => ({ prompt_key: s.key!, answer: s.answer.trim() }));
    setError(null);
    try {
      const p = await api.setPrompts(userId, prompts);
      setProfile(p);
    } catch (e) {
      setError(String(e));
    }
  };

  const setSlot = (i: number, patch: Partial<{ key: string | null; answer: string }>) => {
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  const cyclePrompt = (i: number) => {
    const current = slots[i].key;
    const idx = PROMPT_CHOICES.findIndex((c) => c.key === current);
    const next = PROMPT_CHOICES[(idx + 1) % PROMPT_CHOICES.length];
    const nextSlots = slots.map((s, j) => (j === i ? { ...s, key: next.key } : s));
    setSlots(nextSlots);
    if (nextSlots[i].answer.trim()) savePrompts(nextSlots);
  };

  const photoCount = profile?.photos.length ?? 0;
  const answered = slots.filter((s) => s.key && s.answer.trim()).length;
  const ready = photoCount >= 1 && answered >= 2;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  if (!profile && !error) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Set up your profile</ThemedText>
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {/* Basics */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                BASICS
              </ThemedText>
              <TextInput
                placeholder="Name"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
                onBlur={saveBasics}
                style={inputStyle}
              />
              <TextInput
                placeholder="Age"
                placeholderTextColor={theme.textSecondary}
                value={age}
                onChangeText={setAge}
                onBlur={saveBasics}
                keyboardType="number-pad"
                style={inputStyle}
              />
              <TextInput
                placeholder="Bio"
                placeholderTextColor={theme.textSecondary}
                value={bio}
                onChangeText={setBio}
                onBlur={saveBasics}
                multiline
                style={[inputStyle, styles.multiline]}
              />
              <TextInput
                placeholder="Gender"
                placeholderTextColor={theme.textSecondary}
                value={gender}
                onChangeText={setGender}
                onBlur={saveBasics}
                style={inputStyle}
              />
              <TextInput
                placeholder="Interested in"
                placeholderTextColor={theme.textSecondary}
                value={interestedIn}
                onChangeText={setInterestedIn}
                onBlur={saveBasics}
                style={inputStyle}
              />
              <Pressable
                onPress={saveBasics}
                disabled={saving}
                style={({ pressed }) => [
                  styles.smallButton,
                  { backgroundColor: theme.backgroundElement },
                  (pressed || saving) && { opacity: 0.6 },
                ]}>
                <ThemedText type="smallBold">{saving ? 'Saving…' : 'Save basics'}</ThemedText>
              </Pressable>
            </View>

            {/* Photos */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                PHOTOS
              </ThemedText>
              <ScrollView horizontal contentContainerStyle={styles.photoRow}>
                {(profile?.photos ?? []).map((p, i) => (
                  <Image
                    key={`${p}-${i}`}
                    source={{ uri: mediaUrl(p) }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                ))}
                <Pressable
                  onPress={addPhoto}
                  disabled={uploading}
                  style={({ pressed }) => [
                    styles.addPhoto,
                    { backgroundColor: theme.backgroundElement },
                    pressed && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  {uploading ? <ActivityIndicator /> : <ThemedText>+ Add photo</ThemedText>}
                </Pressable>
              </ScrollView>
            </View>

            {/* Prompts */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                PROMPTS
              </ThemedText>
              {slots.map((slot, i) => (
                <ThemedView key={i} type="backgroundElement" style={styles.promptCard}>
                  <Pressable onPress={() => cyclePrompt(i)}>
                    <ThemedText type="smallBold" themeColor={slot.key ? 'text' : 'textSecondary'}>
                      {slot.key
                        ? PROMPT_CHOICES.find((c) => c.key === slot.key)?.label
                        : 'Tap to pick a prompt'}
                    </ThemedText>
                  </Pressable>
                  <TextInput
                    placeholder="Your answer…"
                    placeholderTextColor={theme.textSecondary}
                    value={slot.answer}
                    onChangeText={(t) => setSlot(i, { answer: t })}
                    onBlur={() => savePrompts()}
                    multiline
                    style={[inputStyle, styles.multiline, styles.promptInput]}
                  />
                </ThemedView>
              ))}
            </View>

            <Pressable
              onPress={ready ? onDone : undefined}
              disabled={!ready}
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: ready ? theme.text : theme.backgroundElement },
                pressed && ready && { opacity: 0.7 },
              ]}>
              <ThemedText
                type="smallBold"
                style={ready ? { color: theme.background } : undefined}
                themeColor={ready ? undefined : 'textSecondary'}>
                Start swiping
              </ThemedText>
            </Pressable>
            {!ready && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Add at least 1 photo and answer 2 prompts to continue (
                {photoCount >= 1 ? '✓' : '·'} photo, {answered}/2 prompts)
              </ThemedText>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  error: { color: '#d33' },
  section: { gap: Spacing.two },
  input: { borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  smallButton: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  photoRow: { gap: Spacing.two, alignItems: 'center' },
  photo: { width: 120, height: 160, borderRadius: Spacing.two },
  addPhoto: {
    width: 120,
    height: 160,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  promptInput: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  doneButton: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  hint: { textAlign: 'center', marginTop: -Spacing.two },
});
