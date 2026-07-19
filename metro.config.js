const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's browser worker imports its WebAssembly module as an asset.
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
