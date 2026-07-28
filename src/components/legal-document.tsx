import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { LEGAL_CONTACT_EMAIL, type LegalSection } from '@/constants/legal';
import { BakeryColors } from '@/constants/theme';

const MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}?subject=Memobun%20Support`;

// One paragraph of legal copy. The "Contact us" sections end in our support
// address, so that address is rendered as a tappable mailto instead of dead
// text — App Store guideline 1.5 wants a reachable contact route, and a user
// reading the policy shouldn't have to retype an email by hand. Every language
// interpolates the same LEGAL_CONTACT_EMAIL constant, so this works for all of
// them without per-locale parsing.
function Paragraph({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const at = text.indexOf(LEGAL_CONTACT_EMAIL);
  if (at === -1) return <Text style={styles.paragraph}>{text}</Text>;

  const contact = async () => {
    try {
      if (await Linking.canOpenURL(MAILTO)) {
        await Linking.openURL(MAILTO);
        return;
      }
    } catch {
      // fall through to the clipboard path below
    }
    // No mail client — the iOS Simulator has none, and a device can have Mail
    // removed. Never leave the contact affordance dead: copy the address and
    // say so inline. Lazy require so a dev-client without the pod still boots.
    try {
      await require('expo-clipboard').setStringAsync(LEGAL_CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable too — the address is still visible as text
    }
  };

  return (
    <Text style={styles.paragraph}>
      {text.slice(0, at)}
      <Text style={styles.link} accessibilityRole="link" onPress={contact}>
        {copied ? t('friends.copied') : LEGAL_CONTACT_EMAIL}
      </Text>
      {text.slice(at + LEGAL_CONTACT_EMAIL.length)}
    </Text>
  );
}

// Renders one legal document (Privacy Policy or Terms of Service) as a titled
// list of sections. Shared by the first-launch consent gate and the in-app
// viewer reached from Settings.
export function LegalDocument({ heading, sections }: { heading: string; sections: LegalSection[] }) {
  return (
    <View style={styles.doc}>
      <Text style={styles.docHeading}>{heading}</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.body.map((paragraph, i) => (
            <Paragraph key={i} text={paragraph} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  doc: { gap: 14 },
  docHeading: { fontSize: 20, fontWeight: '800', color: BakeryColors.cocoaDark },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: BakeryColors.berry },
  paragraph: { fontSize: 13, lineHeight: 19, color: BakeryColors.mocha },
  link: { color: BakeryColors.jam, fontWeight: '700', textDecorationLine: 'underline' },
});
