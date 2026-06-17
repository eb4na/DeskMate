import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { playStudyMusic, stopStudyMusic } from '@/lib/ambience-audio';
import { StudyVinyl } from '@/components/study-vinyl';
import { SHOP_ITEMS } from '@/constants/shop-data';
import {
  connectSpotify,
  disconnectSpotify,
  markSpotifyAppOpened,
  spotifyConfigured,
  spotifyConnected,
  spotifyNext,
  spotifyPause,
  spotifyPrevious,
  spotifyResume,
  spotifySeek,
  subscribeSpotify,
  type Playback,
} from '@/lib/spotify';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const C = BakeryColors;

// Soft pastel green for the Spotify buttons (instead of Spotify's harsh #1DB954).
const SPOTIFY_GREEN = '#8FD3A8';
const SPOTIFY_GREEN_DEEP = '#3E8A60';

// Pickable vinyl disc colours (kept dark enough to contrast the pink label).
// The first is the default (= DEFAULTS.vinylColor in app-context).
const VINYL_COLORS = ['#3B3340', '#1E1B24', '#5A2A3A', '#2E3A59', '#2F4A3A', '#4A3528', '#5B4A6E', '#2C4A4E'];

// ── Drawn media glyphs (white, no emoji) ──
function Triangle({ dir }: { dir: 'left' | 'right' }) {
  return <View style={dir === 'right' ? glyph.triRight : glyph.triLeft} />;
}
function PlayGlyph() {
  return <Triangle dir="right" />;
}
function PauseGlyph() {
  return (
    <View style={glyph.pauseRow}>
      <View style={glyph.bar} />
      <View style={glyph.bar} />
    </View>
  );
}
function NextGlyph() {
  return (
    <View style={glyph.row}>
      <Triangle dir="right" />
      <View style={glyph.edge} />
    </View>
  );
}
function PrevGlyph() {
  return (
    <View style={glyph.row}>
      <View style={glyph.edge} />
      <Triangle dir="left" />
    </View>
  );
}

/**
 * Study radio panel (right-anchored). Pick a bought study sound, or connect Spotify
 * for full playback control (previous / play-pause / next) over your active device.
 */
