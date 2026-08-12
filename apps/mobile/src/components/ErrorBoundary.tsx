import { space } from '@cw/tokens';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, EmptyGlyph, Screen, Text } from '@/ui';

type Props = {
  children: ReactNode;
  /** Shown above the message, so the user knows which part failed. */
  label?: string;
  /** Called when the user retries; use it to navigate away from a broken route. */
  onReset?: () => void;
};

type State = { error: Error | null };

/**
 * Catches render-time failures so one broken screen does not take down the app.
 *
 * This matters most around the camera: Vision Camera's hooks are Nitro-backed and
 * throw during render when the native module or its worklets package is missing —
 * which, without a boundary, unmounts the whole tree and looks like a crash.
 *
 * Deliberately a class component: `componentDidCatch` has no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as a console error rather than an analytics event: this fires on the
    // render path, and an analytics call here can itself throw.
    console.error('[ErrorBoundary]', this.props.label ?? 'screen', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Screen>
        <View style={styles.body}>
          <EmptyGlyph kind="offline" />
          <Text variant="section">Something broke here</Text>
          <Text style={styles.copy} tone="secondary" variant="body">
            {this.props.label
              ? `${this.props.label} could not load. The rest of the app is fine.`
              : 'This screen could not load. The rest of the app is fine.'}
          </Text>
          {/* The message is the one thing that makes this reportable. */}
          <Text style={styles.detail} tone="tertiary" variant="monoSmall">
            {error.message}
          </Text>
          <Button label="Try again" onPress={this.reset} size="xs" />
        </View>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
  },
  copy: { textAlign: 'center' },
  detail: { textAlign: 'center' },
});
