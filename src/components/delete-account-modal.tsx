import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;

/**
 * Type-to-confirm account deletion. The Delete button stays disabled until the
 * typed text matches the user's display name (case-insensitive) — or the literal
 * word DELETE when the account has no name (e.g. a guest).
 */
export function DeleteAccountModal({
  visible,
  displayName,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  displayName?: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  // What the user must type. A trimmed, non-empty display name is the target;
  // otherwise fall back to the unambiguous keyword.
  const target = (displayName ?? '').trim();
  const expected = target.length > 0 ? target : 'DELETE';
  const matches = typed.trim().toLowerCase() === expected.toLowerCase();

  const close = () => {
    if (busy) return;
    setTyped('');
    onClose();
  };

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setTyped('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('deleteAccount.title', { defaultValue: 'Delete account?' })}</Text>
          <Text style={styles.body}>
            {t('deleteAccount.warning', {
              defaultValue:
                'This permanently erases your account and ALL your data — coins, recipes, companions, friends and progress. This cannot be undone.',
            })}
          </Text>
          <Text style={styles.prompt}>
            {t('deleteAccount.typePrompt', { name: expected, defaultValue: `Type “${expected}” to confirm.` })}
          </Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={expected}
            placeholderTextColor={C.latte}
            editable={!busy}
          />
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, (!matches || busy) && styles.deleteBtnDisabled, pressed && matches && !busy && styles.pressed]}
            onPress={confirm}
            disabled={!matches || busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteText}>{t('deleteAccount.confirm', { defaultValue: 'Delete forever' })}</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancel} onPress={close} disabled={busy}>
            <Text style={styles.cancelText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(360), backgroundColor: C.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: '#E8A0A0',
    padding: Spacing.four, gap: Spacing.two, ...BakeryShadow,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#C0392B', textAlign: 'center' },
  body: { fontSize: 13.5, color: C.cocoaDark, lineHeight: 19, textAlign: 'center' },
  prompt: { fontSize: 13, fontWeight: '700', color: C.mocha, textAlign: 'center', marginTop: Spacing.one },
  input: {
    backgroundColor: '#fff', borderRadius: BakeryRadii.button, borderWidth: 1.5, borderColor: C.shortbread,
    paddingHorizontal: Spacing.three, paddingVertical: 11, fontSize: 15, color: C.cocoaDark,
  },
  deleteBtn: { paddingVertical: 14, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: '#D0392B', marginTop: Spacing.one },
  deleteBtnDisabled: { backgroundColor: '#E3B6B0' },
  deleteText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.one },
  cancelText: { fontSize: 14, fontWeight: '800', color: C.mocha },
  pressed: { opacity: 0.85 },
});
