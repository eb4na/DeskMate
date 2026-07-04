import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusIcon } from '@/components/plus-icon';
import { PlusCrown } from '@/components/avatar-frame';
import { CardColorIcon } from '@/components/card-color-icon';
import { DiscoBallIcon } from '@/components/disco-ball-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { useTranslation } from '@/i18n';
import { PRODUCT_IDS, fetchPrices, purchasePlus, purchasesReady, restorePlus, type PriceMap } from '@/lib/purchases';
import { MaxContentWidth, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';

// Each feature shows the same in-game art used for that feature elsewhere, so the
// paywall reads as a tour of real Memobun content rather than generic line icons.
// `noteKind` flags whether a perk is kept forever ('keep' — the one-time skin &
// room unlocks) or only lasts while subscribed ('expire' — avatar frames).
const FEATURES: {
  titleKey: string;
  descKey: string;
  art?: number;
  crown?: boolean; // render the gold crown frame instead of an image
  cardColor?: boolean; // render the code-drawn profile-card-colour icon
  disco?: boolean; // render the code-drawn disco-ball icon
  noteKey?: string;
  noteKind?: 'keep' | 'expire';
}[] = [
  { titleKey: 'plus.f_customTimers', descKey: 'plus.f_customTimersDesc', art: require('@/assets/images/settings/timer.png') },
  { titleKey: 'plus.f_unlimitedExams', descKey: 'plus.f_unlimitedExamsDesc', art: require('@/assets/images/home/exam-calendar-icon.png') },
  { titleKey: 'plus.f_moreSubjects', descKey: 'plus.f_moreSubjectsDesc', art: require('@/assets/images/settings/books.png') },
  { titleKey: 'plus.f_streakFreezes', descKey: 'plus.f_streakFreezesDesc', art: require('@/assets/images/home/streak-freeze-icon.png') },
  { titleKey: 'plus.f_ambience', descKey: 'plus.f_ambienceDesc', art: require('@/assets/images/shop/icon-sound.png') },
  { titleKey: 'plus.f_spotify', descKey: 'plus.f_spotifyDesc', art: require('@/assets/images/settings/spotify-logo.png') },
  { titleKey: 'plus.f_disco', descKey: 'plus.f_discoDesc', disco: true },
  { titleKey: 'plus.f_exclusiveSkin', descKey: 'plus.f_exclusiveSkinDesc', art: require('@/assets/images/bun/bun-strawberry.png'), noteKey: 'plus.noteKeep', noteKind: 'keep' },
  { titleKey: 'plus.f_goldenTeahouse', descKey: 'plus.f_goldenTeahouseDesc', art: require('@/assets/images/backgrounds/strawberry-palace.png'), noteKey: 'plus.noteKeep', noteKind: 'keep' },
  { titleKey: 'plus.f_cardColor', descKey: 'plus.f_cardColorDesc', cardColor: true, noteKey: 'plus.noteExpire', noteKind: 'expire' },
  { titleKey: 'plus.f_roomTicket', descKey: 'plus.f_roomTicketDesc', art: require('@/assets/images/shop/ticket.png') },
  { titleKey: 'plus.f_shopDiscount', descKey: 'plus.f_shopDiscountDesc', art: require('@/assets/images/tabIcons/gen-shop.png') },
  { titleKey: 'plus.f_streakCoins', descKey: 'plus.f_streakCoinsDesc', art: require('@/assets/images/home/coin-icon.png') },
];

// Art shown in the first-time Plus reward popups (matches the in-game items).
const SKIN_ART = require('@/assets/images/bun/bun-strawberry.png');
const ROOM_ART = require('@/assets/images/backgrounds/strawberry-palace.png');

export default function PlusUpgradeScreen() {
  const { t } = useTranslation();
  // This paywall is presented as a page/form-sheet modal. On iPad that sheet
  // reports a narrow *window* width, so the window-based device-class hook can
  // misread the device as a phone and skip every tablet style. Detect the real
  // device from the physical SCREEN (which the sheet can't shrink) so tablet
  // sizing actually fires here. min-side is orientation-independent.
  const screen = Dimensions.get('screen');
  const isTablet = useIsTablet() || Math.min(screen.width, screen.height) >= 600;
  const { isPlus, setIsPlus, ownedShopItems } = useApp();
  // Chosen billing period — monthly Plus lapses after a month, annual after a year.
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');
  // Confirm dialog rendered as a LOCAL <Modal> (not the root showPopup host): this
  // screen is itself a native modal, and a root-mounted popup can fail to present
  // over it. A local modal presents from this screen's own controller, so it always
  // shows — and we don't call router.back() from its callback (dismissing two
  // modals at once races on iOS); activating just flips the screen into its
  // "Plus member" state and the user closes the screen themselves.
  // 'rewardSkin' → 'rewardRoom' are the two first-time-Plus unlock popups, shown
  // back-to-back only when the perks were actually newly granted.
  // 'activate' is the DEV-only mock-purchase confirm; the 'msg*' states are simple
  // info panels (store unavailable / failed / restore result) rendered as a local
  // modal because a root showPopup can fail to present over this native-modal screen.
  const [confirm, setConfirm] = useState<
    null | 'activate' | 'deactivate' | 'rewardSkin' | 'rewardRoom' | 'msgUnavailable' | 'msgFailed' | 'msgRestored' | 'msgNoRestore'
  >(null);

  // Live App Store subscription prices (localized). Falls back to the hardcoded
  // i18n price strings when IAP is unavailable / fetch fails.
  const [prices, setPrices] = useState<PriceMap>({});
  useEffect(() => {
    let alive = true;
    fetchPrices([PRODUCT_IDS.plusMonthly, PRODUCT_IDS.plusAnnual]).then((m) => {
      if (alive) setPrices(m);
    });
    return () => { alive = false; };
  }, []);
  const monthlyPrice = prices[PRODUCT_IDS.plusMonthly] ?? t('plus.monthlyPrice');
  const yearlyPrice = prices[PRODUCT_IDS.plusAnnual] ?? t('plus.yearlyPrice');

  // Flip the app into its Plus state and show the first-time unlock popups. `until`
  // is the real RevenueCat entitlement expiry when we have it.
  const activatePlus = (until?: string) => {
    // Perks are kept forever, so they're only newly granted the first time → only
    // then show the reward popups.
    const firstTime = !ownedShopItems.includes('outfit_bun_strawberry');
    setIsPlus(true, plan, until);
    setConfirm(firstTime ? 'rewardSkin' : null);
  };

  // "Start Plus" CTA. Real StoreKit purchase when available; DEV mock otherwise;
  // production with no store fails closed (never grants Plus for free).
  const startPlus = () => {
    if (!purchasesReady()) {
      setConfirm(__DEV__ ? 'activate' : 'msgUnavailable');
      return;
    }
    purchasePlus(plan).then((res) => {
      if (res.ok) activatePlus(res.until ?? undefined);
      else if (!res.cancelled) setConfirm('msgFailed');
    });
  };

  const handleRestore = () => {
    if (!purchasesReady()) {
      setConfirm('msgUnavailable');
      return;
    }
    restorePlus().then((res) => {
      if (res.ok && res.until) {
        setIsPlus(true, plan, res.until);
        setConfirm('msgRestored');
      } else {
        setConfirm('msgNoRestore');
      }
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Hero */}
          <ThemedView style={styles.hero}>
            <PlusIcon size={isTablet ? 96 : 72} />
            <ThemedText type="subtitle" style={[styles.heroTitle, isTablet && styles.heroTitleTablet]}>
              Memobun Plus
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={[styles.heroSub, isTablet && styles.heroSubTablet]}>
              {t('plus.heroSub')}
            </ThemedText>
          </ThemedView>

          {/* Status banner (if already Plus) */}
          {isPlus && (
            <ThemedView type="backgroundElement" style={styles.activeBanner}>
              <ThemedText style={styles.activeEmoji}></ThemedText>
              <ThemedText type="smallBold" style={isTablet && styles.bannerTitleTablet}>{t('plus.plusMember')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.secondaryTextTablet}>
                {t('plus.allUnlocked')}
              </ThemedText>
            </ThemedView>
          )}

          {/* Feature list */}
          <ThemedView style={styles.featureList}>
            {FEATURES.map((f) => (
              <ThemedView key={f.titleKey} style={[styles.featureRow, isTablet && styles.featureRowTablet]}>
                <ThemedView style={[styles.featureIcon, isTablet && styles.featureIconTablet]}>
                  {f.crown ? (
                    <PlusCrown size={isTablet ? 42 : 30} />
                  ) : f.cardColor ? (
                    <CardColorIcon size={isTablet ? 52 : 40} />
                  ) : f.disco ? (
                    <DiscoBallIcon size={isTablet ? 52 : 40} />
                  ) : (
                    <Image source={f.art} style={[styles.featureImg, isTablet && styles.featureImgTablet]} contentFit="contain" />
                  )}
                </ThemedView>
                <ThemedView style={styles.featureText}>
                  <ThemedText type="smallBold" style={isTablet && styles.featureTitleTablet}>{t(f.titleKey)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.featureDescTablet}>
                    {t(f.descKey)}
                  </ThemedText>
                  {f.noteKey && (
                    <ThemedView
                      style={[styles.notepill, f.noteKind === 'keep' ? styles.notePillKeep : styles.notePillExpire]}>
                      <ThemedText style={[styles.noteText, f.noteKind === 'keep' ? styles.noteTextKeep : styles.noteTextExpire]}>
                        {f.noteKind === 'keep' ? '♡ ' : '⏳ '}{t(f.noteKey)}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
                <ThemedText style={[styles.checkmark, isTablet && styles.checkmarkTablet]}>✓</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Pricing — tap to pick a plan. Monthly lapses after a month; annual after a year. */}
          {!isPlus && (
            <ThemedView type="backgroundElement" style={[styles.priceCard, isTablet && styles.priceCardTablet]}>
              <Pressable
                onPress={() => setPlan('monthly')}
                style={[styles.priceRow, styles.planRow, isTablet && styles.planRowTablet, plan === 'monthly' && styles.planRowActive]}>
                <ThemedView style={styles.planLeft}>
                  <ThemedView style={[styles.radio, isTablet && styles.radioTablet, plan === 'monthly' && styles.radioActive]}>
                    {plan === 'monthly' && <ThemedText style={[styles.radioCheck, isTablet && styles.radioCheckTablet]}>✓</ThemedText>}
                  </ThemedView>
                  <View style={styles.planTextCol}>
                    <ThemedText type="smallBold" style={[styles.priceTitle, isTablet && styles.priceTitleTablet]}>
                      {t('plus.monthly')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.planSubTablet}>
                      {t('plus.cancelAnytime')}
                    </ThemedText>
                  </View>
                </ThemedView>
                <ThemedText style={[styles.priceValue, isTablet && styles.priceValueTablet]}>{monthlyPrice}</ThemedText>
              </Pressable>
              <ThemedView style={styles.divider} />
              <Pressable
                onPress={() => setPlan('annual')}
                style={[styles.priceRow, styles.planRow, isTablet && styles.planRowTablet, plan === 'annual' && styles.planRowActive]}>
                <ThemedView style={styles.planLeft}>
                  <ThemedView style={[styles.radio, isTablet && styles.radioTablet, plan === 'annual' && styles.radioActive]}>
                    {plan === 'annual' && <ThemedText style={[styles.radioCheck, isTablet && styles.radioCheckTablet]}>✓</ThemedText>}
                  </ThemedView>
                  <View style={styles.planTextCol}>
                    <ThemedText type="smallBold" style={[styles.priceTitle, isTablet && styles.priceTitleTablet]}>
                      {t('plus.yearly')}{' '}
                      <ThemedText style={[styles.saveBadge, isTablet && styles.saveBadgeTablet]}>{t('plus.saveYearly')}</ThemedText>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.planSubTablet}>
                      {t('plus.yearlyDetail')}
                    </ThemedText>
                  </View>
                </ThemedView>
                <ThemedText style={[styles.priceValue, isTablet && styles.priceValueTablet]}>{yearlyPrice}</ThemedText>
              </Pressable>
            </ThemedView>
          )}


          {/* CTA buttons */}
          {!isPlus ? (
            <>
              <SoundPressable
                sound="confirm"
                style={({ pressed }) => [styles.upgradeBtn, isTablet && styles.upgradeBtnTablet, pressed && styles.pressed]}
                onPress={startPlus}>
                <ThemedText type="smallBold" style={[styles.upgradeBtnText, isTablet && styles.upgradeBtnTextTablet]}>
                  {t('plus.startPlus')}
                </ThemedText>
              </SoundPressable>

              <Pressable onPress={handleRestore} style={styles.restoreBtn}>
                <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.secondaryTextTablet}>
                  {t('plus.restorePurchases')}
                </ThemedText>
              </Pressable>
            </>
          ) : __DEV__ ? (
            // DEV-only: locally flip Plus off for testing. In production Apple owns
            // cancellation, so there's no local "deactivate" — see the Manage link below.
            <Pressable onPress={() => setConfirm('deactivate')} style={styles.deactivateBtn}>
              <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.secondaryTextTablet}>
                {t('plus.deactivatePlus')}
              </ThemedText>
            </Pressable>
          ) : (
            // Apple-correct subscription management: deep-link to the App Store
            // subscriptions screen rather than flipping local state (which the launch
            // reconcile would just restore from the live entitlement).
            <Pressable onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} style={styles.deactivateBtn}>
              <ThemedText type="small" themeColor="textSecondary" style={isTablet && styles.secondaryTextTablet}>
                {t('plus.manageSubscription')}
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={[styles.disclaimer, isTablet && styles.disclaimerTablet]}>
            {t('plus.disclaimer')}
          </ThemedText>

          {/* App Store Guideline 3.1.2: an auto-renewing-subscription paywall must
              link to functional Terms (EULA) + Privacy Policy from the screen. */}
          <Pressable onPress={() => router.push('/legal')} style={styles.legalLink}>
            <ThemedText type="small" style={[styles.legalLinkText, isTablet && styles.secondaryTextTablet]}>
              {t('plus.termsPrivacy', { defaultValue: 'Terms of Service & Privacy Policy' })}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ScrollView>

      {/* Local confirm dialog — see note on `confirm` state above. */}
      <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirm(null)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation?.()}>
            {confirm === 'activate' ? (
              <>
                <ThemedText style={styles.confirmTitle}>{t('plus.mockUpgrade')}</ThemedText>
                <ThemedText style={styles.confirmMsg}>{t('plus.mockUpgradeMsg')}</ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.confirmPrimary, pressed && styles.pressed]}
                  onPress={() => activatePlus()}>
                  <ThemedText style={styles.confirmPrimaryText}>{t('plus.activatePlus')}</ThemedText>
                </Pressable>
              </>
            ) : confirm === 'deactivate' ? (
              <>
                <ThemedText style={styles.confirmTitle}>{t('plus.deactivateQ')}</ThemedText>
                <ThemedText style={styles.confirmMsg}>{t('plus.deactivateMsg')}</ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.confirmDestructive, pressed && styles.pressed]}
                  onPress={() => { setIsPlus(false); setConfirm(null); }}>
                  <ThemedText style={styles.confirmDestructiveText}>{t('plus.deactivate')}</ThemedText>
                </Pressable>
              </>
            ) : confirm === 'rewardSkin' ? (
              <>
                <Image source={SKIN_ART} style={styles.confirmArt} contentFit="contain" />
                <ThemedText style={styles.confirmTitle}>
                  {t('plus.rewardSkinTitle', { defaultValue: 'New outfit unlocked!' })}
                </ThemedText>
                <ThemedText style={styles.confirmMsg}>
                  {t('plus.rewardSkinMsg', {
                    defaultValue:
                      "You got Bun's Berry Princess outfit — yours to keep forever. Find it in Bun's wardrobe.",
                  })}
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.confirmPrimary, pressed && styles.pressed]}
                  onPress={() => setConfirm('rewardRoom')}>
                  <ThemedText style={styles.confirmPrimaryText}>
                    {t('common.next', { defaultValue: 'Next' })}
                  </ThemedText>
                </Pressable>
              </>
            ) : confirm === 'rewardRoom' ? (
              <>
                <Image source={ROOM_ART} style={styles.confirmArtWide} contentFit="cover" />
                <ThemedText style={styles.confirmTitle}>
                  {t('plus.rewardRoomTitle', { defaultValue: 'New room & desk unlocked!' })}
                </ThemedText>
                <ThemedText style={styles.confirmMsg}>
                  {t('plus.rewardRoomMsg', {
                    defaultValue:
                      "You received the Golden Teahouse room and its matching desk — yours to keep forever. Find them in Edit Room.",
                  })}
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.confirmPrimary, pressed && styles.pressed]}
                  onPress={() => setConfirm(null)}>
                  <ThemedText style={styles.confirmPrimaryText}>
                    {t('plus.welcomeCta', { defaultValue: 'Sweet!' })}
                  </ThemedText>
                </Pressable>
              </>
            ) : confirm?.startsWith('msg') ? (
              <>
                <ThemedText style={styles.confirmTitle}>
                  {confirm === 'msgUnavailable'
                    ? t('plus.storeUnavailable', { defaultValue: 'Store unavailable' })
                    : confirm === 'msgFailed'
                    ? t('plus.purchaseFailed', { defaultValue: 'Purchase failed' })
                    : confirm === 'msgRestored'
                    ? t('plus.restored', { defaultValue: 'Plus restored 🎉' })
                    : t('plus.nothingToRestore', { defaultValue: 'Nothing to restore' })}
                </ThemedText>
                <ThemedText style={styles.confirmMsg}>
                  {confirm === 'msgUnavailable'
                    ? t('plus.storeUnavailableMsg', { defaultValue: 'Purchases are temporarily unavailable. Please try again later.' })
                    : confirm === 'msgFailed'
                    ? t('plus.purchaseFailedMsg', { defaultValue: 'Something went wrong and you were not charged. Please try again.' })
                    : confirm === 'msgRestored'
                    ? t('plus.restoredMsg', { defaultValue: 'Your Memobun Plus subscription has been restored.' })
                    : t('plus.nothingToRestoreMsg', { defaultValue: "We couldn't find an active subscription on your Apple ID." })}
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.confirmPrimary, pressed && styles.pressed]}
                  onPress={() => setConfirm(null)}>
                  <ThemedText style={styles.confirmPrimaryText}>{t('common.ok', { defaultValue: 'OK' })}</ThemedText>
                </Pressable>
              </>
            ) : null}
            {(confirm === 'activate' || confirm === 'deactivate') && (
              <Pressable style={styles.confirmCancel} onPress={() => setConfirm(null)}>
                <ThemedText style={styles.confirmCancelText}>{t('common.cancel')}</ThemedText>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  featureImg: { width: 40, height: 40, backgroundColor: 'transparent' },
  featureText: { flex: 1, gap: 2 },
  checkmark: { fontSize: 16, color: '#C75A78', fontWeight: '700' },
  // iPad: the feature list reads tiny at phone sizes — scale up text + icons.
  featureRowTablet: { paddingVertical: 11, gap: Spacing.three },
  featureIconTablet: { width: 60 },
  featureImgTablet: { width: 56, height: 56 },
  featureTitleTablet: { fontSize: 21, lineHeight: 27 },
  featureDescTablet: { fontSize: 16, lineHeight: 22 },
  checkmarkTablet: { fontSize: 24 },
  // iPad: the rest of the screen (hero, prices, CTAs) has no phone→tablet scaling,
  // so it reads tiny inside the wide sheet — bump every text/control here too.
  heroTitleTablet: { fontSize: 38, lineHeight: 46 },
  heroSubTablet: { fontSize: 18, lineHeight: 24 },
  bannerTitleTablet: { fontSize: 20, lineHeight: 26 },
  priceCardTablet: { padding: Spacing.four, gap: Spacing.three },
  priceTitleTablet: { fontSize: 20, lineHeight: 26 },
  priceValueTablet: { fontSize: 30 },
  planSubTablet: { fontSize: 15.5, lineHeight: 21 },
  saveBadgeTablet: { fontSize: 14 },
  planRowTablet: { paddingHorizontal: 14, paddingVertical: 12 },
  radioTablet: { width: 26, height: 26, borderRadius: 13 },
  radioCheckTablet: { fontSize: 15, lineHeight: 17 },
  upgradeBtnTablet: { paddingVertical: Spacing.four, borderRadius: 20 },
  upgradeBtnTextTablet: { fontSize: 22 },
  secondaryTextTablet: { fontSize: 16, lineHeight: 22 },
  disclaimerTablet: { fontSize: 14, lineHeight: 21 },
  // Per-perk note pill: "keep forever" (positive green) vs "expires with Plus" (amber).
  notepill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3 },
  notePillKeep: { backgroundColor: 'rgba(75,164,110,0.14)' },
  notePillExpire: { backgroundColor: 'rgba(214,158,46,0.16)' },
  noteText: { fontSize: 11, fontWeight: '700', lineHeight: 15 },
  noteTextKeep: { color: '#3E8E5C' },
  noteTextExpire: { color: '#B07A1E' },
  priceCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTitle: { fontSize: 15 },
  priceValue: { fontSize: 22, fontWeight: '700', color: '#7C6F5A' },
  saveBadge: { fontSize: 11, color: '#C75A78', fontWeight: '700' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Selectable plan rows (monthly / annual).
  planRow: { borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 8 },
  planRowActive: { borderColor: '#C75A78', backgroundColor: 'rgba(199,90,120,0.07)' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent' },
  planTextCol: { backgroundColor: 'transparent' },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { backgroundColor: '#C75A78', borderColor: '#C75A78' },
  radioCheck: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
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
  legalLink: { alignItems: 'center', paddingVertical: Spacing.one },
  legalLinkText: { textDecorationLine: 'underline', color: '#7C6F5A', fontWeight: '700' },

  // Local confirm dialog (activate / deactivate Plus).
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  confirmCard: {
    width: '100%',
    minWidth: MIN_POPUP_WIDTH,
    maxWidth: popupMaxWidth(340),
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#F2D9CF',
  },
  confirmArt: { width: 120, height: 120, alignSelf: 'center', backgroundColor: 'transparent' },
  confirmArtWide: { width: '100%', height: 130, borderRadius: 16, backgroundColor: 'transparent' },
  confirmTitle: { fontSize: 19, fontWeight: '800', color: '#5B3A2E', textAlign: 'center' },
  confirmMsg: { fontSize: 14, fontWeight: '600', color: '#7C6F5A', textAlign: 'center', lineHeight: 20 },
  confirmPrimary: { backgroundColor: '#7C6F5A', borderRadius: 16, paddingVertical: Spacing.three, alignItems: 'center' },
  confirmPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  confirmDestructive: { backgroundColor: '#D9534F', borderRadius: 16, paddingVertical: Spacing.three, alignItems: 'center' },
  confirmDestructiveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  confirmCancel: { alignItems: 'center', paddingVertical: 4 },
  confirmCancelText: { fontSize: 14, fontWeight: '700', color: '#7C6F5A' },
});
