import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';

import en from './en.json';
import zh from './zh.json';
import zhHant from './zh-Hant.json';
import ja from './ja.json';
import ko from './ko.json';
import es from './es.json';
import fr from './fr.json';

export type SupportedLanguage = 'en' | 'zh' | 'zh-Hant' | 'ja' | 'ko' | 'es' | 'fr';

export const LANGUAGES: { code: SupportedLanguage; flag: string; native: string; english: string }[] = [
  { code: 'en', flag: '🇺🇸', native: 'English', english: 'English' },
  { code: 'zh', flag: '🇨🇳', native: '简体中文', english: 'Simplified Chinese' },
  { code: 'zh-Hant', flag: '🇹🇼', native: '繁體中文', english: 'Traditional Chinese' },
  { code: 'ja', flag: '🇯🇵', native: '日本語', english: 'Japanese' },
  { code: 'ko', flag: '🇰🇷', native: '한국어', english: 'Korean' },
  { code: 'es', flag: '🇪🇸', native: 'Español', english: 'Spanish' },
  { code: 'fr', flag: '🇫🇷', native: 'Français', english: 'French' },
];

// Read the device's preferred locale. Hermes' `Intl` reflects the OS locale on
// both iOS and Android; native modules are a fallback if `Intl` is unavailable.
function rawDeviceLocale(): string {
  try {
    const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
    if (intlLocale) return intlLocale;
  } catch {
    // ignore — fall through to native modules
  }
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      return settings?.AppleLocale || settings?.AppleLanguages?.[0] || 'en';
    }
    return NativeModules.I18nManager?.localeIdentifier || 'en';
  } catch {
    return 'en';
  }
}

// Map the device locale (e.g. "ja-JP", "zh-Hans-CN") to one of our supported
// languages, falling back to English when the device language isn't supported.
export function detectDeviceLanguage(): SupportedLanguage {
  const tag = rawDeviceLocale().toLowerCase().replace(/_/g, '-');
  const subtags = tag.split('-');
  const base = subtags[0];
  // Chinese is the one language where the script/region subtags matter:
  // Traditional-script locales (zh-Hant-*, zh-TW, zh-HK, zh-MO) get zh-Hant,
  // everything else Chinese (zh-Hans-*, zh-CN, zh-SG, bare zh) gets Simplified.
  if (base === 'zh') {
    const rest = subtags.slice(1);
    return rest.some((s) => s === 'hant' || s === 'tw' || s === 'hk' || s === 'mo') ? 'zh-Hant' : 'zh';
  }
  const codes = LANGUAGES.map((l) => l.code) as string[];
  return (codes.includes(base) ? base : 'en') as SupportedLanguage;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      'zh-Hant': { translation: zhHant },
      ja: { translation: ja },
      ko: { translation: ko },
      es: { translation: es },
      fr: { translation: fr },
    },
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
export { useTranslation } from 'react-i18next';
