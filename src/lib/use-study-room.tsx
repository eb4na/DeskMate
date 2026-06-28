import { router } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { showPopup } from '@/lib/popup';

import { useApp } from '@/context/app-context';
import { joinGameRoom, newRoomId, type GameRoom } from '@/lib/game-net';
import {
  getPlayback,
  spotifyConnected,
  subscribeSpotify,
} from '@/lib/spotify';

// A synced multiplayer study room: friends study together with one shared timer
// and live studying/break status. Built on the same realtime layer as the
// BatterDash party. The connection lives here (mounted in the root layout) so it
// survives the lobby → home transition.

export const STUDY_ROOM_MAX = 3;

// How long a player can drop out of presence (a transient Supabase reconnect /
// network blip) before the host actually evicts them from the roster. Without
// this grace window a momentary flicker silently kicks a guest mid-session.
const PRESENCE_GRACE_MS = 6000;

export type StudyStatus = 'studying' | 'break' | 'idle';
export type StudyRosterEntry = {
  code: string;
  name: string;
  isHost: boolean;
  companionId?: string;
  skinId?: string;
  avatarFrame?: string;
  // Whether this member has Plus. Synced so the lobby can offer the custom-timer
  // selector to everyone in the room when the HOST has Plus (a host perk shared
  // with their guests — guests still can't save presets).
  isPlus?: boolean;
  // Each player's lobby choices, synced so everyone's avatar can show them.
  // `minutes` = their chosen session length; `topic` = their chosen subject name
  // (null/undefined = not chosen yet → they still pick a subject in-session).
  minutes?: number;
  topic?: string | null;
};

export type StudyStartOpts = {
  durationMinutes: number;
  subjectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
};

type StudyRoomValue = {
  active: boolean; // a room connection exists
  begun: boolean; // the synced session has started (host pressed Start)
  isHost: boolean;
  myCode: string;
  roster: StudyRosterEntry[];
  statusMap: Record<string, StudyStatus>;
  presentCodes: string[];
  netStatus: string;
  roomId: string | null;
  hostBackgroundId: string | null;
  hostDeskId: string | null;
  // Host radio for the bundled study sounds: when a PLUS host shares, every guest
  // plays the host's equipped study sound instead of their own (mirrors the Spotify
  // host-radio for the in-app ambience). `hostSoundShared` distinguishes "a Plus host
  // is sharing" (true) from "no sharing host" (false) — the former with a null
  // `hostSoundId` means the host has its sound OFF, so guests go quiet too.
  hostSoundShared: boolean;
  hostSoundId: string | null;
  // Host's disco ("Spotify background") mode, synced to every guest. `hostDiscoOn` =
  // a Plus host has it on; `hostDiscoColor` = black/white; `hostCoverUrl` = the host's
  // current album cover (or null) to show on the disco vinyl.
  hostDiscoOn: boolean;
  hostDiscoColor: 'black' | 'white';
  hostCoverUrl: string | null;
  hostPlaying: boolean;
  canStartSelf: boolean;
  joinRoom: (roomId: string, isHost: boolean) => void;
  leaveRoom: () => void;
  start: (opts: StudyStartOpts) => void;
  // Promote a running SOLO session into a hosted room (no lobby) so the studier can
  // invite friends in mid-session. Returns the new room id. See the implementation.
  hostFromSolo: (opts: StudyStartOpts) => string;
  // A guest joining an already-running room starts their own session on their own
  // clock (no broadcast). Used by the lobby's late-joiner Start button.
  startSelf: (opts: StudyStartOpts) => void;
  setStatus: (s: StudyStatus) => void;
  // Each player picks their own session length + topic up front in the lobby; the
  // host only triggers the synchronized start. The choice is broadcast so everyone's
  // avatar shows it, and each player then studies for their own duration/topic.
  setMyPrefs: (minutes: number, topic: string | null) => void;
};

const StudyRoomContext = createContext<StudyRoomValue | null>(null);

