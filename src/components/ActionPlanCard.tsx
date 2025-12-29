import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { ActionPlan } from '../types';

interface ActionPlanCardProps {
  actionPlan: ActionPlan;
  onEdit?: () => void;
  onView?: () => void;
}

const ActionPlanCard: React.FC<ActionPlanCardProps> = ({ actionPlan, onEdit, onView }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Action Plan Saved</Text>
          <Text style={styles.subtitle}>{actionPlan.title}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.planContent} numberOfLines={3}>
          {actionPlan.content}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.viewButton]}
          onPress={onView}
        >
          <Text style={styles.buttonText}>View Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={onEdit}
        >
          <Text style={styles.buttonText}>Edit Plan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>SAVED</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.success,
    ...SHADOWS.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  icon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  content: {
    marginBottom: SPACING.md,
  },
  planContent: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButton: {
    backgroundColor: COLORS.primary,
  },
  editButton: {
    backgroundColor: COLORS.secondary,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ActionPlanCard;







