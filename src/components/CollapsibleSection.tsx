import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  level?: 1 | 2 | 3;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  level = 2,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.header,
          level === 1 && styles.headerLevel1,
          level === 2 && styles.headerLevel2,
          level === 3 && styles.headerLevel3,
        ]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.title,
              level === 1 && styles.titleLevel1,
              level === 2 && styles.titleLevel2,
              level === 3 && styles.titleLevel3,
            ]}
          >
            {title}
          </Text>
          <Text style={styles.icon}>{isExpanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>
      {isExpanded && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
  },
  header: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerLevel1: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  headerLevel2: {
    backgroundColor: COLORS.secondary + '20',
    borderColor: COLORS.secondary,
  },
  headerLevel3: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  titleLevel1: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  titleLevel2: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  titleLevel3: {
    fontSize: 14,
    fontWeight: '600',
  },
  icon: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  content: {
    marginTop: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
  },
});

export default CollapsibleSection;

