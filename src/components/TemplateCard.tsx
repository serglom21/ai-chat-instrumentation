import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { Template } from '../types';

interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(template)}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{template.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{template.title}</Text>
        <Text style={styles.category}>{template.category.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  icon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  category: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    letterSpacing: 1,
  },
});

export default TemplateCard;

