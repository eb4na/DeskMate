import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  button: '#8A7A60',
} as const;

export default function FriendsScreen() {
  const { friendCode, friends, addFriend, removeFriend } = useApp();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const res = addFriend(input);
    if (res.ok) {
      setInput('');
    } else {
      Alert.alert('Could not add friend', res.error ?? 'Try again.');
    }
  };

  const shareCode = async () => {
    try {
      await Share.share({ message: `Add me on Memobun! My friend code is ${friendCode} 🍓` });
    } catch {
      Alert.alert('Your friend code', friendCode);
    }
  };

  const confirmRemove = (code: string, name: string) => {
    Alert.alert('Remove friend?', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(code) },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>🍓 Study Friends</Text>
            <Text style={styles.headerSubtitle}>Add friends and study together</Text>
          </View>

          {/* Your code */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Friend Code</Text>
            <Pressable style={({ pressed }) => [styles.codeCard, pressed && styles.pressed]} onPress={shareCode}>
              <Text style={styles.codeText}>{friendCode}</Text>
              <View style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>Share</Text>
              </View>
            </Pressable>
            <Text style={styles.codeHint}>Share this code so friends can add you.</Text>
          </View>

          {/* Add a friend */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add a Friend</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={input}
                onChangeText={(v) => setInput(v.toUpperCase())}
                placeholder="Enter friend code"
                placeholderTextColor={P.mutedBrown}
                autoCapitalize="characters"
                maxLength={6}
              />
              <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} onPress={handleAdd}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>

          {/* Friends list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Friends ({friends.length})</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🧁</Text>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Add a friend with their code to get started.</Text>
              </View>
            ) : (
              <View style={styles.friendList}>
                {friends.map((f) => (
                  <View key={f.code} style={styles.friendRow}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>🐱</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendCode}>{f.code}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => confirmRemove(f.code, f.name)} style={styles.friendRemove}>
                      <Text style={styles.friendRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              🧁 Friends are saved on this device for now — cloud sync between phones is coming soon.
            </Text>
          </View>

          {/* Done */}
          <Pressable style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: P.cream,
  },
  headerPanel: {
    backgroundColor: P.card,
    borderRadius: 26,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: P.brown, letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, color: P.mutedBrown, fontWeight: '500' },

  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown },

  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  codeText: { fontSize: 26, fontWeight: '900', letterSpacing: 4, color: P.brown },
  copyBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  codeHint: { fontSize: 12, color: P.mutedBrown, textAlign: 'center' },

  addRow: { flexDirection: 'row', gap: Spacing.two },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: P.peach,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: P.brown,
    backgroundColor: P.card,
  },
  addBtn: {
    backgroundColor: P.pink,
    borderRadius: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  friendList: { gap: Spacing.two },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    padding: Spacing.two,
  },
  friendAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: P.pinkSoft, alignItems: 'center', justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 22 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '800', color: P.brown },
  friendCode: { fontSize: 12, color: P.mutedBrown, letterSpacing: 1 },
  friendRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  friendRemoveText: { fontSize: 14, color: P.mutedBrown, fontWeight: '700' },

  emptyCard: {
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: P.brown },
  emptyText: { fontSize: 13, color: P.mutedBrown, textAlign: 'center' },

  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: { fontSize: 12.5, color: P.brown, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  doneButton: {
    backgroundColor: P.button,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  pressed: { opacity: 0.85 },
});
