// App-wide error boundary. A render error anywhere below it would otherwise leave a
// white/frozen screen with no way out; instead we catch it and show a small recovery
// card with a Reload button that clears the error state (re-mounting the tree). This
// is the "figure out what to do instead of freezing" net for render-time crashes.
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface to the JS console / crash logging; non-fatal — the UI recovers below.
    console.error('[ErrorBoundary] caught render error:', error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>The app hit a snag. Tap reload to get back to baking.</Text>
        <Pressable
          onPress={this.reset}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBEDDA', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#5B3A2E', textAlign: 'center' },
  body: { fontSize: 14, color: '#9A7B6D', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  btn: { backgroundColor: '#F7A7B8', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
