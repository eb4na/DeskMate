import { router } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '@/context/app-context';
import { joinGameRoom, type GameRoom } from '@/lib/game-net';
import {
  getPlayback,
  playTrackAt,
  spotifyConnected,
  spotifyPause,
  spotifyResume,
  subscribeSpotify,
} from '@/lib/spotify';

// A synced multiplayer study room: friends study together with one shared timer
// and live studying/break status. Built on the same realtime layer as the
// BatterDash party. The connection lives here (mounted in the root layout) so it
// survives the lobby → home transition.

export type StudyStatus = 'studying' | 'break' | 'idle';
export type StudyRosterEntry = {
  code: string;
  name: string;
  isHost: boolean;
  companionId?: string;
  skinId?: string;
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
  canStartSelf: boolean;
  joinRoom: (roomId: string, isHost: boolean) => void;
  leaveRoom: () => void;
  start: (opts: StudyStartOpts) => void;
  // A guest joining an already-running room starts their own session on their own
  // clock (no broadcast). Used by the lobby's late-joiner Start button.
  startSelf: (opts: StudyStartOpts) => void;
  setStatus: (s: StudyStatus) => void;
  // Each player picks their own session length up front; the host only triggers
  // the synchronized start. Everyone then studies for their own chosen duration.
  setPreferredMinutes: (minutes: number) => void;
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
    isPlus,
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
  // back to the host's broadcast duration).
  const myPreferredMinutes = useRef<number | null>(null);
  const beginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of `begun` for synchronous reads inside the realtime closure, plus the
  // last begin payload so the host can re-sync a late joiner.
  const begunRef = useRef(false);
  const lastBeginRef = useRef<{ startAt: number; opts: StudyStartOpts; bgRoomId: string | null; deskRoomId: string | null } | null>(null);
  // Synchronous roster mirror so the host can enforce the 4-person cap without
  // racing React state.
  const rosterRef = useRef<StudyRosterEntry[]>([]);
  // Latest identity, so the realtime closure (created on join) reads current values.
  const meRef = useRef({ myCode, myName, myCompanionId, mySkinId, bgRoomId: equippedBackgroundRoomId, deskRoomId: equippedDeskRoomId });
  meRef.current = { myCode, myName, myCompanionId, mySkinId, bgRoomId: equippedBackgroundRoomId, deskRoomId: equippedDeskRoomId };
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
        // Subject is chosen per-player on the studying screen, not dictated by the host.
        subjectName: null,
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
    setRoomId(id);
    setIsHost(host);
    setBegun(false);
    setStatusMap({});
    setPresentCodes([]);
    setHostBackgroundId(host ? meRef.current.bgRoomId : null);
    setHostDeskId(host ? meRef.current.deskRoomId : null);
    myPreferredMinutes.current = null;
    begunRef.current = false;
    lastBeginRef.current = null;
    setCanStartSelf(false);
    mirrorRef.current = { uri: null, playing: false };
    const me = meRef.current;
    const initialRoster = [{ code: me.myCode, name: me.myName, isHost: host, companionId: me.myCompanionId, skinId: me.mySkinId }];
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
            room.current?.send('hello', { code: m.myCode, name: m.myName, companionId: m.myCompanionId, skinId: m.mySkinId });
          }
        },
        onPresence: () => {},
        onPresenceCodes: (codes) => {
          setPresentCodes(codes);
          if (!isHostRef.current) return;
          setRoster((prev) => {
            const next = prev.filter((e) => e.code === meRef.current.myCode || codes.includes(e.code));
            if (next.length !== prev.length) {
              rosterRef.current = next;
              broadcastRoster(next);
              return next;
            }
            return prev;
          });
        },
        onMessage: (type, data) => {
          if (type === 'hello') {
            if (!isHostRef.current) return;
            const d = data as { code: string; name: string; companionId?: string; skinId?: string };
            const prev = rosterRef.current;
            const exists = prev.some((e) => e.code === d.code);
            // Cap the room at 4 — silently ignore a NEW person once full.
            if (!exists && prev.length >= 4) return;
            const next = exists
              ? prev.map((e) => (e.code === d.code ? { ...e, name: d.name, companionId: d.companionId, skinId: d.skinId } : e))
              : [...prev, { code: d.code, name: d.name, isHost: false, companionId: d.companionId, skinId: d.skinId }];
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
          } else if (type === 'status') {
            const d = data as { code: string; status: StudyStatus };
            setStatusMap((prev) => ({ ...prev, [d.code]: d.status }));
          } else if (type === 'spotify') {
            // Host's now-playing → mirror it on this player's own Spotify (only if
            // they have it connected; non-premium accounts just 403 and stay silent).
            if (isHostRef.current || !spotifyConnected()) return;
            const d = data as { uri?: string; positionMs?: number; isPlaying?: boolean; ts?: number };
            const uri = d.uri ?? null;
            const playing = !!d.isPlaying;
            const last = mirrorRef.current;
            // mirrorRef tracks the song this player actually STARTED (not just the
            // host's last report) — only advance it when we issue a real change, so
            // a resume after a skip-while-paused reloads the right track.
            if (!uri) {
              if (last.playing) spotifyPause();
              mirrorRef.current = { uri: null, playing: false };
            } else if (uri !== last.uri) {
              // New/changed track — start it at the host's estimated position, but
              // only if the host is actually playing. If the host is paused on a new
              // track, do nothing AND leave mirrorRef untouched, so the eventual
              // resume hits this branch again and loads the correct track.
              if (playing) {
                const elapsed = d.ts ? Math.max(0, Date.now() - d.ts) : 0;
                playTrackAt(uri, (d.positionMs ?? 0) + elapsed);
                mirrorRef.current = { uri, playing: true };
              }
            } else {
              // Same track we started — react only to a play/pause flip, never a re-seek.
              if (playing && !last.playing) {
                spotifyResume();
                mirrorRef.current = { uri, playing: true };
              } else if (!playing && last.playing) {
                spotifyPause();
                mirrorRef.current = { uri, playing: false };
              }
            }
          } else if (type === 'begin') {
            // Idempotent: each member applies `begin` once. A re-sent begin (same
            // startAt) is ignored by anyone already begun.
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
              // a Start button so they pick their own length + start (startSelf).
              setCanStartSelf(true);
              return;
            }
            applyBeginRef.current(d.startAt, {
              // Each player studies for their own chosen length; the host's start
              // only sets the shared start moment. Fall back to host's if unset.
              durationMinutes: myPreferredMinutes.current ?? d.durationMinutes,
              subjectName: d.subjectName,
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
          }
        },
      },
      { code: myCode },
    );
  };

  const leaveRoom = () => {
    const m = meRef.current;
    room.current?.send('leave', { code: m.myCode });
    room.current?.leave();
    room.current = null;
    if (beginTimer.current) clearTimeout(beginTimer.current);
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

  const setStatus = (s: StudyStatus) => {
    setStatusMap((prev) => ({ ...prev, [meRef.current.myCode]: s }));
    room.current?.send('status', { code: meRef.current.myCode, status: s });
  };

  const setPreferredMinutes = (minutes: number) => {
    myPreferredMinutes.current = minutes;
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
      });
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isHost, begun, isPlus, spotifyOn]);

  // Clean up the connection if the provider ever unmounts (app teardown).
  useEffect(() => {
    return () => {
      room.current?.leave();
      if (beginTimer.current) clearTimeout(beginTimer.current);
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
      canStartSelf,
      joinRoom,
      leaveRoom,
      start,
      startSelf,
      setStatus,
      setPreferredMinutes,
    }),
    // joinRoom/leaveRoom/start/setStatus are stable enough (read refs); deps are the state they expose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, begun, isHost, myCode, roster, statusMap, presentCodes, netStatus, hostBackgroundId, hostDeskId, canStartSelf],
  );

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom(): StudyRoomValue {
  const v = useContext(StudyRoomContext);
  if (!v) throw new Error('useStudyRoom must be used inside StudyRoomProvider');
  return v;
}
