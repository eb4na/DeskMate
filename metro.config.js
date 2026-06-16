// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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
