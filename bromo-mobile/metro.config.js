const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const base = getDefaultConfig(projectRoot);

function resolveFromApp(moduleName) {
  return require.resolve(moduleName, { paths: [projectRoot] });
}

/**
 * Force a single `react` / `react-native` resolution tree. Package exports +
 * pnpm can otherwise pull mismatched copies and break the renderer bridge.
 */
function dedupeReactNativeResolver(context, moduleName, platform) {
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    try {
      return { type: 'sourceFile', filePath: resolveFromApp(moduleName) };
    } catch {
      // fall through to Metro default
    }
  }
  return context.resolveRequest(context, moduleName, platform);
}

let config = mergeConfig(base, {
  watchFolders: [monorepoRoot],
  resolver: {
    unstable_enableSymlinks: true,
    // `true` can resolve `react` via different export paths than RN's renderer.
    unstable_enablePackageExports: false,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    resolveRequest: dedupeReactNativeResolver,
  },
});

config = withNativeWind(config, { input: './global.css' });

module.exports = config;
