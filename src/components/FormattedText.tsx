import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import CollapsibleSection from './CollapsibleSection';

interface FormattedTextProps {
  content: string;
  isUser?: boolean;
}

interface Section {
  title: string;
  content: JSX.Element[];
  level: 1 | 2 | 3;
}

const FormattedText: React.FC<FormattedTextProps> = ({ content, isUser = false }) => {
  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentList: string[] = [];
    let currentNumberedList: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let regularContent: JSX.Element[] = [];

    const flushList = (target: JSX.Element[]) => {
      if (currentList.length > 0) {
        target.push(
          <View key={`list-${target.length}`} style={styles.list}>
            {currentList.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.bulletContainer}>
                  <Text style={[styles.bullet, isUser && styles.bulletUser]}>•</Text>
                </View>
                <Text style={[styles.text, isUser && styles.userText]}>{item}</Text>
              </View>
            ))}
          </View>
        );
        currentList = [];
      }
    };

    const flushNumberedList = (target: JSX.Element[]) => {
      if (currentNumberedList.length > 0) {
        target.push(
          <View key={`nlist-${target.length}`} style={styles.list}>
            {currentNumberedList.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.numberContainer}>
                  <Text style={[styles.number, isUser && styles.numberUser]}>
                    {idx + 1}.
                  </Text>
                </View>
                <Text style={[styles.text, isUser && styles.userText]}>{item}</Text>
              </View>
            ))}
          </View>
        );
        currentNumberedList = [];
      }
    };

    const flushCodeBlock = (target: JSX.Element[]) => {
      if (codeContent.length > 0) {
        target.push(
          <View key={`code-${target.length}`} style={styles.codeBlock}>
            <Text style={styles.codeText}>{codeContent.join('\n')}</Text>
          </View>
        );
        codeContent = [];
      }
    };

    const flushSection = () => {
      if (currentSection) {
        flushList(currentSection.content);
        flushNumberedList(currentSection.content);
        flushCodeBlock(currentSection.content);
        sections.push(currentSection);
        currentSection = null;
      }
    };

    const getContentTarget = () => currentSection ? currentSection.content : regularContent;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const target = getContentTarget();

      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock(target);
          inCodeBlock = false;
        } else {
          flushList(target);
          flushNumberedList(target);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Handle headings (###, ##, #) - Create collapsible sections
      if (trimmedLine.match(/^#{1,3}\s/)) {
        flushSection();
        flushList(regularContent);
        flushNumberedList(regularContent);
        
        const level = (trimmedLine.match(/^#{1,3}/)?.[0].length || 1) as 1 | 2 | 3;
        const text = trimmedLine.replace(/^#{1,3}\s/, '');
        
        currentSection = {
          title: text,
          content: [],
          level,
        };
        return;
      }

      // Handle bullet points (-, *, •)
      if (trimmedLine.match(/^[-*•]\s/)) {
        flushNumberedList(target);
        const text = trimmedLine.replace(/^[-*•]\s/, '');
        currentList.push(text);
        return;
      }

      // Handle numbered lists (1., 2., etc.)
      if (trimmedLine.match(/^\d+\.\s/)) {
        flushList(target);
        const text = trimmedLine.replace(/^\d+\.\s/, '');
        currentNumberedList.push(text);
        return;
      }

      // Handle bold text (**text**)
      if (trimmedLine.includes('**')) {
        flushList(target);
        flushNumberedList(target);
        const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
        target.push(
          <Text key={`bold-${index}`} style={[styles.text, isUser && styles.userText]}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <Text key={i} style={styles.bold}>
                    {part.replace(/\*\*/g, '')}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        );
        return;
      }

      // Handle empty lines
      if (trimmedLine === '') {
        flushList(target);
        flushNumberedList(target);
        if (target.length > 0) {
          target.push(<View key={`space-${index}`} style={styles.spacing} />);
        }
        return;
      }

      // Regular text
      flushList(target);
      flushNumberedList(target);
      target.push(
        <Text key={`text-${index}`} style={[styles.text, isUser && styles.userText]}>
          {line}
        </Text>
      );
    });

    // Flush any remaining content
    flushSection();
    flushList(regularContent);
    flushNumberedList(regularContent);
    flushCodeBlock(regularContent);

    // Render sections and regular content
    return (
      <>
        {regularContent}
        {sections.map((section, idx) => (
          <CollapsibleSection
            key={`section-${idx}`}
            title={section.title}
            level={section.level}
            defaultExpanded={idx === 0}
          >
            {section.content}
          </CollapsibleSection>
        ))}
      </>
    );
  };

  return <View style={styles.container}>{parseContent(content)}</View>;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  text: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 4,
    flex: 1,
    flexWrap: 'wrap',
  },
  userText: {
    color: COLORS.white,
  },
  heading: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
  list: {
    marginVertical: SPACING.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    alignItems: 'flex-start',
    paddingRight: SPACING.md,
  },
  bulletContainer: {
    width: 20,
    alignItems: 'center',
    marginRight: SPACING.xs,
    flexShrink: 0,
  },
  bullet: {
    ...TYPOGRAPHY.body,
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
  bulletUser: {
    color: COLORS.white,
  },
  numberContainer: {
    width: 24,
    alignItems: 'flex-start',
    marginRight: SPACING.xs,
    flexShrink: 0,
  },
  number: {
    ...TYPOGRAPHY.body,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  numberUser: {
    color: COLORS.white,
  },
  codeBlock: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeText: {
    ...TYPOGRAPHY.bodySmall,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.secondary,
    lineHeight: 20,
  },
  spacing: {
    height: SPACING.sm,
  },
});

export default FormattedText;