export function SoundPickerModal({
  visible,
  onClose,
  playback,
  onRefresh,
}: {
  visible: boolean;
  onClose: () => void;
  // Now-playing + a re-poll trigger are owned by the study screen (so the radio
  // vinyl stays live after this popup closes, and the popup opens already in sync).
  playback: Playback | null;
  onRefresh: () => Promise<void> | void;
}) {
  const { ownedShopItems, equippedShopItems, setEquippedSound, isPlus, vinylColor, setVinylColor } = useApp();
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const sounds = SHOP_ITEMS.filter((i) => i.category === 'sound' && ownedShopItems.includes(i.id));
  const equipped = equippedShopItems.sound;

  const [connected, setConnected] = useState(spotifyConnected());
  const [connecting, setConnecting] = useState(false);
  // Inline status shown in the panel (root popups don't render over this modal).
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => subscribeSpotify(() => setConnected(spotifyConnected())), []);

  // Re-read now-playing shortly after a control action (Spotify needs a beat).
  const refresh = useCallback(() => onRefresh(), [onRefresh]);

  const handleConnect = async () => {
    setNotice(null);
    if (!isPlus) {
      // Spotify control is a Memobun Plus benefit (see plus-upgrade FEATURES).
      setNotice(t('soundPicker.spotifyPlus'));
      return;
    }
    if (!spotifyConfigured()) {
      setNotice(t('soundPicker.spotifySetup'));
      return;
    }
    setConnecting(true);
    const res = await connectSpotify();
    setConnecting(false);
    if (!res.ok) setNotice(t('soundPicker.spotifyFailed'));
    else refresh(); // pull now-playing right away so controls reflect it
  };

  // Fire a control, then re-read state shortly after (Spotify needs a beat).
  const control = async (fn: () => Promise<unknown>) => {
    await fn();
    setTimeout(refresh, 700);
  };

  // Jump to the Spotify app — to the current track (`spotify:track:…` URI) if we
  // have one, else just open Spotify; web fallback if the app isn't installed.
  const openInSpotify = () => {
    const url = playback?.uri || 'spotify://';
    // Tell the focus watcher we're stepping out on purpose, so the "come back"
    // nudge waits ~10s instead of firing the instant we background.
    markSpotifyAppOpened();
    Linking.openURL(url).catch(() => Linking.openURL('https://open.spotify.com').catch(() => {}));
  };

  // Scrub slider: `scrub` is the dragged fraction (0..1) while the finger is down,
  // else null and we show the live playback position.
  const [scrub, setScrub] = useState<number | null>(null);
  const trackW = useRef(0);
  const dur = playback?.durationMs ?? 0;
  const frac = scrub != null ? scrub : dur > 0 ? Math.min(1, (playback?.progressMs ?? 0) / dur) : 0;
  const fracFromX = (x: number) => Math.max(0, Math.min(1, trackW.current > 0 ? x / trackW.current : 0));
  const commitSeek = (x: number) => {
    const f = fracFromX(x);
    setScrub(null);
    if (dur > 0) { spotifySeek(f * dur); setTimeout(refresh, 700); }
  };
  const pct = `${Math.round(frac * 100)}%` as const;
  const fmtTime = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Which source the popup shows; the top-left button flips it. Always opens on the
  // study Sounds (the free default) — Spotify is a Plus-only extra you switch into.
  const [mode, setMode] = useState<'sounds' | 'spotify'>('sounds');

  // The big record's centre + whether it spins, per the shown source.
  const equippedSound = sounds.find((s) => s.id === equipped);
  const centerImage: number | { uri: string } | undefined =
    mode === 'spotify'
      ? playback?.coverUrl ? { uri: playback.coverUrl } : undefined
      : equippedSound?.image;
  const spinning = mode === 'spotify' ? !!playback?.isPlaying : equipped != null;

  // Remember the last-played study sound so the play button resumes it (rather than
  // always jumping to the first owned sound).
  const lastSoundRef = useRef<string | null>(equipped);
  useEffect(() => { if (equipped) lastSoundRef.current = equipped; }, [equipped]);

  // The record's spin gesture + the centre play/pause button toggle play/stop.
  // Spotify: pause/resume (or open the app when there's no active device). Study
  // sound: setEquippedSound is the source of truth (the study screen's effect plays
  // or stops the audio, and both vinyls spin off the equipped state).
  const handleSpin = () => {
    if (mode === 'spotify') {
      if (!isPlus) return; // Spotify is Plus-only — the locked panel handles the upsell
      if (playback?.hasDevice === false) { openInSpotify(); return; }
      control(playback?.isPlaying ? spotifyPause : spotifyResume);
      return;
    }
    if (equipped) { setEquippedSound(null); stopStudyMusic(); }
    else {
      const next = lastSoundRef.current ?? sounds[0]?.id ?? null;
      if (next) { setEquippedSound(next); playStudyMusic(next.replace('sound_', '')); }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={[styles.panel, isTablet && styles.panelTablet]}>
          {/* Top-left button: switch between shop music and Spotify */}
          <View style={styles.topRow}>
            <Pressable
              onPress={() => setMode((m) => (m === 'sounds' ? 'spotify' : 'sounds'))}
              style={({ pressed }) => [styles.modeToggle, pressed && styles.pressed]}>
              <Text style={styles.modeToggleText}>
                {mode === 'sounds' ? `♪  Spotify${isPlus ? '' : ' 🔒'}  →` : `←  ${t('soundPicker.title')}`}
              </Text>
            </Pressable>
          </View>

          {mode === 'sounds' ? (
            /* Record + centre play/pause on the left, owned shop sounds on the right */
            <View style={styles.soundsBody}>
              <View style={styles.vinylSide}>
                <StudyVinyl size={isTablet ? 200 : 140} playing={spinning} discColor={vinylColor} centerImage={centerImage} onSpin={handleSpin} />
                <Pressable onPress={handleSpin} style={({ pressed }) => [styles.playBtn, isTablet && styles.playBtnTablet, pressed && styles.pressed]} hitSlop={8}>
                  {spinning ? <PauseGlyph /> : <PlayGlyph />}
                </Pressable>
              </View>
              <View style={[styles.trackCol, isTablet && styles.trackColTablet]}>
                <ScrollView contentContainerStyle={styles.trackColContent} showsVerticalScrollIndicator={false}>
                  {sounds.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => { setEquippedSound(s.id); playStudyMusic(s.id.replace('sound_', '')); }}
                      style={[styles.trackBtn, isTablet && styles.trackBtnTablet, equipped === s.id && styles.trackBtnActive]}>
                      <Image source={s.image} style={[styles.trackIcon, isTablet && styles.trackIconTablet]} contentFit="contain" />
                    </Pressable>
                  ))}
                  {sounds.length === 0 && <Text style={styles.empty}>{t('soundPicker.empty')}</Text>}
                </ScrollView>
              </View>
            </View>
          ) : (
            /* Record centred, transport controls below */
            <View style={styles.spotifyBody}>
              <StudyVinyl size={isTablet ? 220 : 150} playing={spinning} discColor={vinylColor} centerImage={centerImage} onSpin={handleSpin} />
              {!isPlus ? (
                /* Spotify control is a Memobun Plus perk — non-Plus gets the upsell. */
                <View style={styles.spotifyControls}>
                  <Text style={styles.notice}>{t('soundPicker.spotifyPlus')}</Text>
                  <Pressable
                    onPress={() => { onClose(); router.push('/plus-upgrade'); }}
                    style={({ pressed }) => [styles.spotifyBtn, pressed && styles.pressed]}>
                    <Text style={styles.spotifyBtnText}>{t('plusUpgrade.upgrade')}</Text>
                  </Pressable>
                </View>
              ) : !connected ? (
                <View style={styles.spotifyControls}>
                  <Pressable onPress={handleConnect} disabled={connecting} style={({ pressed }) => [styles.spotifyBtn, pressed && styles.pressed]}>
                    <Text style={styles.spotifyBtnText}>{connecting ? t('soundPicker.connecting') : t('soundPicker.connectSpotify')}</Text>
                  </Pressable>
                  {notice ? <Text style={styles.notice}>{notice}</Text> : null}
                </View>
              ) : (
                <View style={styles.spotifyControls}>
                  <Pressable onPress={openInSpotify} style={({ pressed }) => [styles.nowPlaying, pressed && styles.pressed]}>
                    <Text style={styles.npTrack} numberOfLines={1}>
                      {playback?.track ?? (playback?.hasDevice === false ? t('soundPicker.noDevice') : t('soundPicker.connected'))}
                    </Text>
                    {!!playback?.artist && <Text style={styles.npArtist} numberOfLines={1}>{playback.artist}</Text>}
                    <Text style={styles.openSpotify}>{t('soundPicker.openInSpotify')} ↗</Text>
                  </Pressable>
                  {dur > 0 && (
                    <View style={styles.seekRow}>
                      <View
                        style={styles.seekTrack}
                        onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={(e) => setScrub(fracFromX(e.nativeEvent.locationX))}
                        onResponderMove={(e) => setScrub(fracFromX(e.nativeEvent.locationX))}
                        onResponderRelease={(e) => commitSeek(e.nativeEvent.locationX)}
                        onResponderTerminate={(e) => commitSeek(e.nativeEvent.locationX)}>
                        {/* pointer-transparent so drag `locationX` stays measured
                            against seekTrack, not the thumb/fill under the finger */}
                        <View style={styles.seekBar} pointerEvents="none">
                          <View style={[styles.seekFill, { width: pct }]} />
                          <View style={[styles.seekThumb, { left: pct }]} />
                        </View>
                      </View>
                      <View style={styles.seekTimes}>
                        <Text style={styles.seekTime}>{fmtTime(frac * dur)}</Text>
                        <Text style={styles.seekTime}>{fmtTime(dur)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.controls}>
                    <Pressable onPress={() => control(spotifyPrevious)} style={({ pressed }) => [styles.ctlBtn, pressed && styles.pressed]} hitSlop={6}>
                      <PrevGlyph />
                    </Pressable>
                    <Pressable onPress={handleSpin} style={({ pressed }) => [styles.ctlBtn, styles.ctlPrimary, pressed && styles.pressed]} hitSlop={6}>
                      {playback?.isPlaying ? <PauseGlyph /> : <PlayGlyph />}
                    </Pressable>
                    <Pressable onPress={() => control(spotifyNext)} style={({ pressed }) => [styles.ctlBtn, pressed && styles.pressed]} hitSlop={6}>
                      <NextGlyph />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => disconnectSpotify()} style={styles.disconnect}>
                    <Text style={styles.disconnectText}>{t('soundPicker.disconnect')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Vinyl colour picker — shared, along the bottom */}
          <View style={[styles.colorRow, isTablet && styles.colorRowTablet]}>
            {VINYL_COLORS.map((col) => {
              const selected = vinylColor === col;
              return (
                <Pressable
                  key={col}
                  onPress={() => setVinylColor(col)}
                  style={[styles.swatch, isTablet && styles.swatchTablet, { backgroundColor: col }, selected && styles.swatchSelected]}
                  hitSlop={4}>
                  {selected && <Text style={styles.swatchCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.doneBtn, isTablet && styles.doneBtnTablet, pressed && styles.pressed]}>
            <Text style={[styles.doneBtnText, isTablet && styles.doneBtnTextTablet]}>{t('common.done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const glyph = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  triRight: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFFFFF',
  },
  triLeft: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderRightWidth: 12,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#FFFFFF',
  },
  edge: { width: 3.5, height: 16, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  pauseRow: { flexDirection: 'row', gap: 4 },
  bar: { width: 4, height: 15, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
});

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(48,32,24,0.4)' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  panel: {
    width: '92%', maxWidth: 440, maxHeight: '90%', backgroundColor: C.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: C.shortbread,
    padding: Spacing.four, gap: Spacing.two, ...BakeryShadow,
  },
  // Tablet: a genuinely bigger box — wider card + more padding (inner sizes bump via isTablet).
  panelTablet: { maxWidth: 660, padding: Spacing.four + 8, gap: Spacing.three },
  title: { fontSize: 18, fontWeight: '900', color: C.cocoaDark, textAlign: 'center' },
  titleTablet: { fontSize: 26 },

  // Record + colour swatches (left) | tall button panel (right)
  vinylRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  vinylCol: { width: 150, alignItems: 'center', gap: Spacing.two },
  optionsPanel: {
    flex: 1,
    minHeight: 232,
    maxHeight: 320,
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    overflow: 'hidden',
  },
  // Tablet size bumps (applied via isTablet).
  vinylColTablet: { width: 230 },
  optionsPanelTablet: { minHeight: 360, maxHeight: 560 },
  rowTablet: { paddingVertical: 16, paddingHorizontal: Spacing.four },
  rowIconTablet: { width: 40, height: 40 },
  rowTextTablet: { fontSize: 20 },
  swatchRowTablet: { width: 230, gap: 10 },
  swatchTablet: { width: 36, height: 36, borderRadius: 18 },
  doneBtnTablet: { paddingVertical: 18 },
  doneBtnTextTablet: { fontSize: 20 },
  section: { fontSize: 13, fontWeight: '800', color: C.mocha, letterSpacing: 0.3, marginTop: 2 },
  empty: { fontSize: 13, color: C.mocha, lineHeight: 19, paddingVertical: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: C.shortbread, paddingHorizontal: Spacing.three, paddingVertical: 11,
  },
  rowActive: { borderColor: C.jam, backgroundColor: C.jam + '1A' },
  rowIcon: { width: 28, height: 28 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700', color: C.cocoaDark },
  check: { fontSize: 16, fontWeight: '900', color: C.berry },
  rule: { height: 1.5, backgroundColor: C.shortbread, marginVertical: Spacing.one, borderRadius: 1 },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', width: 150 },
  swatch: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    ...BakeryShadow,
  },
  swatchSelected: { borderColor: C.berry, borderWidth: 3 },
  swatchCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  spotifyBtn: { backgroundColor: '#F4A0A8', borderRadius: BakeryRadii.button, paddingVertical: 13, alignItems: 'center' },
  spotifyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  note: { fontSize: 11.5, color: C.mocha, lineHeight: 16 },
  notice: { fontSize: 12.5, color: C.berry, fontWeight: '700', lineHeight: 17 },

  nowPlaying: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: BakeryRadii.card, borderWidth: 1.5, borderColor: C.shortbread, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  seekRow: { alignSelf: 'stretch', paddingTop: 8, gap: 4 },
  // Transparent wrapper with vertical padding = a generous touch target around the
  // thin bar. Its width (measured via onLayout) maps 1:1 to the bar below it.
  seekTrack: { paddingVertical: 10, justifyContent: 'center' },
  seekBar: { height: 6, borderRadius: 3, backgroundColor: C.shortbread },
  seekFill: { position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3, backgroundColor: C.jam },
  seekThumb: { position: 'absolute', top: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: C.jam, borderWidth: 2, borderColor: '#fff', marginLeft: -7, ...BakeryShadow },
  seekTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  seekTime: { fontSize: 11, fontWeight: '700', color: C.mocha },
  npTrack: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  npArtist: { fontSize: 12, color: C.mocha, marginTop: 2 },
  openSpotify: { fontSize: 11.5, color: '#1DB954', fontWeight: '800', marginTop: 6 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
  ctlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F4A0A8', alignItems: 'center', justifyContent: 'center' },
  ctlPrimary: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F4A0A8' },
  disconnect: { alignItems: 'center', paddingVertical: 6 },
  disconnectText: { fontSize: 13, fontWeight: '700', color: C.mocha },

  doneBtn: { paddingVertical: 13, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: '#F7A7B8' },
  doneBtnText: { fontSize: 15, fontWeight: '900', color: C.cocoaDark },
  pressed: { opacity: 0.85 },

  // ── Redesigned player ──
  // Top-left source toggle (shop music ⇄ Spotify)
  topRow: { flexDirection: 'row', alignItems: 'center' },
  modeToggle: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 14, paddingVertical: 8,
  },
  modeToggleText: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },

  // Sounds view: record + play/pause on the left, owned sounds on the right
  soundsBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  vinylSide: { flex: 1, alignItems: 'center', gap: Spacing.two },
  playBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F4A0A8',
    alignItems: 'center', justifyContent: 'center', ...BakeryShadow,
  },
  playBtnTablet: { width: 60, height: 60, borderRadius: 30 },
  trackCol: { width: 78, maxHeight: 264 },
  trackColTablet: { width: 104, maxHeight: 372 },
  trackColContent: { gap: Spacing.two, alignItems: 'center', paddingVertical: 2 },
  trackBtn: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: C.shortbread, alignItems: 'center', justifyContent: 'center',
  },
  trackBtnTablet: { width: 88, height: 88, borderRadius: 20 },
  trackBtnActive: { borderColor: C.jam, backgroundColor: C.jam + '1A' },
  trackIcon: { width: 44, height: 44 },
  trackIconTablet: { width: 60, height: 60 },

  // Spotify view: record centred with the transport controls below
  spotifyBody: { alignItems: 'center', gap: Spacing.two },
  spotifyControls: { width: '100%', alignItems: 'center', gap: Spacing.two },

  // Shared colour picker along the bottom
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: Spacing.two },
  colorRowTablet: { gap: 12 },
});
