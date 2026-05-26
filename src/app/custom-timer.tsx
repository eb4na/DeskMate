import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusGate } from '@/components/plus-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

const FOCUS_QUICK_PICKS = [15, 20, 35, 60, 75, 120];
const BREAK_QUICK_PICKS = [5, 10, 15, 20, 30, 45];

type TimerMode = 'focus' | 'break';

function CustomTimerContent() {
  const { mode } = useLocalSearchParams<{ mode?: TimerMode }>();
  const timerMode: TimerMode = mode === 'break' ? 'break' : 'focus';
  const isBreakMode = timerMode === 'break';
  const {
    savedTimerPresets,
    saveTimerPreset,
    deleteTimerPreset,
    savedBreakPresets,
    saveBreakPreset,
    deleteBreakPreset,
  } = useApp();
  const [customMinutes, setCustomMinutes] = useState('');
  const [savePreset, setSavePreset] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const savedPresets = isBreakMode ? savedBreakPresets : savedTimerPresets;
  const quickPicks = isBreakMode ? BREAK_QUICK_PICKS : FOCUS_QUICK_PICKS;

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 16,
  };

  const handleStart = (minutes: number) => {
    if (minutes < 1 || minutes > 300) {
      Alert.alert('Invalid duration', 'Please enter between 1 and 300 minutes.');
      return;
    }

    if (savePreset && presetLabel.trim()) {
      const nextPreset = { label: presetLabel.trim(), minutes };
      if (isBreakMode) {
        saveBreakPreset(nextPreset);
      } else {
        saveTimerPreset(nextPreset);
      }
    }

    if (isBreakMode) {
      router.replace({
        pathname: '/break-game',
        params: { breakMinutes: String(minutes), fromSession: '1' },
      });
      return;
    }

    router.push({ pathname: '/subject-picker', params: { sessionLength: String(minutes) } });
  };

  const handleCustomStart = () => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins)) {
      Alert.alert('Invalid input', 'Please enter a number of minutes.');
      return;
    }
    handleStart(mins);
  };

  const handleDelete = (id: string) => {
    if (isBreakMode) {
      deleteBreakPreset(id);
    } else {
      deleteTimerPreset(id);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
          {isBreakMode
            ? 'Set a custom break length or save a few reset-friendly presets.'
            : 'Set any focus duration that works for you.'}
        </ThemedText>

        {savedPresets.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Saved {isBreakMode ? 'break' : 'focus'} presets
            </ThemedText>
            <ThemedView style={styles.presetList}>
              {savedPresets.map((p) => (
                <ThemedView key={p.id} type="backgroundElement" style={styles.presetRow}>
                  <Pressable style={styles.presetMain} onPress={() => handleStart(p.minutes)}>
                    <ThemedText type="smallBold">{p.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.minutes} min
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(p.id)} style={styles.presetDelete}>
                    <ThemedText type="small" themeColor="textSecondary">
                      ✕
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ))}
            </ThemedView>
          </ThemedView>
        )}

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Quick picks
          </ThemedText>
          <ThemedView style={styles.quickGrid}>
            {quickPicks.map((min) => (
              <Pressable
                key={min}
                style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
                onPress={() => handleStart(min)}>
                <ThemedView type="backgroundElement" style={styles.quickCardInner}>
                  <ThemedText type="smallBold" style={styles.quickMin}>
                    {min}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    min
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Custom {isBreakMode ? 'break' : 'focus'} duration
          </ThemedText>
          <ThemedView style={styles.customRow}>
            <TextInput
              style={[inputStyle, styles.customInput]}
              value={customMinutes}
              onChangeText={setCustomMinutes}
              placeholder={isBreakMode ? 'e.g. 18' : 'e.g. 45'}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <ThemedText type="small" themeColor="textSecondary">
              minutes
            </ThemedText>
          </ThemedView>

          <Pressable style={styles.savePresetRow} onPress={() => setSavePreset((v) => !v)}>
            <ThemedView style={[styles.checkbox, savePreset && styles.checkboxActive]} />
            <ThemedText type="small">Save as preset</ThemedText>
          </Pressable>

          {savePreset && (
            <TextInput
              style={inputStyle}
              value={presetLabel}
              onChangeText={setPresetLabel}
              placeholder={
                isBreakMode ? 'Preset name (e.g. Stretch break)' : 'Preset name (e.g. Deep Work)'
              }
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          )}

          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}
            onPress={handleCustomStart}>
            <ThemedText type="smallBold" style={styles.startBtnText}>
              {isBreakMode ? 'Start break' : 'Start session'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <ThemedText type="linkPrimary">Back</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ScrollView>
  );
}

export default function CustomTimerScreen() {
  return (
    <ThemedView style={styles.container}>
      <PlusGate
        feature="Custom Timers"
        description="Set any focus duration, save your favourite presets, and keep custom break lengths ready too."
        emoji="⏱">
        <CustomTimerContent />
      </PlusGate>
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
    gap: Spacing.four,
  },
  hint: { textAlign: 'center' },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  presetList: { gap: Spacing.two },
  presetRow: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  presetMain: { flex: 1, padding: Spacing.three, gap: 2 },
  presetDelete: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickCard: { flexBasis: '30%', flexGrow: 1 },
  quickCardInner: {
    borderRadius: 12,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  quickMin: { fontSize: 24, lineHeight: 30 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  customInput: { flex: 1 },
  savePresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#7C6F5A',
  },
  checkboxActive: {
    backgroundColor: '#7C6F5A',
  },
  startBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  startBtnText: { color: '#FFF', fontSize: 16 },
  pressed: { opacity: 0.85 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
});
