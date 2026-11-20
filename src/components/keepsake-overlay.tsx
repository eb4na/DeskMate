import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FitText } from '@/components/fit-text';
import { Envelope, PaperNote } from '@/components/paper-note';
import { ThemedText } from '@/components/themed-text';
import { BakeryColors } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { awayEntry, letterText } from '@/lib/companion-voice';
import type { Keepsake } from '@/lib/companion-moments';

/** Short localized month + day for a keepsake's YYYY-MM-DD (no timezone shift). */
export function formatKeepsakeDate(dateISO: string, lang: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return '';
  try {
    return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
  } catch {
    return dateISO;
  }
}

/**
 * Absolute-fill overlay (not a Modal): sealed envelope, tap to open, then the
 * handwritten note on lined paper. Mount it inside a Modal or inline.
 */
export function KeepsakeOverlay({
  keepsake,
  companionName,
  onClose,
}: {
  keepsake: Keepsake;
  companionName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('companion');
  const { language, markKeepsakeSeen } = useApp();
  const isTablet = useIsTablet();
  const { width: winW } = useWindowDimensions();
  const [opened, setOpened] = useState(false);
  const seenRef = useRef(false);

  const text =
    keepsake.kind === 'letter'
      ? letterText(keepsake.persona, keepsake.level ?? 0)
      : awayEntry(keepsake.persona, keepsake.contentId)?.text;

  const open = () => {
    setOpened(true);
    if (!seenRef.current) {
      seenRef.current = true;
      markKeepsakeSeen(keepsake.id);
    }
  };

  // A keepsake with no resolvable text has nothing to open: close instead of showing an empty page.
  useEffect(() => {
    if (!text) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  if (!text) return null;

  const cardW = Math.min(isTablet ? 520 : 358, winW - 32);
  const envW = Math.min(isTablet ? 420 : 270, winW - 64);
  const titleKey = keepsake.kind === 'letter' ? 'ui.fromLetter' : keepsake.kind === 'story' ? 'ui.fromStory' : 'ui.fromNote';

  return (
    <View style={styles.backdrop}>
      {opened ? (
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <FitText type="subtitle" style={styles.title} numberOfLines={2}>
              {t(titleKey, { name: companionName })}
            </FitText>
            <ThemedText style={styles.date}>{formatKeepsakeDate(keepsake.dateISO, language)}</ThemedText>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <PaperNote
              text={text}
              signature={t('ui.signature', { name: companionName })}
              lang={language}
              width={cardW - 36}
            />
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ui.done')}
            onPress={onClose}
            style={styles.done}
          >
            <FitText style={styles.doneText} numberOfLines={1}>
              {t('ui.done')}
            </FitText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sealedWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('ui.tapToOpen')} onPress={open} style={styles.env}>
            <Envelope width={envW} sealed />
          </Pressable>
          {/* Plain Text: FitText shrinks to its minimum scale in an auto-width pill
              (no fixed box to fit), which rendered this label tiny on device. */}
          <View style={styles.pill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.pillText} numberOfLines={1}>
              {t('ui.tapToOpen')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const INK = '#5D3C2E';

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(60,38,30,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sealedWrap: { alignItems: 'center', gap: 16 },
  env: {
    shadowColor: '#281812',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  pill: { backgroundColor: '#FFFDF8', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  pillText: { color: INK, fontSize: 15, fontWeight: '800' },
  card: {
    maxHeight: '88%',
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 16,
    alignItems: 'center',
  },
  head: { alignItems: 'center', gap: 2, alignSelf: 'stretch' },
  title: { color: INK, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  date: { color: '#8A6A5C', fontSize: 13, fontWeight: '700' },
  scroll: { alignSelf: 'stretch', flexShrink: 1 },
  scrollContent: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  done: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: BakeryColors.buttonPink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  doneText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
});
