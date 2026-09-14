/**
 * Sign-in: dev user-switcher. Lists seeded users; tapping one signs in.
 * A "Create account" form posts a new user and signs in as them.
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api, mediaUrl, type UserSummary } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((e) => setError(String(e)));
  }, []);

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
              <ThemedText type="title">PUBLIC</ThemedText>
              <ThemedText themeColor="textSecondary">dating, but everyone can see</ThemedText>
            </View>

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {users === null && !error ? (
              <ActivityIndicator style={styles.loading} />
            ) : (
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

            <Pressable
              onPress={() => setCreating((c) => !c)}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: theme.backgroundElement },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="smallBold">Create account</ThemedText>
            </Pressable>

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
  error: { color: '#d33' },
  loading: { marginVertical: Spacing.four },
  list: { gap: Spacing.two },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#888' },
  createButton: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
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
