import { router } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '@/context/app-context';
import { joinGameRoom, type GameRoom } from '@/lib/game-net';

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
  joinRoom: (roomId: string, isHost: boolean) => void;
  leaveRoom: () => void;
  start: (opts: StudyStartOpts) => void;
  setStatus: (s: StudyStatus) => void;
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
  // Host's room background — everyone in the room studies in the host's room.
  const [hostBackgroundId, setHostBackgroundId] = useState<string | null>(null);

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const beginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest identity, so the realtime closure (created on join) reads current values.
  const meRef = useRef({ myCode, myName, myCompanionId, mySkinId, bgRoomId: equippedBackgroundRoomId });
  meRef.current = { myCode, myName, myCompanionId, mySkinId, bgRoomId: equippedBackgroundRoomId };
  const startRef = useRef(startActiveSession);
  startRef.current = startActiveSession;

  const broadcastRoster = (next: StudyRosterEntry[]) => {
    room.current?.send('roster', { players: next });
  };

  // Schedule the synced session start for `startAt` and head to the home screen.
  const applyBegin = (startAt: number, opts: StudyStartOpts) => {
    setBegun(true);
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
      router.replace('/');
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
    const me = meRef.current;
    setRoster([{ code: me.myCode, name: me.myName, isHost: host, companionId: me.myCompanionId, skinId: me.mySkinId }]);

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
            setRoster((prev) => {
              const exists = prev.some((e) => e.code === d.code);
              const next = exists
                ? prev.map((e) => (e.code === d.code ? { ...e, name: d.name, companionId: d.companionId, skinId: d.skinId } : e))
                : [...prev, { code: d.code, name: d.name, isHost: false, companionId: d.companionId, skinId: d.skinId }];
              broadcastRoster(next);
              setTimeout(() => broadcastRoster(next), 400); // beat the subscribe race
              return next;
            });
          } else if (type === 'roster') {
            setRoster((data as { players: StudyRosterEntry[] }).players);
          } else if (type === 'status') {
            const d = data as { code: string; status: StudyStatus };
            setStatusMap((prev) => ({ ...prev, [d.code]: d.status }));
          } else if (type === 'begin') {
            const d = data as { startAt: number; durationMinutes: number; subjectName: string | null; taskId: string | null; taskTitle: string | null; bgRoomId?: string | null };
            if (d.bgRoomId !== undefined) setHostBackgroundId(d.bgRoomId);
            applyBeginRef.current(d.startAt, {
              durationMinutes: d.durationMinutes,
              subjectName: d.subjectName,
              taskId: d.taskId,
              taskTitle: d.taskTitle,
            });
          } else if (type === 'leave') {
            const code = (data as { code: string }).code;
            if (!isHostRef.current) return;
            setRoster((prev) => {
              const next = prev.filter((e) => e.code === code ? false : true);
              if (next.length !== prev.length) broadcastRoster(next);
              return next;
            });
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
    setRoster([]);
    setStatusMap({});
    setPresentCodes([]);
    setHostBackgroundId(null);
  };

  const start = (opts: StudyStartOpts) => {
    if (!isHostRef.current) return;
    const startAt = Date.now() + 800;
    const bgRoomId = meRef.current.bgRoomId;
    setHostBackgroundId(bgRoomId);
    room.current?.send('begin', { startAt, ...opts, bgRoomId });
    applyBeginRef.current(startAt, opts);
  };

  const setStatus = (s: StudyStatus) => {
    setStatusMap((prev) => ({ ...prev, [meRef.current.myCode]: s }));
    room.current?.send('status', { code: meRef.current.myCode, status: s });
  };

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
      joinRoom,
      leaveRoom,
      start,
      setStatus,
    }),
    // joinRoom/leaveRoom/start/setStatus are stable enough (read refs); deps are the state they expose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, begun, isHost, myCode, roster, statusMap, presentCodes, netStatus, hostBackgroundId],
  );

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom(): StudyRoomValue {
  const v = useContext(StudyRoomContext);
  if (!v) throw new Error('useStudyRoom must be used inside StudyRoomProvider');
  return v;
}
