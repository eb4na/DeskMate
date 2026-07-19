/**
 * Full-screen "your opponent left" card for the 1v1 break games (Connect 4,
 * Tic-Tac-Toe). When the other player leaves an online match, presence drops and
 * the game shows this over the board so the remaining player isn't stranded on a
 * frozen board — its only action is Leave, which exits the game.
 *
 * Deliberately a plain in-screen overlay (absolute View), NOT a native Modal:
 * these games can already sit under a presented sheet, and stacking a native
 * modal there fails silently on iOS. An always-rendered overlay is safe.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function OpponentLeftOverlay({
  visible,
  title,
  buttonLabel,
  onLeave,
}: {
  visible: boolean;
  title: string;
  buttonLabel: string;
  onLeave?: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => onLeave?.()}>
          <Text style={styles.btnText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(60,40,32,0.28)',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFDF8',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#5B3A2E', textAlign: 'center', lineHeight: 24 },
  btn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#F2A0B5',
    borderRadius: 16,
    paddingVertical: 13,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.85 },
});
