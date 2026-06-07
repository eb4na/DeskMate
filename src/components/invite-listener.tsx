/**
 * App-wide listener: shows a popup when a friend invites you to a minigame.
 * Mounted once in the root navigator so it works on any screen.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { getCompanionImage } from '@/lib/companion-utils';
import { joinPresence, subscribeToInvites, type GameInvite, type OnlineGameId } from '@/lib/game-net';

const GAME_LABEL: Record<OnlineGameId, string> = {
  connect4: 'Connect 4',
  tictactoe: 'Tic-Tac-Toe',
  memory: 'Memory Cards',
  batterdash: 'a BatterDash race',
};

export function InviteListener() {
  const { friendCode, friends } = useApp();
  const [invite, setInvite] = useState<GameInvite | null>(null);

  useEffect(() => {
    if (!friendCode) return;
    return subscribeToInvites(friendCode, (inv) => setInvite(inv));
  }, [friendCode]);

  // Mark this user online app-wide while Memobun is open.
  useEffect(() => {
    if (!friendCode) return;
    return joinPresence(friendCode);
  }, [friendCode]);

  const fromFriend = friends.find((f) => f.code === invite?.fromCode);

  const accept = () => {
    if (!invite) return;
    const inv = invite;
    setInvite(null);
    if (inv.game === 'batterdash') {
      router.push({ pathname: '/cake-game', params: { room: inv.room, role: 'guest', netmode: 'race' } });
    } else {
      router.push({ pathname: '/break-game', params: { game: inv.game, room: inv.room, role: 'guest' } });
    }
  };

  return (
    <Modal visible={!!invite} transparent animationType="fade" onRequestClose={() => setInvite(null)}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => setInvite(null)} />
        <View style={styles.card}>
          <View style={styles.avatar}>
            {fromFriend?.companionId !== undefined ? (
              <Image
                source={getCompanionImage(fromFriend.companionId, fromFriend.skinId)}
                style={styles.avatarImg}
                contentFit="contain"
              />
            ) : (
              <Text style={styles.avatarText}>{(invite?.fromName?.[0] ?? '?').toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.title}>{invite?.fromName || 'A friend'} invited you!</Text>
          <Text style={styles.subtitle}>
            Play {invite ? GAME_LABEL[invite.game] : 'a game'} together?
          </Text>
          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]} onPress={() => setInvite(null)}>
              <Text style={styles.declineText}>Later</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]} onPress={accept}>
              <Text style={styles.acceptText}>Join</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const P = { card: '#FFFDF8', pink: '#F7A7B8', pinkSoft: '#FBD9E0', brown: '#5B3A2E', muted: '#9A7B6D' };

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.4)' },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: P.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: P.pinkSoft,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  avatarImg: { position: 'absolute', width: 104, height: 104, left: -20, top: -4 },
  avatarText: { fontSize: 26, fontWeight: '900', color: P.brown },
  title: { fontSize: 17, fontWeight: '900', color: P.brown, textAlign: 'center' },
  subtitle: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  declineBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#EFE6DA', alignItems: 'center' },
  declineText: { color: P.brown, fontWeight: '800', fontSize: 15 },
  acceptBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: P.pink, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.85 },
});
