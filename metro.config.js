const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's browser worker imports its WebAssembly module as an asset.
config.resolver.assetExts.push('wasm');
// The Silkscreen OFL notice is a shipped resource. Requiring it from the
// player-visible license panel makes the notice part of native Release builds.
config.resolver.assetExts.push('txt');

module.exports = withNativeWind(config, { input: './global.css' });
