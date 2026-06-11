import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SubjectPickerModal } from '@/components/subject-picker-modal';
import { useApp } from '@/context/app-context';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
const DESK = require('@/assets/images/home/desk-new.png');

const C = BakeryColors;

/**
 * The "on a break" desk scene shown after a multiplayer session finishes and the
 * player chooses to take a break. The companion sits at the desk until the player
 * picks a subject and starts the next session.
 */
export default function StudyDeskScreen() {
  const {
    activeSession,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    startActiveSession,
  } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const me = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  const character = me.type === 'starter' ? BUN_STUDYING : me.imageSource;
  const duration = activeSession?.durationMinutes ?? 25;

  const start = (subjectName: string | null) => {
    startActiveSession({
      durationMinutes: duration,
      subjectName,
      taskId: null,
      taskTitle: null,
      startedAt: new Date().toISOString(),
      isMultiplayer: true,
    });
    setPickerOpen(false);
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
          <Text style={styles.title}>{t('studyDesk.title')}</Text>
          <Text style={styles.sub}>{t('studyDesk.subtitle')}</Text>
        </View>

        <View style={styles.scene}>
          <Image source={character} style={styles.character} contentFit="contain" />
          <Image source={DESK} style={styles.desk} contentFit="cover" pointerEvents="none" />
          <View style={styles.deskEdge} pointerEvents="none" />
        </View>

        <Pressable onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Text style={styles.ctaText}>{t('studyDesk.pickWhenReady')}</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.backLink} hitSlop={8}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>

      <SubjectPickerModal visible={pickerOpen} title={t('studyDesk.readyToStudy')} onPick={start} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1, paddingHorizontal: Spacing.four },
  header: { alignItems: 'center', gap: 4, paddingTop: Spacing.three },
  title: { fontSize: 24, fontWeight: '900', color: C.cocoaDark },
  sub: { fontSize: 13, color: C.mocha, textAlign: 'center' },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', position: 'relative' },
  character: { width: 200, height: 234, zIndex: 1 },
  desk: { position: 'absolute', left: -Spacing.four, right: -Spacing.four, bottom: 0, height: 96, zIndex: 2 },
  deskEdge: { position: 'absolute', left: -Spacing.four, right: -Spacing.four, bottom: 96, height: 1.5, backgroundColor: 'rgba(120,90,70,0.22)', zIndex: 3 },
  cta: {
    marginTop: Spacing.three,
    paddingVertical: 15,
    borderRadius: BakeryRadii.pill,
    alignItems: 'center',
    backgroundColor: C.jam,
    ...BakeryShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  backLink: { alignSelf: 'center', paddingVertical: Spacing.two, marginBottom: Spacing.one },
  backText: { fontSize: 13, fontWeight: '700', color: C.mocha, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
