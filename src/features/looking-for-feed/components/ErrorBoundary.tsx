import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors, glass, radii } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { EmptyState } from '../../../ui/EmptyState';
import { GlassView } from '../../../ui/GlassView';
import { MeshBackground } from '../../../ui/MeshBackground';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    console.log('[ErrorBoundary] Retrying...');

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call the onRetry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <MeshBackground variant="calm" style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <EmptyState
              icon="oops"
              tone="error"
              title="Something went wrong"
              message="We hit an unexpected bump. It's been logged and we'll get it fixed."
              actionLabel="Try again"
              onAction={this.handleRetry}
            />

            {/* Show error details in development */}
            {__DEV__ && this.state.error && (
              <GlassView mode="frost" radius={radii.lg} shadow="glass" style={styles.errorDetails}>
                <AppText variant="overline" color={colors.danger} style={styles.errorDetailsTitle}>
                  Error details (development only)
                </AppText>

                <View style={styles.errorDetailSection}>
                  <AppText variant="smallStrong" style={styles.errorDetailLabel}>
                    Error
                  </AppText>
                  <AppText style={styles.errorDetailText} color={colors.textSoft}>
                    {this.state.error.name}: {this.state.error.message}
                  </AppText>
                </View>

                {this.state.error.stack && (
                  <View style={styles.errorDetailSection}>
                    <AppText variant="smallStrong" style={styles.errorDetailLabel}>
                      Stack trace
                    </AppText>
                    <ScrollView style={styles.stackTraceContainer} horizontal>
                      <AppText style={styles.stackTraceText} color={colors.textSoft}>
                        {this.state.error.stack}
                      </AppText>
                    </ScrollView>
                  </View>
                )}

                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <View style={styles.errorDetailSection}>
                    <AppText variant="smallStrong" style={styles.errorDetailLabel}>
                      Component stack
                    </AppText>
                    <ScrollView style={styles.stackTraceContainer} horizontal>
                      <AppText style={styles.stackTraceText} color={colors.textSoft}>
                        {this.state.errorInfo.componentStack}
                      </AppText>
                    </ScrollView>
                  </View>
                )}
              </GlassView>
            )}
          </ScrollView>
        </MeshBackground>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  errorDetails: {
    width: '100%',
    padding: 16,
  },
  errorDetailsTitle: {
    marginBottom: 12,
  },
  errorDetailSection: {
    marginBottom: 12,
  },
  errorDetailLabel: {
    marginBottom: 6,
  },
  errorDetailText: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: glass.fillSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    padding: 8,
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  stackTraceContainer: {
    maxHeight: 150,
    backgroundColor: glass.fillSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    borderRadius: radii.xs,
    padding: 8,
  },
  stackTraceText: {
    fontFamily: MONO,
    fontSize: 10,
    lineHeight: 14,
  },
});

export default ErrorBoundary;
