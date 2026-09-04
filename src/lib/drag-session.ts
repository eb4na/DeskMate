export type DragSessionData = {
  durationMinutes: number;
  subjectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  /** Optional custom break length (minutes) chosen on the custom timer. */
  breakMinutes?: number;
  /** Solo "lock in": leaving the app ends the session, and finishing pays double. */
  lockedIn?: boolean;
};

let _pending: DragSessionData | null = null;
let _active = false;
const _listeners = new Set<(active: boolean) => void>();

export function setPendingDragSession(data: DragSessionData) {
  _pending = data;
}

export function takePendingDragSession(): DragSessionData | null {
  const data = _pending;
  _pending = null;
  return data;
}

export function setDragActive(active: boolean) {
  _active = active;
  _listeners.forEach((fn) => fn(active));
}

export function subscribeDragActive(fn: (active: boolean) => void) {
  _listeners.add(fn);
  fn(_active);
  return () => { _listeners.delete(fn); };
}
