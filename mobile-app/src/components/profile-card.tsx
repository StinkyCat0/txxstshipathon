/**
 * ProfileCard: full-bleed photo with a name/age/bio overlay.
 * Used by the sign-in carousel; tap to select the profile.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { mediaUrl, type UserSummary } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

/** Anything with the card fields — UserSummary (sign-in) or Profile (deck). */
type CardProfile = Pick<UserSummary, 'id' | 'name' | 'age' | 'bio'> & {
  photo?: string | null;
  photos?: string[];
};

export function ProfileCard({
  user,
  onPress,
  fill = false,
}: {
  user: CardProfile;
  onPress?: () => void;
  /** Fill the parent instead of the fixed 3:4 portrait ratio. */
  fill?: boolean;
}) {
  const theme = useTheme();
  const photo = mediaUrl(user.photo ?? user.photos?.[0]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        fill ? styles.cardFill : styles.cardPortrait,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.85 },
      ]}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <ThemedText type="title" themeColor="textSecondary">
            {user.name.charAt(0)}
          </ThemedText>
        </View>
      )}
      {/* Bottom gradient keeps overlay text readable on any photo. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        locations={[0.4, 1]}
        style={styles.gradient}
      />
      <View style={styles.overlay}>
        <ThemedText type="subtitle" style={styles.name}>
          {user.name}, {user.age}
        </ThemedText>
        {!!user.bio && (
          <ThemedText numberOfLines={2} style={styles.bio}>
            {user.bio}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardPortrait: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cardFill: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    gap: Spacing.half,
  },
  name: { color: '#fff' },
  bio: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 20 },
});
