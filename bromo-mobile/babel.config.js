module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.tsx', '.ts'],
        alias: {
          '@': './src',
        },
      },
    ],
    // Must be last — required for Reanimated v4 worklets
    'react-native-worklets/plugin',
  ],
};
