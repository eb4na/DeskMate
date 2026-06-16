import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { showLoadingScreen } from '@/lib/loading-signal';
import { BakeryColors, BakeryRadii, BakeryShadow } from '@/constants/theme';
import { LANGUAGES, type SupportedLanguage, useTranslation } from '@/i18n';

// Flag art. Codes without a PNG yet fall back to the emoji in LANGUAGES.
const FLAGS: Partial<Record<SupportedLanguage, number>> = {
  en: require('@/assets/images/flags/en.png'),
  ja: require('@/assets/images/flags/ja.png'),
};

export default function LanguagePickerScreen() {
  const { width } = useWindowDimensions();
  const { setLanguage, markLanguageSelected, language, languageSelected } = useApp();
  const { t } = useTranslation();

  // Opened from Settings (language already chosen) vs. first-launch onboarding.
  const fromSettings = languageSelected;

  const [selected, setSelected] = useState<SupportedLanguage>((language as SupportedLanguage) || 'en');

  const handleSelect = (code: SupportedLanguage) => {
    setSelected(code);
    // Live-preview the language during onboarding. From Settings we defer the
    // actual switch to Continue so the loading screen can cover the re-render.
    if (!fromSettings) setLanguage(code);
  };

  const handleContinue = () => {
    setLanguage(selected);
    markLanguageSelected();
    if (fromSettings) {
      // Cover the language re-render with the app's loading screen and dismiss
      // both this picker and the Settings modal — land on home behind the loader.
      showLoadingScreen();
      if (router.canDismiss()) router.dismissAll();
      else router.replace('/');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const cardWidth = Math.min(width * 0.92, 430);

  const card = (
    <View style={[styles.card, { width: cardWidth }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('lang.title')}</Text>
        <Text style={styles.subtitle}>{t('lang.subtitle')}</Text>
      </View>

      {/* Language options */}
      <View style={styles.langList}>
        {LANGUAGES.map((lang) => {
          const isActive = selected === lang.code;
          const flagSrc = FLAGS[lang.code];
          return (
            <Pressable
              key={lang.code}
              style={[styles.langBtn, isActive && styles.langBtnActive]}
              onPress={() => handleSelect(lang.code)}>
              <View style={styles.flagWrap}>
                {flagSrc ? (
                  <Image source={flagSrc} style={styles.flagImg} contentFit="contain" />
                ) : (
                  <Text style={styles.flagEmoji}>{lang.flag}</Text>
                )}
              </View>
              <View style={styles.langTextWrap}>
                <Text
                  style={[styles.langNative, isActive && styles.langNativeActive]}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.75}>
                  {lang.native}
                </Text>
                {lang.native !== lang.english && (
                  <Text style={styles.langEnglish}>{lang.english}</Text>
                )}
              </View>
              <View style={[styles.radio, isActive && styles.radioActive]}>
                {isActive && <Text style={styles.radioCheck}>✓</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Continue button */}
      <Pressable
        style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.88 }]}
        onPress={handleContinue}>
        <Text style={styles.continueSparkle}>✦</Text>
        <Text
          style={styles.continueBtnText}
          adjustsFontSizeToFit
          numberOfLines={1}
          minimumFontScale={0.75}>
          {t('lang.confirm')}
        </Text>
        <Text style={styles.continueSparkle}>✦</Text>
      </Pressable>
    </View>
  );

  // Always use the plain/normal backdrop — never swap in the login-room art (so
  // an accidental/transient picker doesn't jarringly replace the app background).
  return <View style={[styles.room, styles.plainBackdrop]}>{card}</View>;
}

const styles = StyleSheet.create({
  room: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainBackdrop: {
    backgroundColor: BakeryColors.frosting,
  },
  // Plain rounded card — replaces the old bow-frame PNG. Cream fill, soft pink
  // border, gentle shadow; sizes to its content.
  card: {
    alignItems: 'stretch',
    backgroundColor: '#FFFDF8',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#F4C2CC',
    paddingVertical: 24,
    paddingHorizontal: 22,
    gap: 18,
    ...BakeryShadow,
  },

  header: { alignItems: 'center', gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: BakeryColors.cocoaDark, textAlign: 'center' },
  subtitle: { fontSize: 12, color: BakeryColors.berry, textAlign: 'center' },

  langList: { gap: 8, flexShrink: 1, justifyContent: 'center' },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderRadius: BakeryRadii.chip,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  langBtnActive: {
    borderColor: BakeryColors.jam,
    backgroundColor: 'rgba(246,200,194,0.38)',
  },

  flagWrap: {
    width: 40,
    height: 30,
    borderRadius: 7,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagImg: { width: '100%', height: '100%' },
  flagEmoji: { fontSize: 28, lineHeight: 30, textAlign: 'center' },

  langTextWrap: { flex: 1 },
  langNative: { fontSize: 16, fontWeight: '700', color: BakeryColors.mocha },
  langNativeActive: { color: BakeryColors.cocoaDark },
  langEnglish: { fontSize: 11, color: BakeryColors.latte },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    backgroundColor: BakeryColors.jam,
    borderColor: BakeryColors.jam,
  },
  radioCheck: { fontSize: 12, color: '#fff', fontWeight: '800' },

  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.pill,
    paddingVertical: 14,
    ...BakeryShadow,
  },
  continueSparkle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
