import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';

const SESSION_FRAME = require('@/assets/images/home/session-frame.png');
const START_BTN = require('@/assets/images/home/start-btn.png');
const CUSTOM_BTN_LOCK = require('@/assets/images/home/custom-btn-lock.png');
const CUSTOM_BTN_PLUS = require('@/assets/images/home/custom-btn-plus.png');
const BACK_BTN = require('@/assets/images/home/back-btn.png');
const BOOK_ICON = require('@/assets/images/home/book-icon.png');

const CARD_IMG: Record<number, ReturnType<typeof require>> = {
  10: require('@/assets/images/home/dessert-10.png'),
  25: require('@/assets/images/home/dessert-25.png'),
  50: require('@/assets/images/home/dessert-50.png'),
  90: require('@/assets/images/home/dessert-90.png'),
};

export default function SessionPickerScreen() {
  const { width, height } = useWindowDimensions();
  const { isPlus, subjects } = useApp();
  const [selected, setSelected] = useState(25);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const cardWidth = Math.min((width * 0.92 - 100) / 2, 128);

  function startSession() {
    router.push({
      pathname: '/subject-picker',
      params: { sessionLength: String(selected) },
    });
  }

  return (
    // Full-screen semi-transparent backdrop — home screen shows through
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => router.back()} />

      {/* Lace frame card */}
      <ImageBackground
        source={SESSION_FRAME}
        style={[styles.card, { width: width * 0.96, height: height * 0.93, paddingTop: 70 }]}
        resizeMode="stretch"
        imageStyle={styles.frameImage}>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          scrollEnabled={false}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Start Session</Text>
            <Text style={styles.subtitle}>✦ Choose your focus recipe ✦</Text>
            <Text style={styles.hint}>Study time, I saved your seat.</Text>
          </View>

          {/* Session cards */}
          <View style={styles.grid}>
            {SESSION_LENGTHS.map((opt) => {
              const isActive = selected === opt.minutes;
              return (
                <Pressable
                  key={opt.minutes}
                  style={[styles.card2, { width: cardWidth }, isActive && styles.cardActive]}
                  onPress={() => setSelected(opt.minutes)}>
                  {isActive && (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkIcon}>✓</Text>
                    </View>
                  )}
                  <Image source={CARD_IMG[opt.minutes]} style={styles.cardImg} resizeMode="contain" />
                  <Text style={styles.cardMin}>{opt.minutes}</Text>
                  <Text style={styles.cardMinLabel}>min</Text>
                  <View style={styles.ribbon}>
                    <Text style={styles.ribbonText}>{opt.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Subject selection */}
          <View style={styles.subjectSection}>
            <View style={styles.subjectHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Image source={BOOK_ICON} style={{ width: 18, height: 12 }} resizeMode="contain" />
                <Text style={styles.subjectTitle}>Subject (optional)</Text>
              </View>
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

          {/* Custom duration */}
          <Pressable
            style={styles.customRow}
            onPress={() => router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })}>
            <Image source={isPlus ? CUSTOM_BTN_PLUS : CUSTOM_BTN_LOCK} style={styles.customBtnImg} resizeMode="contain" />
          </Pressable>

          {/* Start button */}
          <Pressable
            style={({ pressed }) => [styles.startBtnWrap, pressed && styles.startBtnPressed]}
            onPress={startSession}>
            <ImageBackground source={START_BTN} style={styles.startBtn} resizeMode="stretch">
              <Text style={styles.startBtnText}>Start {selected} min Session</Text>
            </ImageBackground>
          </Pressable>

          {/* Back button */}
          <View style={styles.backRow}>
            <Pressable
              style={({ pressed }) => [pressed && styles.startBtnPressed]}
              onPress={() => router.back()}>
              <Image source={BACK_BTN} style={styles.backBtnImg} resizeMode="contain" />
            </Pressable>
          </View>

        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    maxHeight: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    paddingBottom: 24,
    paddingHorizontal: 44,
  },
  frameImage: { borderRadius: 28 },

  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 12 },

  header: { alignItems: 'center', gap: 1, paddingBottom: 2 },
  title: { fontSize: 18, fontWeight: '700', fontStyle: 'italic', color: '#E05878' },
  subtitle: { fontSize: 10, color: '#C4607A' },
  hint: { fontSize: 9, color: '#C4607A', opacity: 0.7 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },

  card2: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F4C2C8',
    paddingTop: 8,
    paddingBottom: 0,
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 115,
    shadowColor: '#E0789A',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardActive: {
    borderColor: '#E05878',
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,240,245,0.92)',
  },
  checkBadge: {
    position: 'absolute', top: 5, right: 5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E05878', alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 9, color: '#fff', fontWeight: '700' },
  cardImg: { width: 90, height: 90 },
  cardMin: { fontSize: 20, fontWeight: '700', color: '#C4607A', lineHeight: 24 },
  cardMinLabel: { fontSize: 8, color: '#C4607A', opacity: 0.75, marginBottom: 3 },
  ribbon: { width: '100%', backgroundColor: '#F4839A', paddingVertical: 3, alignItems: 'center' },
  ribbonText: { color: '#fff', fontWeight: '600', fontSize: 9 },

  subjectSection: { gap: 4, marginTop: 8 },
  subjectHeader: { gap: 1 },
  subjectTitle: { fontSize: 12, fontWeight: '600', color: '#C4607A' },
  subjectSub: { fontSize: 9, color: '#C4607A', opacity: 0.7 },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  chip: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, color: '#C4607A', fontWeight: '500' },
  skipText: { fontSize: 10, color: '#C4607A', opacity: 0.7, textAlign: 'right' },

  customRow: { alignItems: 'center' },
  customBtnImg: { width: 240, height: 110, alignSelf: 'center' },

  startBtnWrap: { alignSelf: 'center' },
  startBtn: {
    width: 250, height: 54,
    alignItems: 'center', justifyContent: 'center',
    paddingBottom: 8,
  },
  startBtnPressed: { opacity: 0.85 },
  startBtnText: {
    fontSize: 15, fontWeight: '700', color: '#fff',
    fontStyle: 'italic', fontFamily: 'Georgia', letterSpacing: 0.2,
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  backRow: { alignItems: 'center', paddingBottom: 4 },
  backBtnImg: { width: 64, height: 44 },
});
