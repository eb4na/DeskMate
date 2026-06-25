// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore Claude's git worktrees under .claude/ — they're full repo checkouts, so
// Metro would otherwise watch dozens of DUPLICATE asset basenames (desk art,
// companions, etc.) and mis-resolve require()s to the wrong image (e.g. the desk
// ingredients rendering as a cat / flag / sign). Excluding them keeps the asset
// registry clean.
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];
config.resolver.blockList = [...existingBlockList, /[\\/]\.claude[\\/].*/];

// @supabase/supabase-js ships an ESM build (index.mjs) that uses a raw dynamic
// `import(OTEL_PKG)` to lazily load OpenTelemetry. Hermes (Expo Go's JS engine)
// can't compile a dynamic import(), so the bundle fails to build. Pin the
// Supabase main entry to its CJS build (index.cjs), which uses require() instead
// — Hermes-safe. Only this one specifier is redirected; everything else uses
// Expo's default resolution.
const supabaseCjs = require.resolve('@supabase/supabase-js/dist/index.cjs');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return { type: 'sourceFile', filePath: supabaseCjs };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
