// Lightweight registry so the first-launch tutorial can point arrows at real UI
// elements without hardcoding screen coordinates (which would drift between phone
// and tablet — the home chips, Start button and curved tab bar all move by device
// class). Each anchor element registers its native node here; the tutorial overlay
// measures the node's window rect on demand, so arrows land correctly everywhere.
import type { View } from 'react-native';

export type TargetRect = { x: number; y: number; width: number; height: number };

const nodes: Record<string, View | null> = {};

// Called from a `ref` callback on the anchor element. Pass null on unmount.
export function setTutorialTarget(id: string, node: View | null) {
  if (node) nodes[id] = node;
  else delete nodes[id];
}

// Resolve a target's on-screen rect, or null if it isn't mounted/measurable yet.
export function measureTutorialTarget(id: string): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    const node = nodes[id];
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      if (!width && !height) resolve(null);
      else resolve({ x, y, width, height });
    });
  });
}
