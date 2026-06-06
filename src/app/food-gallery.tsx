import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export type FoodItem = {
  id: string;
  name: string;
  description: string;
  image: number;
};

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: 'strawberry-shortcake',
    name: 'Strawberry Shortcake',
    description: 'A classic layered cake with fresh strawberries and cream.',
    image: require('@/assets/images/cake/strawberry-shortcake.png'),
  },
];

// Patisserie palette — mirrors the Companion Bakery screen.
const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  green: '#8BCF8B',
  greenSoft: '#E3F4E3',
  pinkActive: '#F2A0B5',
  pinkActiveSoft: '#FBDCE4',
  pinkActiveText: '#C75A78',
  button: '#8A7A60',
} as const;

export default function FoodGalleryScreen() {
  const { selectedFoodId, madeFoods, setSelectedFood } = useApp();

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header panel */}
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>🍰 Bakery Menu</Text>
            <Text style={styles.headerSubtitle}>Choose what Bun bakes next</Text>
          </View>

          {/* My Recipes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Recipes</Text>
            <View style={styles.grid}>
              {FOOD_ITEMS.map((food) => {
                const isSelected = selectedFoodId === food.id;
                const isMade = madeFoods.includes(food.id);
                return (
                  <View
                    key={food.id}
                    style={[styles.foodCard, isSelected && styles.foodCardActive]}>
                    <View style={styles.imageWrap}>
                      <Image source={food.image} style={styles.foodImg} resizeMode="contain" />
                      {isMade && (
                        <View style={styles.madeBadge}>
                          <Text style={styles.madeBadgeText}>✓ Made</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                    <Text style={styles.foodDesc} numberOfLines={2}>{food.description}</Text>
                    {isSelected ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>✦ Baking</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [styles.selectBtn, pressed && styles.pressed]}
                        onPress={() => { setSelectedFood(food.id); if (router.canGoBack()) router.back(); else router.replace('/'); }}>
                        <Text style={styles.selectBtnText}>Bake this</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              🧁 The recipe you pick is what Bun bakes during your next study session.
            </Text>
          </View>

          {/* Done */}
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: P.cream,
  },

  headerPanel: {
    backgroundColor: P.card,
    borderRadius: 26,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: '#F4C5A8',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: P.brown, letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, color: P.mutedBrown, fontWeight: '500' },

  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  foodCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  foodCardActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
    shadowColor: P.pink,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  imageWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  foodImg: { width: 96, height: 96 },
  madeBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#E88AA0', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  madeBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  foodName: { fontSize: 15, fontWeight: '800', color: P.brown, textAlign: 'center' },
  foodDesc: { fontSize: 11, color: P.mutedBrown, textAlign: 'center', lineHeight: 15 },
  activePill: {
    marginTop: 6,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  activePillText: { fontSize: 12, color: P.pinkActiveText, fontWeight: '800' },
  selectBtn: {
    marginTop: 6,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  selectBtnText: { fontSize: 12, color: '#fff', fontWeight: '800' },

  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: { fontSize: 12.5, color: P.brown, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  doneButton: {
    backgroundColor: P.button,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  pressed: { opacity: 0.85 },
});
