const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.caf` is not a default Metro asset extension, so the sound cues would resolve
// to undefined without this — a silent failure that only shows up as no audio.
config.resolver.assetExts = [...config.resolver.assetExts, 'caf'];

module.exports = config;
