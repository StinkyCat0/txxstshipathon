/**
 * Sign-in: auto-advancing carousel of profile cards; tapping one signs in.
 * "Log in" reveals the user picker; "Create account" posts a new user.
 */
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileCard } from '@/components/profile-card';
import { Wordmark } from '@/components/wordmark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { api, mediaUrl, type UserSummary } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTheme } from '@/hooks/use-theme';

const AUTO_ADVANCE_MS = 3500;

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');

  // Carousel state: measured width, current page, touch-pause flag.
  const listRef = useRef<FlatList<UserSummary>>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const pageRef = useRef(0);
  const holding = useRef(false);

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((e) => setError(String(e)));
  }, []);

  // Auto-advance while the user isn't touching the carousel.
  useEffect(() => {
    const count = users?.length ?? 0;
    if (count < 2 || cardWidth === 0) return;
    const timer = setInterval(() => {
      if (holding.current) return;
      const next = pageRef.current + 1;
      if (next < count) {
        listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
      } else {
        // Wrap: jump back to the first card without a rewind animation.
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [users, cardWidth]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    pageRef.current = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
  };

  const submitCreate = async () => {
    const ageNum = Number(age);
    if (!name.trim() || !Number.isFinite(ageNum) || ageNum <= 0) {
      setError('Name and a valid age are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.createUser({
        name: name.trim(),
        age: ageNum,
        bio: bio.trim() || undefined,
        gender: gender.trim() || undefined,
        interested_in: interestedIn.trim() || undefined,
      });
      signIn(res.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Wordmark width={160} />
              <ThemedText themeColor="textSecondary">dating, but everyone can see</ThemedText>
            </View>

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {users === null && !error ? (
              <ActivityIndicator style={styles.loading} />
            ) : (
              <View
                onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
                style={styles.carousel}>
                {cardWidth > 0 && (
                  <FlatList
                    ref={listRef}
                    data={users ?? []}
                    keyExtractor={(u) => String(u.id)}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={32}
                    onScrollBeginDrag={() => (holding.current = true)}
                    onMomentumScrollEnd={() => (holding.current = false)}
                    renderItem={({ item }) => (
                      <View style={{ width: cardWidth }}>
                        <ProfileCard user={item} onPress={() => signIn(item.id)} />
                      </View>
                    )}
                  />
                )}
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  setLoggingIn((v) => !v);
                  setCreating(false);
                }}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.backgroundElement },
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="smallBold">Log in</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCreating((c) => !c);
                  setLoggingIn(false);
                }}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.accentSoft },
                  pressed && { opacity: 0.8 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  ♥ Create account
                </ThemedText>
              </Pressable>
            </View>

            {loggingIn && (
              <FlatList
                data={users ?? []}
                keyExtractor={(u) => String(u.id)}
                scrollEnabled={false}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => signIn(item.id)}
                    style={({ pressed }) => [
                      styles.userRow,
                      { backgroundColor: theme.backgroundElement },
                      pressed && { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <Image
                      source={{ uri: mediaUrl(item.photo) }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <ThemedText>
                      {item.name}, {item.age}
                    </ThemedText>
                  </Pressable>
                )}
              />
            )}

            {creating && (
              <ThemedView type="backgroundElement" style={styles.form}>
                <TextInput
                  placeholder="Name"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                  style={inputStyle}
                />
                <TextInput
                  placeholder="Age"
                  placeholderTextColor={theme.textSecondary}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
                <TextInput
                  placeholder="Bio"
                  placeholderTextColor={theme.textSecondary}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  style={[inputStyle, styles.multiline]}
                />
                <TextInput
                  placeholder="Gender"
                  placeholderTextColor={theme.textSecondary}
                  value={gender}
                  onChangeText={setGender}
                  style={inputStyle}
                />
                <TextInput
                  placeholder="Interested in"
                  placeholderTextColor={theme.textSecondary}
                  value={interestedIn}
                  onChangeText={setInterestedIn}
                  style={inputStyle}
                />
                <Pressable
                  onPress={submitCreate}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: theme.text },
                    (pressed || busy) && { opacity: 0.6 },
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.background }}>
                      Sign up
                    </ThemedText>
                  )}
                </Pressable>
              </ThemedView>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  // Placeholder wordmark: serif italic until a real brand font is picked.
  brand: { fontFamily: Fonts.serif, fontStyle: 'italic' },
  error: { color: '#d33' },
  loading: { marginVertical: Spacing.four },
  carousel: { marginHorizontal: Spacing.three },
  buttonRow: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 999,
  },
  list: { gap: Spacing.two },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#888' },
  form: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  input: { borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  submitButton: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.one,
  },
});
