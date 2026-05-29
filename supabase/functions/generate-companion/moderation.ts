const BLOCKED_TERMS = [
  'nude',
  'naked',
  'nsfw',
  'porn',
  'sexual',
  'erotic',
  'gore',
  'blood',
  'weapon',
  'gun',
  'knife',
  'hitler',
  'nazi',
];

export function assertPromptIsSafe(...parts: string[]) {
  const combined = parts.join(' ').toLowerCase();
  const hit = BLOCKED_TERMS.find((term) => combined.includes(term));
  if (hit) {
    throw new Error('This prompt cannot be generated. Please try a different description.');
  }
}
