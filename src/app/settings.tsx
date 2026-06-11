import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryGlobeEmoji } from '@/components/bakery-emoji';
import { CoinIcon } from '@/components/coin-icon';
import {
  BakerHatIcon,
  DoorOutIcon,
  SparkleStarIcon,
  MeasuringCupIcon,
  PawIcon,
  KitchenTimerIcon,
  RecipeBooksIcon,
  MusicNoteIcon,
  BellIcon,
  GearIcon,
  ChartIcon,
  ChatBubbleIcon,
  InfoIcon,
} from '@/components/settings-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { linkProvider } from '@/lib/oauth';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { getAmbienceName } from '@/app/ambience-picker';
import { LANGUAGES, useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

type RowProps = {
  icon: string | ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  badge?: string;
};

function SettingRow({ icon, label, value, onPress, badge }: RowProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}>
      {typeof icon === 'string' ? (
        <ThemedText style={styles.rowIcon}>{icon}</ThemedText>
      ) : (
        <View style={styles.rowIconImage}>{icon}</View>
      )}
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {value ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {badge ? (
        <ThemedView style={styles.badge}>
          <ThemedText style={styles.badgeText}>{badge}</ThemedText>
        </ThemedView>
      ) : null}
      {onPress ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.chevron}>
          ›
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, isGuest, signOut } = useAuth();
  const {
    coins,
    isPlus,
    ambienceId,
    reminderEnabled,
    language,
    reminderTime,
    setReminder,
    use24HourTime,
    setUse24HourTime,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    setIsPlus,
  } = useApp();

  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);

  // Providers already linked to this account (e.g. ['email','google']).
  const connectedProviders = (user?.identities ?? []).map((i) => i.provider);

  const handleConnect = async (provider: 'google' | 'apple') => {
    try {
      const res = await linkProvider(provider);
      if (res.ok) {
        await supabase.auth.refreshSession().catch(() => {});
        Alert.alert(t('auth.connected'));
      } else if (!res.cancelled) {
        Alert.alert(t('auth.connectFailed'), res.error ?? '');
      }
    } catch (e) {
      Alert.alert(t('auth.connectFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      isGuest ? t('settings.leaveGuestQ') : t('settings.signOutQ'),
      isGuest ? t('settings.leaveGuestMsg') : t('settings.signOutMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isGuest ? t('settings.leaveGuestMode') : t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch (error) {
              Alert.alert(t('settings.signOutFailed'), error instanceof Error ? error.message : t('settings.tryAgain'));
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('settings.title')}</ThemedText>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <ThemedText type="smallBold" style={styles.closeText}>
                {t('common.done')}
              </ThemedText>
            </Pressable>
          </View>

          {/* Account */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secAccount')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<BakerHatIcon size={32} />}
              label={isGuest ? t('settings.guestMode') : t('settings.signedIn')}
              value={isGuest ? t('settings.guestProgressNote') : user?.email ?? t('settings.accountFallback')}
            />
            <View style={styles.divider} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <DoorOutIcon size={32} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold" style={styles.dangerText}>
                  {isGuest ? t('settings.leaveGuestMode') : t('settings.signOut')}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>

          {/* Connected accounts — link Google / Apple to this account */}
          {!isGuest && user && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {t('auth.connectedAccounts')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.group}>
                {(['google'] as const).map((provider, idx) => {
                  const connected = connectedProviders.includes(provider);
                  return (
                    <View key={provider}>
                      {idx > 0 && <View style={styles.divider} />}
                      <Pressable
                        disabled={connected}
                        onPress={() => handleConnect(provider)}
                        style={({ pressed }) => [styles.row, !connected && pressed && styles.rowPressed]}>
                        <View style={styles.rowBody}>
                          <ThemedText type="smallBold">
                            {provider === 'google' ? t('auth.connectGoogle') : t('auth.connectApple')}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {connected ? t('auth.connected') : '＋'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </ThemedView>
            </>
          )}

          {/* Membership */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secMembership')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<SparkleStarIcon size={32} />}
              label={t('settings.plus')}
              value={isPlus ? t('settings.plusActive') : t('settings.freePlan')}
              badge={isPlus ? 'PLUS' : undefined}
              onPress={() => router.push('/plus-upgrade')}
            />
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <MeasuringCupIcon size={32} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.plusTestToggle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('settings.plusTestNote')}
                </ThemedText>
              </View>
              <Switch
                value={isPlus}
                onValueChange={setIsPlus}
                trackColor={{ true: BakeryColors.honey, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
          </ThemedView>

          {/* Balances */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secBalances')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow icon={<CoinIcon size={40} />} label={t('settings.focusCoins')} value={t('settings.coinsValue', { count: coins })} />
          </ThemedView>

          {/* Focus & study */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secFocusStudy')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<KitchenTimerIcon size={32} />}
              label={t('settings.customTimer')}
              value={isPlus ? t('settings.customTimerOn') : t('settings.plusFeature')}
              onPress={() => router.push('/custom-timer')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<RecipeBooksIcon size={32} />}
              label={t('settings.manageSubjects')}
              value={t('settings.manageSubjectsNote')}
              onPress={() => router.push('/manage-subjects')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<MusicNoteIcon size={32} />}
              label={t('settings.ambienceSounds')}
              value={ambienceId ? getAmbienceName(ambienceId) : isPlus ? t('settings.noneSelected') : t('settings.plusFeature')}
              onPress={() => router.push('/ambience-picker')}
            />
          </ThemedView>

          {/* Reminders */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secReminders')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <BellIcon size={32} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.dailyStudyReminder')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {reminderEnabled ? t('settings.reminderOn', { time: reminderTime }) : t('settings.off')}
                </ThemedText>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(next) => setReminder(next, reminderTime)}
                trackColor={{ true: BakeryColors.honey, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.divider} />
            <SettingRow
              icon={<GearIcon size={32} />}
              label={t('settings.reminderSettings')}
              value={t('settings.reminderSettingsNote')}
              onPress={() => router.push('/reminder-settings')}
            />
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <KitchenTimerIcon size={32} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.hour24')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {use24HourTime ? t('settings.hour24On') : t('settings.hour24Off')}
                </ThemedText>
              </View>
              <Switch
                value={use24HourTime}
                onValueChange={setUse24HourTime}
                trackColor={{ true: BakeryColors.honey, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
          </ThemedView>

          {/* Support & about */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secAbout')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<BakeryGlobeEmoji size={30} />}
              label={t('settings.language')}
              value={(() => {
                const lang = LANGUAGES.find((l) => l.code === language);
                return lang ? `${lang.flag} ${lang.native}` : 'English';
              })()}
              onPress={() => router.push('/language-picker')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<ChartIcon size={32} />}
              label={t('settings.progressStats')}
              value={t('settings.progressStatsNote')}
              onPress={() => router.push('/progress')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<ChatBubbleIcon size={32} />}
              label={t('settings.sendFeedback')}
              value={t('settings.sendFeedbackNote')}
              onPress={() => Linking.openURL('mailto:hello@deskmate.app?subject=DeskMate%20Feedback')}
            />
            <View style={styles.divider} />
            <SettingRow icon={<InfoIcon size={32} />} label={t('settings.version')} value={t('settings.versionValue')} />
          </ThemedView>

          <View style={styles.footer} />
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
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  closeBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.honey,
  },
  closeText: { color: BakeryColors.cocoaDark },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    marginLeft: Spacing.two,
  },
  group: {
    borderRadius: BakeryRadii.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: { fontSize: 22, lineHeight: 28, width: 28, textAlign: 'center' },
  rowIconImage: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  chevron: { fontSize: 22, lineHeight: 24 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BakeryColors.border,
    opacity: 0.4,
    marginLeft: Spacing.five,
  },
  badge: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: BakeryColors.cocoaDark },
  dangerText: { color: BakeryColors.danger },
  footer: { height: Spacing.five },
});
