import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sentry from '@sentry/react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { TEMPLATES } from '../data/templates';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const testSentry = () => {
    console.log('🧪 Testing Sentry...');
    
    // Test 1: Send message
    Sentry.captureMessage('Test message from Home Screen', 'info');
    
    // Test 2: Send error
    try {
      throw new Error('Test error from Home Screen - This is intentional!');
    } catch (error) {
      Sentry.captureException(error);
    }
    
    // Test 3: Send performance span
    Sentry.startSpan({
      name: 'Test Button Click',
      op: 'user.click',
      attributes: {
        screen: 'Home',
        action: 'test_button',
      },
    }, (span) => {
      // Simulate some work with a child span
      Sentry.startSpan({
        name: 'Processing Test Data',
        op: 'processing',
      }, () => {
        setTimeout(() => {
          console.log('✅ Test spans sent to Sentry');
        }, 300);
      });
    });
    
    Alert.alert(
      'Sentry Tests Sent! 🎉',
      'Check your Sentry dashboard:\n\n📧 Issues tab: See the error & message\n⚡ Performance tab: See the spans\n\nWait ~10 seconds for data to appear.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.surface]}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.subtitle}>
              Your personal planning companion powered by AI
            </Text>
          </View>

          {/* Test Sentry Button */}
          <TouchableOpacity
            style={styles.testButton}
            onPress={testSentry}
            activeOpacity={0.8}
          >
            <Text style={styles.testButtonText}>🧪 Test Sentry Integration</Text>
          </TouchableOpacity>

          {/* Quick Start Button */}
          <TouchableOpacity
            style={styles.quickStartButton}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.quickStartGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.quickStartIcon}>💬</Text>
              <Text style={styles.quickStartText}>Start New Chat</Text>
              <Text style={styles.quickStartSubtext}>
                Ask me anything or create an action plan
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Templates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Templates</Text>
            <Text style={styles.sectionSubtitle}>
              Choose a template to get started quickly
            </Text>

            {TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() =>
                  navigation.navigate('Chat', { template })
                }
                activeOpacity={0.7}
              >
                <View style={styles.templateIcon}>
                  <Text style={styles.templateIconText}>{template.icon}</Text>
                </View>
                <View style={styles.templateContent}>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                  <Text style={styles.templateCategory}>
                    {template.category.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>📋</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Action Plans</Text>
                <Text style={styles.featureDescription}>
                  Create detailed, step-by-step plans for your goals
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>💡</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Smart Suggestions</Text>
                <Text style={styles.featureDescription}>
                  Get personalized recommendations and tips
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>✏️</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Edit & Refine</Text>
                <Text style={styles.featureDescription}>
                  Iterate on your plans until they're perfect
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  header: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    fontSize: 36,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },
  testButton: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.warning,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
  quickStartButton: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  quickStartGradient: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  quickStartIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  quickStartText: {
    ...TYPOGRAPHY.h2,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  quickStartSubtext: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.white,
    opacity: 0.9,
  },
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  templateIconText: {
    fontSize: 28,
  },
  templateContent: {
    flex: 1,
  },
  templateTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 2,
  },
  templateCategory: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    letterSpacing: 1,
  },
  arrow: {
    fontSize: 32,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default HomeScreen;
