import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';

const SESSION_BG = require('@/assets/images/home/session-picker-bg.png');
const CHARACTER = require('@/assets/images/companion/main-character.png');

const CARD_EMOJI: Record<number, string> = {
  10: '🍮',
  25: '🧁',
  50: '🍰',
  90: '🎂',
};

export default function SessionPickerScreen() {
  const { width } = useWindowDimensions();
  const { isPlus, subjects } = useApp();
  const [selected, setSelected] = useState(25);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const cardWidth = (width - 96) / 2;

  function startSession() {
    router.push({
      pathname: '/subject-picker',
      params: { sessionLength: String(selected) },
    });
  }

  return (
    <View style={styles.container}>
      {/* Lace background */}
      <Image source={SESSION_BG} style={styles.bg} resizeMode="stretch" />

      {/* Character peeking top-right */}
      <Image source={CHARACTER} style={styles.character} resizeMode="contain" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Start Session</Text>
            <Text style={styles.subtitle}>✦ Choose your focus recipe ✦</Text>
            <Text style={styles.hint}>Study time, I saved your seat.</Text>
          </View>

          {/* ── Session cards ── */}
          <View style={styles.grid}>
            {SESSION_LENGTHS.map((opt) => {
              const isActive = selected === opt.minutes;
              return (
                <Pressable
                  key={opt.minutes}
                  style={[styles.card, { width: cardWidth }, isActive && styles.cardActive]}
                  onPress={() => setSelected(opt.minutes)}>
                  {isActive && <Text style={styles.check}>✓</Text>}
                  <Text style={styles.cardEmoji}>{CARD_EMOJI[opt.minutes]}</Text>
                  <Text style={styles.cardMin}>{opt.minutes}</Text>
                  <Text style={styles.cardMinLabel}>min</Text>
                  <View style={styles.ribbon}>
                    <Text style={styles.ribbonText}>{opt.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Subject selection ── */}
          <View style={styles.subjectSection}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectTitle}>📋 Subject (optional)</Text>
              <Text style={styles.subjectSub}>Pick a subject for better stats</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {activeSubjects.map((s) => {
                const isActive = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.chip,
                      { borderColor: isActive ? s.color : '#F4C2C8', backgroundColor: isActive ? s.color + '33' : 'rgba(255,255,255,0.75)' },
                    ]}
                    onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                    <Text style={styles.chipText}>{s.emoji ? `${s.emoji} ` : ''}{s.name}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.chip, { borderColor: '#F4C2C8', borderStyle: 'dashed' }]}
                onPress={() => router.push('/manage-subjects')}>
                <Text style={[styles.chipText, { color: '#C4607A' }]}>+ Add</Text>
              </Pressable>
            </ScrollView>
            {selectedSubjectId && (
              <Pressable onPress={() => setSelectedSubjectId(null)}>
                <Text style={styles.skipText}>Skip → General Study</Text>
              </Pressable>
            )}
          </View>

          {/* ── Custom duration ── */}
          <Pressable
            style={styles.customRow}
            onPress={() => router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })}>
            <Text style={styles.customEmoji}>⏱</Text>
            <View style={styles.customText}>
              <Text style={styles.customTitle}>Custom duration 👑</Text>
              <Text style={styles.customSub}>{isPlus ? 'Any length, save as preset' : 'Any length, no preset'}</Text>
            </View>
            {isPlus && (
              <View style={styles.plusBadge}>
                <Text style={styles.plusText}>Plus</Text>
              </View>
            )}
            <Text style={styles.customArrow}>›</Text>
          </Pressable>

          {/* ── Start button ── */}
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
            onPress={startSession}>
            <Text style={styles.startBtnText}>Start {selected} min Session</Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCEAE8' },
  bg: { ...StyleSheet.absoluteFillObject },

  character: {
    position: 'absolute',
    right: -16,
    top: 48,
    width: 130,
    height: 170,
    zIndex: 2,
  },

  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 16,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingRight: 100,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#E05878',
  },
  subtitle: {
    fontSize: 13,
    color: '#C4607A',
  },
  hint: {
    fontSize: 11,
    color: '#C4607A',
    opacity: 0.7,
  },

  // Cards
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F4C2C8',
    paddingTop: 12,
    paddingBottom: 0,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#E0789A',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardActive: {
    borderColor: '#E05878',
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,240,245,0.92)',
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 14,
    color: '#E05878',
    fontWeight: '700',
  },
  cardEmoji: { fontSize: 40, lineHeight: 50 },
  cardMin: {
    fontSize: 30,
    fontWeight: '700',
    color: '#C4607A',
    lineHeight: 36,
  },
  cardMinLabel: {
    fontSize: 11,
    color: '#C4607A',
    opacity: 0.75,
    marginBottom: 8,
  },
  ribbon: {
    width: '100%',
    backgroundColor: '#F4839A',
    paddingVertical: 5,
    alignItems: 'center',
  },
  ribbonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },

  // Subject
  subjectSection: { gap: 8 },
  subjectHeader: { gap: 2 },
  subjectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C4607A',
  },
  subjectSub: {
    fontSize: 11,
    color: '#C4607A',
    opacity: 0.7,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#C4607A',
    fontWeight: '500',
  },
  skipText: {
    fontSize: 12,
    color: '#C4607A',
    opacity: 0.7,
    textAlign: 'right',
  },

  // Custom
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F4C2C8',
    padding: 14,
    gap: 10,
  },
  customEmoji: { fontSize: 22 },
  customText: { flex: 1, gap: 2 },
  customTitle: { fontSize: 14, fontWeight: '600', color: '#C4607A' },
  customSub: { fontSize: 11, color: '#C4607A', opacity: 0.7 },
  plusBadge: {
    backgroundColor: '#E05878',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  plusText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  customArrow: { fontSize: 20, color: '#C4607A' },

  // Start button
  startBtn: {
    backgroundColor: '#E8607A',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#C0405A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  startBtnPressed: { opacity: 0.88 },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
