import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { Suggestion } from '../types';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onPress: (suggestion: Suggestion) => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(suggestion)}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{suggestion.text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    ...SHADOWS.small,
  },
  text: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
  },
});

export default SuggestionCard;