export function StudyRoomProvider({ children }: { children: ReactNode }) {
  const {
    friendCode,
    profileDisplayName,
    activeCompanionId,
    companionSkins,
    bunSkinId,
    startActiveSession,
    equippedBackgroundRoomId,
    equippedDeskRoomId,
    equippedShopItems,
    isPlus,
    profileAvatarFrame,
    spotifyBgEnabled,
    spotifyBgColor,
  } = useApp();

  const myCode = friendCode;
  const myName = profileDisplayName || `Player ${friendCode}`;
  // Avatar identity in the form getCompanionImage(companionId, skinId) expects.
  const isShopCompanion = !!activeCompanionId && activeCompanionId.startsWith('shop:');
  const myCompanionId = isShopCompanion ? activeCompanionId : undefined;
  const mySkinId = isShopCompanion ? companionSkins?.[activeCompanionId] ?? 'classic' : bunSkinId;

  const room = useRef<GameRoom | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [begun, setBegun] = useState(false);
  const [roster, setRoster] = useState<StudyRosterEntry[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, StudyStatus>>({});
  const [presentCodes, setPresentCodes] = useState<string[]>([]);
  const [netStatus, setNetStatus] = useState('');
  // Host's room — everyone in the room studies with the host's background + desk.
  const [hostBackgroundId, setHostBackgroundId] = useState<string | null>(null);
  const [hostDeskId, setHostDeskId] = useState<string | null>(null);
  // Host radio (bundled study sounds): a Plus host broadcasts its equipped sound so
  // every guest plays the same one. `hostSoundShared` flips true once any broadcast
  // arrives (→ guest overrides their own sound); `hostSoundId` is the shared sound's
  // shop id, or null when the host has its sound turned off (guests go quiet too).
  const [hostSoundShared, setHostSoundShared] = useState(false);
  const [hostSoundId, setHostSoundId] = useState<string | null>(null);
  // Host "Spotify background" (disco) mode: a Plus host broadcasts whether it's on +
  // the chosen colour, so EVERY guest (Plus or not) shows the same disco scene. The
  // host's now-playing cover (synced on the `spotify` channel below) fills the disco
  // vinyl. Display-only → no Plus/Premium needed on the guest to SEE it.
  const [hostDiscoOn, setHostDiscoOn] = useState(false);
  const [hostDiscoColor, setHostDiscoColor] = useState<'black' | 'white'>('black');
  const [hostCoverUrl, setHostCoverUrl] = useState<string | null>(null);
  // Whether the host's music is PLAYING (vs paused), synced so a guest's disco scene
  // matches the host's: paused = characters stop bouncing + vinyl stops, cover stays.
  const [hostPlaying, setHostPlaying] = useState(true);
  // True only for a late joiner (joined a room that's already running): the lobby
  // shows them a "Start studying" button to begin on their own clock.
  const [canStartSelf, setCanStartSelf] = useState(false);
  // Spotify "host radio": the host broadcasts its now-playing track so every
  // player whose own Spotify is connected mirrors the same song. Local connection
  // flag (kept live) so a mid-session connect starts broadcasting / starts mirroring.
  const [spotifyOn, setSpotifyOn] = useState(spotifyConnected());
  useEffect(() => subscribeSpotify(() => setSpotifyOn(spotifyConnected())), []);
  // Participant change-detection: the last track URI + play state we applied, so we
  // only call Spotify on a real change (never re-seek every broadcast tick).
  const mirrorRef = useRef<{ uri: string | null; playing: boolean }>({ uri: null, playing: false });

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  // This player's own chosen session length (null until they pick one → falls
  // back to the host's broadcast duration) and topic/subject (null = not chosen,
  // so they pick a subject in-session). Read synchronously when the session begins,
  // so a player's own session is never blocked on the prefs round-trip.
  const myPreferredMinutes = useRef<number | null>(null);
  const myTopic = useRef<string | null>(null);
  const beginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of `begun` for synchronous reads inside the realtime closure, plus the
  // last begin payload so the host can re-sync a late joiner.
  const begunRef = useRef(false);
  const lastBeginRef = useRef<{ startAt: number; opts: StudyStartOpts; bgRoomId: string | null; deskRoomId: string | null } | null>(null);
  // Synchronous roster mirror so the host can enforce the 3-person cap without
  // racing React state.
  const rosterRef = useRef<StudyRosterEntry[]>([]);
  // Latest present codes (host reads this live inside grace-period removal timers
  // so a member who reappeared before the timer fires isn't evicted), plus the
  // per-code pending-removal timers themselves.
  const presentCodesRef = useRef<string[]>([]);
  const removalTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Host migration: if the host disappears, a guest waits out this same grace window
  // (to ignore flickers) before electing a replacement.
  const hostMigrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRemovalTimers = () => {
    Object.values(removalTimers.current).forEach(clearTimeout);
    removalTimers.current = {};
    if (hostMigrateTimer.current) { clearTimeout(hostMigrateTimer.current); hostMigrateTimer.current = null; }
  };
  // Latest identity, so the realtime closure (created on join) reads current values.
  const meRef = useRef({ myCode, myName, myCompanionId, mySkinId, myAvatarFrame: profileAvatarFrame, myIsPlus: isPlus, bgRoomId: equippedBackgroundRoomId, deskRoomId: equippedDeskRoomId });
  meRef.current = { myCode, myName, myCompanionId, mySkinId, myAvatarFrame: profileAvatarFrame, myIsPlus: isPlus, bgRoomId: equippedBackgroundRoomId, deskRoomId: equippedDeskRoomId };
  const startRef = useRef(startActiveSession);
  startRef.current = startActiveSession;

  const broadcastRoster = (next: StudyRosterEntry[]) => {
    room.current?.send('roster', { players: next });
  };

  // Schedule the synced session start for `startAt` and head to the home screen.
  const applyBegin = (startAt: number, opts: StudyStartOpts) => {
    setBegun(true);
    begunRef.current = true;
    if (beginTimer.current) clearTimeout(beginTimer.current);
    const delay = Math.max(0, startAt - Date.now());
    beginTimer.current = setTimeout(() => {
      startRef.current({
        durationMinutes: opts.durationMinutes,
        // Each player's own lobby topic (null → they pick a subject in-session).
        subjectName: opts.subjectName ?? null,
        taskId: opts.taskId,
        taskTitle: opts.taskTitle,
        startedAt: new Date(startAt).toISOString(),
        isMultiplayer: true,
      });
      // The lobby (and any pickers) are presented as modals over the tabs. Pop
      // them so the session takes over the real full-screen Home, rather than
      // rendering Home *inside* the modal (which reads as a popup sheet).
      if (router.canDismiss()) router.dismissAll();
      else router.replace('/');
    }, delay);
  };
  const applyBeginRef = useRef(applyBegin);
  applyBeginRef.current = applyBegin;

  const joinRoom = (id: string, host: boolean) => {
    // Tear down any previous connection first.
    room.current?.leave();
    if (beginTimer.current) clearTimeout(beginTimer.current);
    clearRemovalTimers();
    presentCodesRef.current = [];
    setRoomId(id);
    setIsHost(host);
    setBegun(false);
    setStatusMap({});
    setPresentCodes([]);
    setHostBackgroundId(host ? meRef.current.bgRoomId : null);
    setHostDeskId(host ? meRef.current.deskRoomId : null);
    setHostSoundShared(false);
    setHostSoundId(null);
    setHostDiscoOn(false);
    setHostDiscoColor('black');
    setHostCoverUrl(null);
    setHostPlaying(true);
    myPreferredMinutes.current = null;
    myTopic.current = null;
    begunRef.current = false;
    lastBeginRef.current = null;
    setCanStartSelf(false);
    mirrorRef.current = { uri: null, playing: false };
    const me = meRef.current;
    const initialRoster = [{ code: me.myCode, name: me.myName, isHost: host, companionId: me.myCompanionId, skinId: me.mySkinId, avatarFrame: me.myAvatarFrame, isPlus: me.myIsPlus }];
    rosterRef.current = initialRoster;
    setRoster(initialRoster);

    room.current = joinGameRoom(
      id,
      host,
      {
        onStatus: (s) => {
          setNetStatus(s);
          if (s === 'SUBSCRIBED') {
            const m = meRef.current;
            // Carry any prefs already chosen (e.g. the lobby's default minutes) so the
            // host seeds my roster entry — `prefs` messages then handle live changes.
            room.current?.send('hello', {
              code: m.myCode, name: m.myName, companionId: m.myCompanionId, skinId: m.mySkinId, avatarFrame: m.myAvatarFrame, isPlus: m.myIsPlus,
              minutes: myPreferredMinutes.current ?? undefined,
              topic: myTopic.current ?? undefined,
            });
          }
        },
        onPresence: () => {},
        onPresenceCodes: (codes) => {
          setPresentCodes(codes);
          presentCodesRef.current = codes;
          const myCodeNow = meRef.current.myCode;
          // ── Host migration ────────────────────────────────────────────────────
          // If the roster's host is no longer present, the remaining members elect a
          // replacement DETERMINISTICALLY (the smallest still-present code) so every
          // client agrees without coordinating — effectively a "random" survivor. The
          // elected client promotes itself and takes over the authoritative roster;
          // the others adopt its next broadcast. Guarded by the same grace window as
          // eviction so a brief host flicker never triggers a needless handover.
          if (!isHostRef.current) {
            const hostEntry = rosterRef.current.find((e) => e.isHost);
            const hostPresent = !hostEntry || hostEntry.code === myCodeNow || codes.includes(hostEntry.code);
            if (hostPresent) {
              if (hostMigrateTimer.current) { clearTimeout(hostMigrateTimer.current); hostMigrateTimer.current = null; }
            } else if (!hostMigrateTimer.current) {
              hostMigrateTimer.current = setTimeout(() => {
                hostMigrateTimer.current = null;
                const live = presentCodesRef.current;
                const hostE = rosterRef.current.find((e) => e.isHost);
                if (!hostE || hostE.code === myCodeNow || live.includes(hostE.code)) return; // host came back
                const survivors = rosterRef.current
                  .filter((e) => e.code === myCodeNow || live.includes(e.code))
                  .map((e) => e.code)
                  .sort();
                if (survivors[0] !== myCodeNow) return; // a different survivor is the elected host
                // I'm elected — promote to host and take over the roster (dropping the
                // departed host). The session's room/desk stay as the original host set them.
                isHostRef.current = true;
                setIsHost(true);
                const next = rosterRef.current
                  .filter((e) => e.code === myCodeNow || live.includes(e.code))
                  .map((e) => ({ ...e, isHost: e.code === myCodeNow }));
                rosterRef.current = next;
                setRoster(next);
                broadcastRoster(next);
              }, PRESENCE_GRACE_MS);
            }
          }
          if (!isHostRef.current) {
            // Guest self-heal: if I'm present in the room but I'm missing from the
            // host's roster (it dropped me on a presence flicker, or my own channel
            // just reconnected), re-announce so the host re-adds me. Targeted to the
            // actual mismatch so a healthy guest never re-floods `hello`.
            if (codes.includes(myCodeNow) && !rosterRef.current.some((e) => e.code === myCodeNow)) {
              const m = meRef.current;
              room.current?.send('hello', {
                code: m.myCode, name: m.myName, companionId: m.myCompanionId, skinId: m.mySkinId, avatarFrame: m.myAvatarFrame, isPlus: m.myIsPlus,
                minutes: myPreferredMinutes.current ?? undefined,
                topic: myTopic.current ?? undefined,
              });
            }
            return;
          }
          // Host: anyone who's (re)appeared cancels their pending eviction.
          for (const code of codes) {
            if (removalTimers.current[code]) {
              clearTimeout(removalTimers.current[code]);
              delete removalTimers.current[code];
            }
          }
          // Anyone now absent gets a grace timer rather than an immediate kick. The
          // timer re-checks LIVE presence (presentCodesRef) before removing, so a
          // transient flicker that resolves within PRESENCE_GRACE_MS leaves the
          // roster untouched (no churned broadcast, no avatar blink for anyone).
          rosterRef.current.forEach((e) => {
            if (e.code === myCodeNow || codes.includes(e.code) || removalTimers.current[e.code]) return;
            removalTimers.current[e.code] = setTimeout(() => {
              delete removalTimers.current[e.code];
              if (presentCodesRef.current.includes(e.code)) return; // came back in time
              const prev = rosterRef.current;
              const next = prev.filter((r) => r.code !== e.code);
              if (next.length !== prev.length) {
                rosterRef.current = next;
                setRoster(next);
                broadcastRoster(next);
              }
            }, PRESENCE_GRACE_MS);
          });
        },
        onMessage: (type, data) => {
          if (type === 'hello') {
            if (!isHostRef.current) return;
            const d = data as { code: string; name: string; companionId?: string; skinId?: string; avatarFrame?: string; isPlus?: boolean; minutes?: number; topic?: string | null };
            const prev = rosterRef.current;
            const exists = prev.some((e) => e.code === d.code);
            // Cap the room at STUDY_ROOM_MAX — tell the newcomer so they get feedback.
            if (!exists && prev.length >= STUDY_ROOM_MAX) {
              room.current?.send('room_full', {});
              return;
            }
            // Only overwrite minutes/topic when the hello actually carries them, so a
            // reconnect sent before re-picking can't blank a choice already synced.
            const next = exists
              ? prev.map((e) => (e.code === d.code ? {
                  ...e, name: d.name, companionId: d.companionId, skinId: d.skinId, avatarFrame: d.avatarFrame, isPlus: d.isPlus,
                  ...(d.minutes !== undefined ? { minutes: d.minutes } : {}),
                  ...(d.topic !== undefined ? { topic: d.topic } : {}),
                } : e))
              : [...prev, { code: d.code, name: d.name, isHost: false, companionId: d.companionId, skinId: d.skinId, avatarFrame: d.avatarFrame, isPlus: d.isPlus, minutes: d.minutes, topic: d.topic }];
            rosterRef.current = next;
            setRoster(next);
            broadcastRoster(next);
            setTimeout(() => broadcastRoster(next), 400); // beat the subscribe race
            // If the session is already running, re-send `begin` so this late joiner
            // learns the room is live (and gets the host's room/desk). The `resend`
            // flag tells them NOT to auto-sync — they pick their own length + Start.
            // Existing members ignore it (their begunRef is already true).
            if (begunRef.current && lastBeginRef.current) {
              const b = lastBeginRef.current;
              room.current?.send('begin', { startAt: b.startAt, ...b.opts, bgRoomId: b.bgRoomId, deskRoomId: b.deskRoomId, resend: true });
            }
          } else if (type === 'roster') {
            const players = (data as { players: StudyRosterEntry[] }).players;
            rosterRef.current = players;
            setRoster(players);
          } else if (type === 'prefs') {
            // A guest changed their lobby minutes/topic — the host folds it into the
            // authoritative roster and re-broadcasts so everyone's avatar updates.
            if (!isHostRef.current) return;
            const d = data as { code: string; minutes?: number; topic?: string | null };
            const prev = rosterRef.current;
            const next = prev.map((e) => (e.code === d.code ? { ...e, minutes: d.minutes, topic: d.topic } : e));
            rosterRef.current = next;
            setRoster(next);
            broadcastRoster(next);
          } else if (type === 'status') {
            const d = data as { code: string; status: StudyStatus };
            setStatusMap((prev) => ({ ...prev, [d.code]: d.status }));
          } else if (type === 'hostsound') {
            // Plus host is sharing its bundled study sound → mirror it (guests play
            // the host's sound instead of their own). The host ignores its own echo.
            if (isHostRef.current) return;
            const d = data as { soundId?: string | null };
            setHostSoundShared(true);
            setHostSoundId(d.soundId ?? null);
          } else if (type === 'discobg') {
            // Plus host toggled disco mode / colour → every guest mirrors it (display
            // only, so a guest needs neither Plus nor Spotify to SEE the disco scene).
            if (isHostRef.current) return;
            const d = data as { on?: boolean; color?: 'black' | 'white' };
            setHostDiscoOn(!!d.on);
            setHostDiscoColor(d.color === 'white' ? 'white' : 'black');
          } else if (type === 'spotify') {
            // Sync the host's COVER + play/pause state for the shared disco BACKGROUND
            // disk only — the AUDIO is no longer mirrored (each studier plays their own
            // song). It's just an image + a flag, so no Plus/Spotify needed to see it.
            if (isHostRef.current) return;
            const d = data as { coverUrl?: string | null; isPlaying?: boolean };
            setHostCoverUrl(d.coverUrl ?? null);
            setHostPlaying(d.isPlaying ?? true);
          } else if (type === 'begin') {
            // The host pressed Start — the synced session begins for EVERYONE in the
            // room at once. Each present member auto-applies `begin` (on their own
            // chosen length + topic; the host's start only sets the shared start
            // moment). Idempotent: applied once per member. A re-sent begin (the host
            // re-announcing to a late joiner) is the exception — they get a Start
            // button and begin on their own clock instead of being pulled in.
            if (begunRef.current) return;
            const d = data as { startAt: number; durationMinutes: number; subjectName: string | null; taskId: string | null; taskTitle: string | null; bgRoomId?: string | null; deskRoomId?: string | null; resend?: boolean };
            begunRef.current = true;
            setBegun(true);
            if (d.bgRoomId !== undefined) setHostBackgroundId(d.bgRoomId);
            if (d.deskRoomId !== undefined) setHostDeskId(d.deskRoomId);
            lastBeginRef.current = {
              startAt: d.startAt,
              opts: { durationMinutes: d.durationMinutes, subjectName: d.subjectName, taskId: d.taskId, taskTitle: d.taskTitle },
              bgRoomId: d.bgRoomId ?? null,
              deskRoomId: d.deskRoomId ?? null,
            };
            if (d.resend) {
              // Late joiner: the room is already running. Don't auto-apply — surface
              // a Start button so they begin on their own clock (startSelf).
              setCanStartSelf(true);
              return;
            }
            applyBeginRef.current(d.startAt, {
              // Each player studies for their own chosen length + topic; the host's
              // start only sets the shared start moment. Minutes fall back to the
              // host's if unset; topic falls back to null (→ pick a subject in-session).
              durationMinutes: myPreferredMinutes.current ?? d.durationMinutes,
              subjectName: myTopic.current ?? null,
              taskId: d.taskId,
              taskTitle: d.taskTitle,
            });
          } else if (type === 'leave') {
            const code = (data as { code: string }).code;
            if (!isHostRef.current) return;
            const prev = rosterRef.current;
            const next = prev.filter((e) => e.code !== code);
            if (next.length !== prev.length) {
              rosterRef.current = next;
              setRoster(next);
              broadcastRoster(next);
            }
          } else if (type === 'room_full') {
            if (isHostRef.current) return;
            room.current?.leave();
            room.current = null;
            showPopup("Room is full", `This study room already has ${STUDY_ROOM_MAX} players. Try again when someone leaves.`);
            if (router.canDismiss()) router.dismiss();
          }
        },
      },
      { code: myCode },
    );
  };

  const leaveRoom = () => {
    const m = meRef.current;
    const r = room.current;
    r?.send('leave', { code: m.myCode });
    // Let the `leave` broadcast actually flush before tearing the channel down.
    // `send` is an async websocket push but `leave()` (removeChannel) is synchronous,
    // so calling them back-to-back kills the push — the host never hears it and only
    // evicts us ~6s later via the PRESENCE_GRACE_MS presence-drop fallback. Deferring
    // the teardown (same trick as sendInvite) makes a leave register near-instantly.
    setTimeout(() => r?.leave(), 350);
    room.current = null;
    if (beginTimer.current) clearTimeout(beginTimer.current);
    clearRemovalTimers();
    presentCodesRef.current = [];
    setRoomId(null);
    setIsHost(false);
    setBegun(false);
    begunRef.current = false;
    lastBeginRef.current = null;
    rosterRef.current = [];
    setCanStartSelf(false);
    mirrorRef.current = { uri: null, playing: false };
    setRoster([]);
    setStatusMap({});
    setPresentCodes([]);
    setHostBackgroundId(null);
    setHostDeskId(null);
    setHostSoundShared(false);
    setHostSoundId(null);
    setHostDiscoOn(false);
    setHostDiscoColor('black');
    setHostCoverUrl(null);
    setHostPlaying(true);
  };

  const start = (opts: StudyStartOpts) => {
    if (!isHostRef.current) return;
    const startAt = Date.now() + 800;
    const bgRoomId = meRef.current.bgRoomId;
    const deskRoomId = meRef.current.deskRoomId;
    setHostBackgroundId(bgRoomId);
    setHostDeskId(deskRoomId);
    begunRef.current = true;
    lastBeginRef.current = { startAt, opts, bgRoomId, deskRoomId };
    room.current?.send('begin', { startAt, ...opts, bgRoomId, deskRoomId });
    applyBeginRef.current(startAt, opts);
  };

  // A guest's own start when they join a room that's ALREADY running: they study
  // on their own clock (their picked length), no broadcast. Reuses applyBegin
  // (which dismisses the lobby → full-screen Home).
  const startSelf = (opts: StudyStartOpts) => {
    const startAt = Date.now() + 300;
    applyBeginRef.current(startAt, opts);
  };

  // Promote a running SOLO session into a hosted multiplayer room WITHOUT going
  // through the lobby. The host keeps studying on their CURRENT clock — we never
  // call applyBegin here — we just open a room and mark it ALREADY-running
  // (begunRef + lastBeginRef) so any friend who accepts the invite arrives as a
  // late joiner: the `hello` handler re-sends `begin` (resend), they pick their own
  // length and Start on their own clock, exactly like joining a room mid-session.
  // Returns the new room id so the invite screen can address it.
  const hostFromSolo = (opts: StudyStartOpts): string => {
    const id = newRoomId();
    joinRoom(id, true); // resets begun=false; we flip it back on right below
    const bgRoomId = meRef.current.bgRoomId;
    const deskRoomId = meRef.current.deskRoomId;
    setHostBackgroundId(bgRoomId);
    setHostDeskId(deskRoomId);
    begunRef.current = true;
    setBegun(true);
    lastBeginRef.current = { startAt: Date.now(), opts, bgRoomId, deskRoomId };
    return id;
  };

  const setStatus = (s: StudyStatus) => {
    setStatusMap((prev) => ({ ...prev, [meRef.current.myCode]: s }));
    room.current?.send('status', { code: meRef.current.myCode, status: s });
  };

  const setMyPrefs = (minutes: number, topic: string | null) => {
    myPreferredMinutes.current = minutes;
    myTopic.current = topic;
    const code = meRef.current.myCode;
    // Optimistically update my own roster entry so my avatar reflects the choice
    // instantly on my screen, independent of the network round-trip.
    setRoster((prev) => {
      const next = prev.map((e) => (e.code === code ? { ...e, minutes, topic } : e));
      if (isHostRef.current) {
        rosterRef.current = next;
        broadcastRoster(next);
      }
      return next;
    });
    // Guests tell the host, which folds it into the authoritative roster + rebroadcasts.
    if (!isHostRef.current) {
      room.current?.send('prefs', { code, minutes, topic });
    }
  };

  // Host radio broadcast: while the host's synced session is live and their own
  // Spotify is connected (connecting is Plus-gated; control needs Premium), poll
  // now-playing and push it to the room every ~5s so connected players mirror the
  // same song. Gated on isPlus per spec; tears down on session end / leave / disconnect.
  useEffect(() => {
    if (!isHost || !begun || !isPlus || !spotifyOn) return;
    let cancelled = false;
    const tick = async () => {
      const pb = await getPlayback();
      if (cancelled || !pb) return;
      room.current?.send('spotify', {
        uri: pb.uri,
        positionMs: pb.progressMs ?? 0,
        isPlaying: pb.isPlaying,
        ts: Date.now(),
        // Album cover for guests' disco vinyl (display only — no Premium needed there).
        coverUrl: pb.coverUrl ?? null,
      });
    };
    tick();
    // 2s so a guest's disco scene reflects the host's play/pause quickly (the cover +
    // playing flag drive the shared backdrop's spin + character bounce).
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isHost, begun, isPlus, spotifyOn]);

  // Host radio for the bundled study sounds: while a PLUS host's synced session is
  // live, broadcast its equipped study sound so every guest plays the same one.
  // Re-runs on sound change AND on roster changes (`roster.length`) so a late joiner
  // — who just subscribed — gets the current sound from the fresh closure. Sending
  // even a null sound (host turned it off) keeps guests in sync (they go quiet too).
  useEffect(() => {
    if (!isHost || !begun || !isPlus) return;
    room.current?.send('hostsound', { soundId: equippedShopItems.sound ?? null });
  }, [isHost, begun, isPlus, equippedShopItems.sound, roster.length]);

  // Host disco ("Spotify background") broadcast: a Plus host pushes its on/off + colour
  // so every guest mirrors the disco scene (display only — guests need no Plus/Premium
  // to see it). Re-runs on toggle/colour change AND roster change (late-joiner re-sync).
  useEffect(() => {
    if (!isHost || !begun || !isPlus) return;
    room.current?.send('discobg', { on: spotifyBgEnabled, color: spotifyBgColor });
  }, [isHost, begun, isPlus, spotifyBgEnabled, spotifyBgColor, roster.length]);

  // Clean up the connection if the provider ever unmounts (app teardown).
  useEffect(() => {
    return () => {
      room.current?.leave();
      if (beginTimer.current) clearTimeout(beginTimer.current);
      clearRemovalTimers();
    };
  }, []);

  const value = useMemo<StudyRoomValue>(
    () => ({
      active: roomId !== null,
      begun,
      isHost,
      myCode,
      roster,
      statusMap,
      presentCodes,
      netStatus,
      roomId,
      hostBackgroundId,
      hostDeskId,
      hostSoundShared,
      hostSoundId,
      hostDiscoOn,
      hostDiscoColor,
      hostCoverUrl,
      hostPlaying,
      canStartSelf,
      joinRoom,
      leaveRoom,
      start,
      hostFromSolo,
      startSelf,
      setStatus,
      setMyPrefs,
    }),
    // joinRoom/leaveRoom/start/setStatus are stable enough (read refs); deps are the state they expose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, begun, isHost, myCode, roster, statusMap, presentCodes, netStatus, hostBackgroundId, hostDeskId, hostSoundShared, hostSoundId, hostDiscoOn, hostDiscoColor, hostCoverUrl, hostPlaying, canStartSelf],
  );

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom(): StudyRoomValue {
  const v = useContext(StudyRoomContext);
  if (!v) throw new Error('useStudyRoom must be used inside StudyRoomProvider');
  return v;
}
