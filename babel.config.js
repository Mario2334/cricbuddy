module.exports = function (api) {
  // Keyed on the Babel env, so dev and production transforms cache separately.
  const production = api.env('production');
  return {
    presets: [
      'babel-preset-expo',
      '@babel/preset-typescript',
    ],
    plugins: [
      // Release builds drop console.log/info/debug (and the work of building their
      // arguments); errors and warnings stay.
      ...(production ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // Must stay last.
      'react-native-reanimated/plugin',
    ],
  };
};
