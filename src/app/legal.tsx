import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalDocument } from '@/components/legal-document';
import {
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from '@/constants/legal';
import { BakeryColors, Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';

// Read-only viewer for the Privacy Policy + Terms of Service, opened from
// Settings so the documents stay available after the first-launch consent.
// The document bodies stay in English; only the surrounding chrome is localized.
export default function LegalScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
            <Text style={styles.closeText}>{t('common.done')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('consent.privacyTermsTitle')}</Text>
          <View style={styles.close} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <LegalDocument heading={t('consent.privacyPolicy')} sections={PRIVACY_POLICY} />
          <View style={styles.divider} />
          <LegalDocument heading={t('consent.termsOfService')} sections={TERMS_OF_SERVICE} />
          <Text style={styles.effective}>{t('consent.effective', { date: LEGAL_EFFECTIVE_DATE })}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BakeryColors.frosting },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  close: { minWidth: 52 },
  closeText: { fontSize: 15, fontWeight: '700', color: BakeryColors.jam },
  title: { fontSize: 17, fontWeight: '800', color: BakeryColors.cocoaDark },
  content: { padding: Spacing.three, gap: 16 },
  divider: { height: 1, backgroundColor: '#F0D7DD', marginVertical: 4 },
  effective: { fontSize: 11, color: BakeryColors.latte, fontStyle: 'italic', marginTop: 4 },
});
