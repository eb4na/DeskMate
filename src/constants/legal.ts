// Privacy Policy + Terms of Service content shown in the first-launch consent
// gate (src/components/legal-consent-gate.tsx) and the in-app viewer reachable
// from Settings (src/app/legal.tsx).
//
// NOTE: This is plain-language starting content, not legal advice. Before
// launch, have it reviewed and host an identical copy at a public URL — the
// App Store requires a Privacy Policy URL in App Store Connect.

export const LEGAL_VERSION = '1.0';
export const LEGAL_EFFECTIVE_DATE = 'June 15, 2026';
// Minimum age to use the app. Enforced at the first-launch consent gate, where
// the user enters their date of birth. 13 is the common threshold for consenting
// to data processing (e.g. US COPPA); raise if your audience requires it.
export const MINIMUM_AGE = 13;
// Contact address shown in both documents (Privacy Policy + Terms).
export const LEGAL_CONTACT_EMAIL = 'memobunsupport@gmail.com';

export type LegalSection = { title: string; body: string[] };

export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: 'Overview',
    body: [
      `Memobun ("we", "us") is a study companion app. This Privacy Policy explains what information we collect, how we use it, and your choices. It applies to the Memobun mobile app. Effective ${LEGAL_EFFECTIVE_DATE}.`,
    ],
  },
  {
    title: 'Information we collect',
    body: [
      'Account information: if you sign in, we receive your email address and a unique account ID from your sign-in provider (e.g. Google). If you use the app as a guest, no account is created and your progress is stored only on your device until you choose to sign in.',
      `Date of birth: we ask for your date of birth once, when you first start the app, to confirm you meet the minimum age (${MINIMUM_AGE}). We store the date with your app data; we do not share it.`,
      'Study and app activity: study sessions, subjects, tasks and exams you add, streaks, coins, items you own, and similar in-app progress, so your data syncs across your devices.',
      'Companion and friend messages: messages you send to your in-app AI companion and direct messages you send to friends are stored so your conversations persist.',
      'Usage analytics: we use PostHog, a third-party analytics provider, to understand how the app is used. This includes in-app events (for example, completing a study session, opening a chat, or making an in-app purchase), your device type and operating-system version, the app version, and an approximate location (such as country or city) derived from your IP address. We do not use this to identify you personally beyond your account ID.',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'To provide and sync the app and its features across your devices.',
      'To power the AI companion chat and friend messaging.',
      'To understand usage, fix problems, and improve the app.',
      'To keep the app safe — for example, filtering inappropriate content and responding to reports.',
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'Supabase — stores your account, progress, and messages (data hosting / backend).',
      'PostHog — product analytics, as described above. Depending on configuration, analytics data is processed on US or EU servers.',
      'OpenAI — powers AI companion replies; messages you send to your companion are processed to generate a response.',
      'Sign-in providers (e.g. Google) — used to authenticate you.',
      'Each provider processes data under its own privacy policy.',
    ],
  },
  {
    title: 'Data retention and deletion',
    body: [
      'We keep your information while your account is active. You can delete your account at any time from Settings, which removes your account and associated data from our systems. Guest data lives only on your device and is removed when you delete the app or clear its data.',
    ],
  },
  {
    title: "Children's privacy",
    body: [
      `Memobun is not directed to children under ${MINIMUM_AGE}. We ask for your date of birth at first launch and do not allow accounts for anyone under ${MINIMUM_AGE}. If you believe a child has provided us personal information, contact us and we will remove it.`,
    ],
  },
  {
    title: 'Your choices and rights',
    body: [
      'Depending on where you live, you may have rights to access, correct, or delete your personal information, or to object to certain processing. You can exercise these by contacting us. You can also delete your account in-app at any time.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      `Questions about this Privacy Policy? Email ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];

export const TERMS_OF_SERVICE: LegalSection[] = [
  {
    title: 'Acceptance',
    body: [
      `By using Memobun, you agree to these Terms of Service. If you do not agree, please do not use the app. Effective ${LEGAL_EFFECTIVE_DATE}.`,
    ],
  },
  {
    title: 'Eligibility',
    body: [
      `You must be at least ${MINIMUM_AGE} years old (or the minimum age of digital consent in your country, if higher) to use Memobun. We ask for your date of birth at first launch, and by using the app you confirm you meet this requirement.`,
    ],
  },
  {
    title: 'Your account',
    body: [
      'You are responsible for activity under your account and for keeping your sign-in secure. You may use the app as a guest, but guest progress is stored only on your device and may be lost if the app is deleted.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'Be kind. Do not use Memobun to harass, abuse, threaten, or send inappropriate or unlawful content to other users, including in direct messages.',
      'Do not attempt to break, overload, reverse-engineer, or misuse the app or its services.',
    ],
  },
  {
    title: 'User content and moderation',
    body: [
      'You are responsible for content you create, including messages to friends and to the AI companion. We use automated filtering and may review reported content. You can block other users and report abuse from within the app. We may remove content or suspend accounts that violate these Terms.',
    ],
  },
  {
    title: 'Virtual items and purchases',
    body: [
      'Coins, items, and other virtual goods have no real-world monetary value, cannot be exchanged for cash, and are licensed to you for use within the app only.',
      'Memobun Plus and any other paid features are billed through your app store under its terms. Subscriptions renew unless cancelled, which you manage in your app store account.',
    ],
  },
  {
    title: 'AI companion',
    body: [
      'The AI companion generates responses automatically and may be inaccurate. It is for friendly study motivation, not professional, medical, legal, or mental-health advice.',
    ],
  },
  {
    title: 'Disclaimers and liability',
    body: [
      'Memobun is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect or incidental damages arising from your use of the app.',
    ],
  },
  {
    title: 'Changes and termination',
    body: [
      'We may update these Terms or the app over time; continued use after changes means you accept the updated Terms. We may suspend or end access for violations of these Terms.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      `Questions about these Terms? Email ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];
