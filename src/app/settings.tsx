import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiTicketIcon } from '@/components/ai-ticket-icon';
import { CoinIcon } from '@/components/coin-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { getAmbienceName } from '@/app/ambience-picker';
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
  const { user, isGuest, signOut } = useAuth();
  const {
    coins,
    isPlus,
    aiTickets,
    ambienceId,
    reminderEnabled,
    reminderTime,
    setReminder,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    setIsPlus,
  } = useApp();

  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots);

  const handleSignOut = () => {
    Alert.alert(
      isGuest ? 'Leave guest mode?' : 'Sign out?',
      isGuest
        ? 'You can come back to the login screen anytime.'
        : 'You can sign back in anytime with the same account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isGuest ? 'Leave guest mode' : 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch (error) {
              Alert.alert('Sign-out failed', error instanceof Error ? error.message : 'Please try again.');
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
            <ThemedText type="subtitle">Settings</ThemedText>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <ThemedText type="smallBold" style={styles.closeText}>
                Done
              </ThemedText>
            </Pressable>
          </View>

          {/* Account */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            ACCOUNT
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon="👤"
              label={isGuest ? 'Guest mode' : 'Signed in'}
              value={isGuest ? 'Progress saved on this device' : user?.email ?? 'Account'}
            />
            <View style={styles.divider} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <ThemedText style={styles.rowIcon}>🚪</ThemedText>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold" style={styles.dangerText}>
                  {isGuest ? 'Leave guest mode' : 'Sign out'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>

          {/* Membership */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            MEMBERSHIP
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon="✨"
              label="DeskMate Plus"
              value={isPlus ? 'Active — all features unlocked' : 'Free plan'}
              badge={isPlus ? 'PLUS' : undefined}
              onPress={() => router.push('/plus-upgrade')}
            />
            <View style={styles.divider} />
            <View style={styles.row}>
              <ThemedText style={styles.rowIcon}>🧪</ThemedText>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Plus (test toggle)</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Mock unlock for testing AI generation
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
            BALANCES
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow icon={<CoinIcon size={40} />} label="Focus Coins" value={`${coins} coins`} />
            <View style={styles.divider} />
            <SettingRow
              icon={<AiTicketIcon size={40} />}
              label="AI generation tickets"
              value={isPlus ? `${aiTickets} / 3 this month` : 'Plus only'}
            />
          </ThemedView>

          {/* Companion */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            COMPANION
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon="🐾"
              label="Companion gallery"
              value={`Active: ${activeCompanion.name}`}
              onPress={() => router.push('/companion-gallery')}
            />
          </ThemedView>

          {/* Focus & study */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            FOCUS & STUDY
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon="⏱️"
              label="Custom timer & presets"
              value={isPlus ? 'Set your own session lengths' : 'Plus feature'}
              onPress={() => router.push('/custom-timer')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="📚"
              label="Manage subjects"
              value="Add, rename, reorder subjects"
              onPress={() => router.push('/manage-subjects')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="🎵"
              label="Ambience sounds"
              value={ambienceId ? getAmbienceName(ambienceId) : isPlus ? 'None selected' : 'Plus feature'}
              onPress={() => router.push('/ambience-picker')}
            />
          </ThemedView>

          {/* Reminders */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            REMINDERS
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <View style={styles.row}>
              <ThemedText style={styles.rowIcon}>🔔</ThemedText>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Daily study reminder</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {reminderEnabled ? `On · ${reminderTime}` : 'Off'}
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
              icon="⚙️"
              label="Reminder settings"
              value="Times, days, and extra reminders"
              onPress={() => router.push('/reminder-settings')}
            />
          </ThemedView>

          {/* Support & about */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            ABOUT
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon="📊"
              label="Progress & stats"
              value="Streaks, weekly report, mood"
              onPress={() => router.push('/progress')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="💬"
              label="Send feedback"
              value="Tell us what to improve"
              onPress={() => Linking.openURL('mailto:hello@deskmate.app?subject=DeskMate%20Feedback')}
            />
            <View style={styles.divider} />
            <SettingRow icon="ℹ️" label="Version" value="DeskMate 1.0.0" />
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
