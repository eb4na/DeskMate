import { StyleSheet, Text, View } from 'react-native';

import type { LegalSection } from '@/constants/legal';
import { BakeryColors } from '@/constants/theme';

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
            <Text key={i} style={styles.paragraph}>
              {paragraph}
            </Text>
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
});
