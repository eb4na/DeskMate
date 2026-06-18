/**
 * Plus members get a little crown badge shown next to their display name (the old
 * gold ring + crown avatar *frame* was removed). The published profile sets
 * `avatarFrame` to 'gold' while the user is Plus (and 'none' when Plus lapses),
 * so that field doubles as the "is this a Plus member" signal everywhere a name
 * is shown. Legacy equipped-frame ids ('crown' | 'catEars' | 'dessert') from the
 * old picker still count as Plus, since only Plus members ever had one.
 */
import { Image } from 'expo-image';

const CROWN = require('@/assets/images/plus/plus-crown.png');
const CROWN_RATIO = 855 / 695; // the PNG is wider than it is tall

/** True when the profile belongs to a Plus member (shows the crown). */
export function isPlusFrame(frame?: string): boolean {
  return !!frame && frame !== 'none';
}

/**
 * The Plus crown badge is hidden — Plus members no longer show a crown next to
 * their name. Kept as a no-op (rather than removing every call site) so the
 * `isPlusFrame(...) && <PlusCrown />` usages and the Plus gold-card styling stay
 * intact; restore the <Image> below to bring the crown back.
 */
export function PlusCrown(_props: { size: number }) {
  return null;
}
