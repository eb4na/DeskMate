import { router } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';
import { BakeryColors, BakeryRadii, BakeryShadow } from '@/constants/theme';
import { LANGUAGES, type SupportedLanguage, useTranslation } from '@/i18n';

const SESSION_FRAME = require('@/assets/images/home/session-frame.png');

export default function LanguagePickerScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setLanguage, markLanguageSelected, language } = useApp();
  const { t } = useTranslation();

  const [selected, setSelected] = useState<SupportedLanguage>((language as SupportedLanguage) || 'en');

  const handleSelect = (code: SupportedLanguage) => {
    setSelected(code);
    setLanguage(code);
  };

  const handleContinue = () => {
    setLanguage(selected);
    markLanguageSelected();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.backdrop}>
      <ImageBackground
        source={SESSION_FRAME}
        style={[styles.card, { width: width * 0.9, paddingTop: 56 + insets.top * 0.2 }]}
        resizeMode="stretch"
        imageStyle={{ borderRadius: 28 }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('lang.title')}</Text>
          <Text style={styles.subtitle}>{t('lang.subtitle')}</Text>
        </View>

        {/* Language options */}
        <View style={styles.langList}>
          {LANGUAGES.map((lang) => {
            const isActive = selected === lang.code;
            return (
              <Pressable
                key={lang.code}
                style={[styles.langBtn, isActive && styles.langBtnActive]}
                onPress={() => handleSelect(lang.code)}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
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
                {isActive && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Continue button */}
        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.85 }]}
          onPress={handleContinue}>
          <Text
            style={styles.continueBtnText}
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.75}>
            {t('lang.confirm')}
          </Text>
        </Pressable>

      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: BakeryColors.frosting,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: BakeryRadii.panel,
    overflow: 'hidden',
    paddingBottom: 28,
    paddingHorizontal: 32,
    alignItems: 'stretch',
    gap: 12,
  },

  header: { alignItems: 'center', gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: BakeryColors.cocoaDark, textAlign: 'center' },
  subtitle: { fontSize: 12, color: BakeryColors.mocha, textAlign: 'center' },

  langList: { gap: 8 },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.chip,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  langBtnActive: {
    borderColor: BakeryColors.honey,
    backgroundColor: BakeryColors.cream,
  },
  langFlag: { fontSize: 22 },
  langTextWrap: { flex: 1 },
  langNative: { fontSize: 16, fontWeight: '700', color: BakeryColors.mocha },
  langNativeActive: { color: BakeryColors.cocoaDark },
  langEnglish: { fontSize: 11, color: BakeryColors.latte },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BakeryColors.honey,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 12, color: '#fff', fontWeight: '800' },

  continueBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: 14,
    alignItems: 'center',
    ...BakeryShadow,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: BakeryColors.cocoaDark,
  },
});
