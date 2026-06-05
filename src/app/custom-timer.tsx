import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';

const SESSION_FRAME = require('@/assets/images/home/session-frame.png');
const START_BTN     = require('@/assets/images/home/start-btn.png');
const BACK_BTN      = require('@/assets/images/home/back-btn.png');

const DESSERTS: Record<number, ReturnType<typeof require>> = {
  0: require('@/assets/images/cake/dessert-10.png'),
  1: require('@/assets/images/cake/dessert-25.png'),
  2: require('@/assets/images/cake/dessert-50.png'),
  3: require('@/assets/images/cake/dessert-90.png'),
};

const FOCUS_PICKS = [15, 20, 35, 60, 75, 120];
const BREAK_PICKS = [5, 10, 15, 20, 30, 45];

type TimerMode = 'focus' | 'break';

export default function CustomTimerScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: TimerMode }>();
  const timerMode: TimerMode = mode === 'break' ? 'break' : 'focus';
  const isBreakMode = timerMode === 'break';
  const { subjects, saveTimerPreset, isPlus } = useApp();

  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [savePreset, setSavePreset] = useState(false);

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const quickPicks = isBreakMode ? BREAK_PICKS : FOCUS_PICKS;
  const cardWidth = Math.min((width * 0.96 - 88 - 16) / 3, 90);

  const handleStart = () => {
    const parsed = customInput ? parseInt(customInput, 10) : null;
    const mins = parsed && !isNaN(parsed) ? parsed : selectedMinutes;
    if (!mins) { Alert.alert('Pick a duration first'); return; }
    if (mins < 1 || mins > 300) { Alert.alert('Enter between 1–300 minutes'); return; }
    if (savePreset && isPlus) saveTimerPreset({ label: `${mins} min`, minutes: mins });
    if (isBreakMode) {
      router.replace({ pathname: '/break-game', params: { breakMinutes: String(mins), fromSession: '1' } });
    } else {
      router.push({ pathname: '/subject-picker', params: { sessionLength: String(mins) } });
    }
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => router.back()} />

      <ImageBackground
        source={SESSION_FRAME}
        style={[styles.frame, { width: width * 0.96, height: height * 0.93, paddingTop: 70 }]}
        resizeMode="stretch"
        imageStyle={{ borderRadius: 28 }}>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} scrollEnabled={false}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>✦ Custom Timer ✦</Text>
            <Text style={styles.subtitle}>Choose your focus recipe</Text>
          </View>

          {/* Quick picks label */}
          <Text style={styles.sectionLabel}>QUICK PICKS</Text>

          {/* Quick pick cards */}
          <View style={styles.grid}>
            {quickPicks.map((min, i) => {
              const isActive = selectedMinutes === min;
              return (
                <Pressable
                  key={min}
                  style={[styles.card, { width: cardWidth }, isActive && styles.cardActive]}
                  onPress={() => setSelectedMinutes(isActive ? null : min)}>
                  {isActive && <View style={styles.checkBadge}><Text style={styles.checkIcon}>✓</Text></View>}
                  <Image source={DESSERTS[i % 4]} style={styles.cardImg} resizeMode="contain" />
                  <Text style={styles.cardMin}>{min}</Text>
                  <Text style={styles.cardMinLabel}>min</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom input */}
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customInput}
              onChangeText={(v) => { setCustomInput(v); setSelectedMinutes(null); }}
              placeholder="Custom min..."
              placeholderTextColor="#D4A0AF"
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <Text style={styles.customInputLabel}>min</Text>
          </View>

          {/* Subject */}
          <Text style={styles.sectionLabel}>✦ SUBJECT (OPTIONAL) ✦</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chipRow}>
            <Pressable
              style={[styles.chip, !selectedSubjectId && styles.chipActive]}
              onPress={() => setSelectedSubjectId(null)}>
              <Text style={[styles.chipText, !selectedSubjectId && styles.chipTextActive]}>None</Text>
            </Pressable>
            {activeSubjects.map((s) => {
              const isActive = selectedSubjectId === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.chip, { borderColor: isActive ? s.color : '#F4C2C8', backgroundColor: isActive ? s.color + '33' : 'rgba(255,255,255,0.75)' }]}
                  onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                  <Text style={styles.chipText}>{s.emoji ? `${s.emoji} ` : ''}{s.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Save as preset */}
          <Pressable style={styles.presetRow} onPress={() => setSavePreset(v => !v)}>
            <View style={[styles.checkbox, savePreset && styles.checkboxOn]}>
              {savePreset && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <View>
              <Text style={styles.presetTitle}>Save as preset</Text>
              <Text style={styles.presetSub}>Quickly reuse this duration</Text>
            </View>
          </Pressable>

          {/* Start button */}
          <Pressable style={({ pressed }) => [styles.startWrap, pressed && { opacity: 0.85 }]} onPress={handleStart}>
            <ImageBackground source={START_BTN} style={styles.startBtn} resizeMode="stretch">
              <Text style={styles.startBtnText}>Start Session</Text>
            </ImageBackground>
          </Pressable>

          {/* Back button */}
          <View style={styles.backRow}>
            <Pressable onPress={() => router.back()}>
              <Image source={BACK_BTN} style={styles.backBtn} resizeMode="contain" />
            </Pressable>
          </View>

        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  frame: {
    borderRadius: 28, overflow: 'hidden',
    paddingBottom: 16, paddingHorizontal: 44,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 8, gap: 10 },

  header: { alignItems: 'center', gap: 1 },
  title: { fontSize: 18, fontWeight: '700', fontStyle: 'italic', color: '#E05878' },
  subtitle: { fontSize: 10, color: '#C4607A' },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#C4607A', letterSpacing: 1, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 12,
    borderWidth: 2, borderColor: '#F4C2C8',
    paddingTop: 6, alignItems: 'center', overflow: 'hidden', minHeight: 90,
    shadowColor: '#E0789A', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardActive: { borderColor: '#E05878', borderWidth: 2.5, backgroundColor: 'rgba(255,240,245,0.92)' },
  checkBadge: {
    position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#E05878', alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 8, color: '#fff', fontWeight: '700' },
  cardImg: { width: 52, height: 52 },
  cardMin: { fontSize: 18, fontWeight: '700', color: '#C4607A', lineHeight: 22 },
  cardMinLabel: { fontSize: 8, color: '#C4607A', opacity: 0.75, marginBottom: 2 },

  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: '#F4C2C8', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.75)' },
  chipActive: { borderColor: '#E05878', backgroundColor: '#E0587822' },
  chipText: { fontSize: 11, color: '#C4607A', fontWeight: '500' },
  chipTextActive: { color: '#E05878', fontWeight: '700' },

  customInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#F4C2C8', paddingHorizontal: 14, paddingVertical: 6,
  },
  customInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#C4607A' },
  customInputLabel: { fontSize: 13, color: '#C4607A', fontWeight: '500' },

  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#E05878', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#E05878' },
  checkboxTick: { fontSize: 10, color: '#fff', fontWeight: '700' },
  presetTitle: { fontSize: 12, fontWeight: '600', color: '#C4607A' },
  presetSub: { fontSize: 9, color: '#C4607A', opacity: 0.7 },

  startWrap: { alignSelf: 'center' },
  startBtn: { width: 250, height: 54, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontStyle: 'italic', fontFamily: 'Georgia', textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },

  backRow: { alignItems: 'center' },
  backBtn: { width: 64, height: 44 },
});
