import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalDocument } from '@/components/legal-document';
import { getEffectiveDate, getLegalDoc, MINIMUM_AGE } from '@/constants/legal';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';

const BAKERY_BG = require('@/assets/images/backgrounds/bakery-menu.png');

// Patisserie palette — mirrors the Bakery Menu / Companion Bakery screens.
const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  shortbread: '#E7CBB3',
} as const;

// Note: the legal DOCUMENT bodies are localized per app language via
// getLegalDoc() (English is authoritative), same as the surrounding gate chrome.

// Shared bakery shell: cream background with a big bubbly title (no banner frame).
function MenuShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ImageBackground source={BAKERY_BG} resizeMode="cover" style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {children}
      </SafeAreaView>
    </ImageBackground>
  );
}

// First-launch consent, shown over the app for any new account or new guest
// (anyone whose saved state has not yet recorded legalAccepted). Two steps on
// separate screens: (1) read & accept the Privacy Policy + Terms, then
// (2) affirm they meet MINIMUM_AGE.
//
// Step 2 collects NO date of birth — it is a neutral yes/no affirmation and
// nothing is stored beyond `legalAccepted`. App Review rejected the old
// date-of-birth wheel under guideline 5.1.1(v) (personal information that isn't
// necessary for the app to function); the age minimum is still enforced, just
// without asking for a birth date. The birthday that drives the yearly reward is
// a separate, OPTIONAL month/day the player can add later in Settings.
export function LegalConsentGate({ onAgree }: { onAgree: () => void }) {
  const { t, i18n } = useTranslation();
  const doc = getLegalDoc(i18n.language);
  const [step, setStep] = useState<'legal' | 'age'>('legal');

  // --- Step 1: legal documents ---
  // Require the user to scroll to the bottom before Continue enables. Track the
  // viewport and content heights so that if everything already fits on screen
  // (e.g. a large tablet), Continue is enabled immediately.
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const fitsOnScreen = viewH > 0 && contentH > 0 && contentH <= viewH;
  const scrolledEnough = reachedEnd || fitsOnScreen;

  // --- Step 2: age affirmation (no data collected) ---
  const [confirmed, setConfirmed] = useState(false);
  const ready = confirmed;

  if (step === 'legal') {
    return (
      <View style={styles.overlay}>
        <MenuShell title={t('consent.beforeStart')}>
          <Text style={styles.subtitle}>
            {t('consent.readPolicies')}
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            onLayout={({ nativeEvent }) => setViewH(nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContentH(h)}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
                setReachedEnd(true);
              }
            }}>
            <LegalDocument heading={t('consent.privacyPolicy')} sections={doc.privacy} />
            <View style={styles.divider} />
            <LegalDocument heading={t('consent.termsOfService')} sections={doc.terms} />
            <Text style={styles.effective}>{t('consent.effective', { date: getEffectiveDate(i18n.language) })}</Text>
          </ScrollView>

          <Pressable
            disabled={!scrolledEnough}
            onPress={() => setStep('age')}
            style={({ pressed }) => [
              styles.agreeBtn,
              !scrolledEnough && styles.agreeBtnDisabled,
              pressed && scrolledEnough && styles.pressed,
            ]}>
            <Text style={styles.agreeBtnText}>
              {scrolledEnough ? t('consent.agreeContinue') : t('consent.scrollToContinue')}
            </Text>
          </Pressable>
        </MenuShell>
      </View>
    );
  }

  // Step 2: age affirmation — a yes/no confirmation, NOT a date of birth.
  return (
    <View style={styles.overlay}>
      <MenuShell title={t('consent.oneLastThing')}>
        {/* Scrollable so the Agree button below stays reachable on small screens. */}
        <ScrollView style={styles.ageScroll} contentContainerStyle={styles.ageScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.ageCard}>
            <Text style={styles.fieldLabel}>{t('consent.minAge', { age: MINIMUM_AGE })}</Text>

            <Pressable style={styles.checkRow} onPress={() => setConfirmed((v) => !v)} hitSlop={6}>
              <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
                {confirmed && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{t('consent.confirmAge', { age: MINIMUM_AGE })}</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footerBtns}>
          <Pressable onPress={() => setStep('legal')} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </Pressable>
          <Pressable
            disabled={!ready}
            onPress={() => onAgree()}
            style={({ pressed }) => [
              styles.agreeBtn,
              styles.agreeBtnGrow,
              !ready && styles.agreeBtnDisabled,
              pressed && ready && styles.pressed,
            ]}>
            <Text style={styles.agreeBtnText}>{t('consent.agreeAndContinue')}</Text>
          </Pressable>
        </View>
      </MenuShell>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },

  // Big bubbly title, no banner frame.
  headerRow: { width: '100%', alignItems: 'center', marginTop: Spacing.four, marginBottom: Spacing.three },
  headerTitle: { fontFamily: Fonts.rounded, fontSize: 34, fontWeight: '900', color: P.brown, letterSpacing: 0.3, textAlign: 'center' },

  subtitle: { fontSize: 13, color: P.mutedBrown, fontWeight: '600', textAlign: 'center', lineHeight: 18, marginBottom: Spacing.two },

  scroll: {
    flex: 1,
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: P.pinkSoft,
  },
  scrollContent: { padding: Spacing.three, gap: 16 },
  divider: { height: 1, backgroundColor: P.pinkSoft, marginVertical: 4 },
  effective: { fontSize: 11, color: P.mutedBrown, fontStyle: 'italic', marginTop: 4 },

  // Age step — a single bakery card holding the wheel + confirmation.
  ageCard: {
    backgroundColor: P.card,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.four,
    gap: 18,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fieldLabel: { fontSize: 15, fontWeight: '700', color: P.brown, textAlign: 'center', lineHeight: 21 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: P.shortbread,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: P.pink, borderColor: P.pink },
  checkboxMark: { fontSize: 13, color: '#fff', fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 13.5, color: P.mutedBrown, lineHeight: 19 },

  ageScroll: { flex: 1 },
  // Center the birthday card vertically in the space between the title and footer.
  ageScrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: Spacing.two },
  footerBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.three },
  backBtn: {
    paddingVertical: 15, paddingHorizontal: 20, borderRadius: 999,
    backgroundColor: P.card, borderWidth: 2, borderColor: P.pinkSoft,
  },
  backBtnText: { fontSize: 15, fontWeight: '800', color: P.mutedBrown },

  agreeBtn: {
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.three,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  agreeBtnGrow: { flex: 1, marginTop: 0 },
  agreeBtnDisabled: { backgroundColor: P.shortbread, shadowOpacity: 0 },
  agreeBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  pressed: { opacity: 0.88 },
});
