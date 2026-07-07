import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BakeryColors, BakeryRadii } from '@/constants/theme';

type WheelOption = { label: string; value: string };

type WheelOptionListProps = {
  options: WheelOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  height?: number;
};

const ROW_HEIGHT = 40;

// Android stand-in for the iOS wheel picker columns: a scrollable list where one
// tap selects (the @expo/ui wheel doesn't exist on Android — it degrades to a
// cramped dropdown that needs a second tap). Callers' change handlers already
// play the tick sound, so onSelect stays silent here.
export function WheelOptionList({ options, selectedValue, onSelect, height = 176 }: WheelOptionListProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Center the selected row once the list has laid out. Modal content on Android
  // lays out late, so this must hang off onLayout rather than a mount effect.
  const scrollToSelected = () => {
    const index = options.findIndex((option) => option.value === selectedValue);
    if (index < 0) return;
    const y = Math.max(0, index * ROW_HEIGHT - height / 2 + ROW_HEIGHT / 2);
    scrollRef.current?.scrollTo({ y, animated: false });
  };

  return (
    <View style={{ height }}>
      <ScrollView ref={scrollRef} onLayout={scrollToSelected} showsVerticalScrollIndicator={false}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
              <ThemedText type={selected ? 'smallBold' : 'small'} style={selected && styles.labelSelected}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BakeryRadii.card,
    marginHorizontal: 4,
  },
  rowSelected: {
    backgroundColor: BakeryColors.mint,
  },
  labelSelected: {
    color: BakeryColors.cocoaDark,
  },
  pressed: {
    opacity: 0.85,
  },
});
