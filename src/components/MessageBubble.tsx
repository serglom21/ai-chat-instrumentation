import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { Message } from '../types';
import FormattedText from './FormattedText';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isAI = message.type === 'ai';

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.aiContainer,
      isSystem && styles.systemContainer,
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
        isSystem && styles.systemBubble,
      ]}>
        {isAI && (
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>🤖</Text>
            </View>
            <Text style={styles.aiLabel}>AI Assistant</Text>
          </View>
        )}
        {isAI ? (
          <FormattedText content={message.content} isUser={false} />
        ) : (
          <Text style={[
            styles.text,
            isUser ? styles.userText : styles.aiText,
            isSystem && styles.systemText,
          ]}>
            {message.content}
          </Text>
        )}
      </View>
      <Text style={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  systemContainer: {
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: '70%',
    maxWidth: '90%',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  aiLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.secondary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  systemBubble: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    maxWidth: '90%',
  },
  aiIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconText: {
    fontSize: 14,
  },
  text: {
    ...TYPOGRAPHY.body,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.white,
  },
  aiText: {
    color: COLORS.text,
  },
  systemText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

export default MessageBubble;

