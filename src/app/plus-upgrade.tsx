import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameIcon } from '@/components/category-icons';
import { ExamCalendarIcon } from '@/components/home-icons';
import {
  BellIcon,
  ChartIcon,
  KitchenTimerIcon,
  MusicNoteIcon,
} from '@/components/settings-icons';
import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { ShopTabIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BakeryColors, MaxContentWidth, Spacing } from '@/constants/theme';

const FEATURES: { titleKey: string; descKey: string; renderIcon: (size: number) => React.ReactNode }[] = [
  { titleKey: 'plus.f_customTimers', descKey: 'plus.f_customTimersDesc', renderIcon: (s) => <KitchenTimerIcon size={s} /> },
  { titleKey: 'plus.f_multiReminders', descKey: 'plus.f_multiRemindersDesc', renderIcon: (s) => <BellIcon size={s} /> },
  { titleKey: 'plus.f_unlimitedExams', descKey: 'plus.f_unlimitedExamsDesc', renderIcon: (s) => <ExamCalendarIcon size={s} /> },
  { titleKey: 'plus.f_streakFreezes', descKey: 'plus.f_streakFreezesDesc', renderIcon: (s) => <StreakFreezeIcon size={s} /> },
  { titleKey: 'plus.f_advancedReports', descKey: 'plus.f_advancedReportsDesc', renderIcon: (s) => <ChartIcon size={s} /> },
  { titleKey: 'plus.f_ambience', descKey: 'plus.f_ambienceDesc', renderIcon: (s) => <MusicNoteIcon size={s} /> },
  { titleKey: 'plus.f_allGames', descKey: 'plus.f_allGamesDesc', renderIcon: (s) => <GameIcon size={s} /> },
  { titleKey: 'plus.f_shopDiscount', descKey: 'plus.f_shopDiscountDesc', renderIcon: (s) => <ShopTabIcon size={s} color={BakeryColors.honey} /> },
];

export default function PlusUpgradeScreen() {
  const { t } = useTranslation();
  const { isPlus, setIsPlus } = useApp();

  const handleMockUpgrade = () => {
    Alert.alert(
      t('plus.mockUpgrade'),
      t('plus.mockUpgradeMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('plus.activatePlus'),
          onPress: () => {
            setIsPlus(true);
            router.back();
          },
        },
      ],
    );
  };

  const handleRestore = () => {
    Alert.alert(
      t('plus.restorePurchases'),
      t('plus.restoreMsg'),
    );
  };

  const handleDeactivate = () => {
    Alert.alert(t('plus.deactivateQ'), t('plus.deactivateMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('plus.deactivate'),
        style: 'destructive',
        onPress: () => {
          setIsPlus(false);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Hero */}
          <ThemedView style={styles.hero}>
            <ThemedText style={styles.heroEmoji}>✨</ThemedText>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              DeskMate Plus
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSub}>
              {t('plus.heroSub')}
            </ThemedText>
          </ThemedView>

          {/* Status banner (if already Plus) */}
          {isPlus && (
            <ThemedView type="backgroundElement" style={styles.activeBanner}>
              <ThemedText style={styles.activeEmoji}>🎉</ThemedText>
              <ThemedText type="smallBold">{t('plus.plusMember')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('plus.allUnlocked')}
              </ThemedText>
            </ThemedView>
          )}

          {/* Feature list */}
          <ThemedView style={styles.featureList}>
            {FEATURES.map((f) => (
              <ThemedView key={f.titleKey} style={styles.featureRow}>
                <ThemedView style={styles.featureIcon}>{f.renderIcon(40)}</ThemedView>
                <ThemedView style={styles.featureText}>
                  <ThemedText type="smallBold">{t(f.titleKey)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(f.descKey)}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.checkmark}>✓</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Pricing */}
          {!isPlus && (
            <ThemedView type="backgroundElement" style={styles.priceCard}>
              <ThemedView style={styles.priceRow}>
                <ThemedView>
                  <ThemedText type="smallBold" style={styles.priceTitle}>
                    {t('plus.monthly')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('plus.cancelAnytime')}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.priceValue}>$6.70</ThemedText>
              </ThemedView>
              <ThemedView style={styles.divider} />
              <ThemedView style={styles.priceRow}>
                <ThemedView>
                  <ThemedText type="smallBold" style={styles.priceTitle}>
                    {t('plus.yearly')}{' '}
                    <ThemedText style={styles.saveBadge}>{t('plus.save48')}</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('plus.yearlyDetail')}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.priceValue}>$4.17/mo</ThemedText>
              </ThemedView>
            </ThemedView>
          )}

          {/* Free features reminder */}
          {!isPlus && (
            <ThemedView type="backgroundElement" style={styles.freeCard}>
              <ThemedText type="smallBold" style={styles.freeTitle}>
                {t('plus.freeForever')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.freeText}>
                {t('plus.freeText')}
              </ThemedText>
            </ThemedView>
          )}

          {/* CTA buttons */}
          {!isPlus ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.upgradeBtn, pressed && styles.pressed]}
                onPress={handleMockUpgrade}>
                <ThemedText type="smallBold" style={styles.upgradeBtnText}>
                  {t('plus.startPlus')}
                </ThemedText>
              </Pressable>

              <Pressable onPress={handleRestore} style={styles.restoreBtn}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('plus.restorePurchases')}
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={handleDeactivate} style={styles.deactivateBtn}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('plus.deactivatePlus')}
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            {t('plus.disclaimer')}
          </ThemedText>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 40,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.one },
  heroEmoji: { fontSize: 48, lineHeight: 56 },
  heroTitle: { fontSize: 28, lineHeight: 34 },
  heroSub: { textAlign: 'center' },
  activeBanner: {
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: '#F2A0B5',
  },
  activeEmoji: { fontSize: 32, lineHeight: 40 },
  featureList: { gap: Spacing.two },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  featureIcon: { width: 44, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, gap: 2 },
  checkmark: { fontSize: 16, color: '#C75A78', fontWeight: '700' },
  priceCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTitle: { fontSize: 15 },
  priceValue: { fontSize: 22, fontWeight: '700', color: '#7C6F5A' },
  saveBadge: { fontSize: 11, color: '#C75A78', fontWeight: '700' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  freeCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  freeTitle: { fontSize: 14 },
  freeText: { lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  upgradeBtnText: { color: '#FFF', fontSize: 16 },
  pressed: { opacity: 0.85 },
  restoreBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  deactivateBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  disclaimer: { textAlign: 'center', lineHeight: 18, fontSize: 11 },
});
