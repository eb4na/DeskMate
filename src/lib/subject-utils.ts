// Built-in subject-name localization. Subject names are user data stored as plain
// English strings (the three seeded defaults + the "General Study" fallback used
// when a session has no subject). We keep the STORED and MATCHED value in English
// (session-history grouping and cross-device sync key on it) and translate only at
// DISPLAY time — mirroring localizeCompanionName / localizeOutfitName.

const SUBJECT_NAME_KEYS: Record<string, string> = {
  Math: 'subjectNames.math',
  Biology: 'subjectNames.biology',
  History: 'subjectNames.history',
  // The no-subject fallback label; reuses the existing home.generalStudy key.
  'General Study': 'home.generalStudy',
};

/**
 * Localize a built-in subject name for display. A null/empty name (a session with
 * no chosen subject) resolves to the localized "General Study" label. Custom
 * user-created subject names are returned unchanged.
 */
export function localizeSubjectName(
  name: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!name || name.length === 0) return t('home.generalStudy');
  const key = SUBJECT_NAME_KEYS[name];
  return key ? t(key) : name;
}
