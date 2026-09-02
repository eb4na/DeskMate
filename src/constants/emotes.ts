// Chat emotes — Bun's face reacting. Sent from the "+" panel in a friend DM and
// rendered as a bare sticker (no bubble) in the thread.
//
// The art is the old mood-tracker face set: the feature was removed, the drawings
// were too good to lose. Labels live under `emotes.<id>` in i18n and are used as
// the accessibility label (the grid itself is art-only).

export type EmoteId =
  | 'happy'
  | 'excited'
  | 'proud'
  | 'ready'
  | 'relieved'
  | 'okay'
  | 'sleepy'
  | 'tired'
  | 'stressed'
  | 'lost'
  | 'frustrated'
  | 'down';

export type Emote = { id: EmoteId; image: number };

// Grid order: bright → neutral → low, so the panel reads top-left to bottom-right.
export const EMOTES: Emote[] = [
  { id: 'happy', image: require('@/assets/images/emotes/emote-happy.png') },
  { id: 'excited', image: require('@/assets/images/emotes/emote-excited.png') },
  { id: 'proud', image: require('@/assets/images/emotes/emote-proud.png') },
  { id: 'ready', image: require('@/assets/images/emotes/emote-ready.png') },
  { id: 'relieved', image: require('@/assets/images/emotes/emote-relieved.png') },
  { id: 'okay', image: require('@/assets/images/emotes/emote-okay.png') },
  { id: 'sleepy', image: require('@/assets/images/emotes/emote-sleepy.png') },
  { id: 'tired', image: require('@/assets/images/emotes/emote-tired.png') },
  { id: 'stressed', image: require('@/assets/images/emotes/emote-stressed.png') },
  { id: 'lost', image: require('@/assets/images/emotes/emote-lost.png') },
  { id: 'frustrated', image: require('@/assets/images/emotes/emote-frustrated.png') },
  { id: 'down', image: require('@/assets/images/emotes/emote-down.png') },
];

// What a client that predates emotes shows instead of the sticker: those builds
// have no 'emote' branch and render the message `body` as plain text. Keep it a
// readable sentence — the id used to sit here, so old clients printed "sleepy".
export const EMOTE_FALLBACK_BODY = 'Sent a sticker';

const BY_ID = new Map<string, Emote>(EMOTES.map((e) => [e.id, e]));

/** Look up an emote by the id carried on a message. Unknown ids → null so a
 *  renamed emote (or a tampered client) renders nothing instead of a broken image. */
export function findEmote(id: string | null | undefined): Emote | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** i18n key for an emote's name (used as the accessibility label). */
export const emoteLabelKey = (id: EmoteId) => `emotes.${id}`;
