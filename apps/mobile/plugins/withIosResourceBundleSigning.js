const { withPodfile } = require('@expo/config-plugins');

const TAG = 'chromawave-ios-resource-bundle-signing';
const BEGIN = `@generated begin ${TAG} - expo prebuild (DO NOT MODIFY)`;
const END = `@generated end ${TAG}`;

const PATCH = [
  `    # ${BEGIN}`,
  '    installer.pods_project.targets.each do |target|',
  "      next unless target.respond_to?(:product_type) && target.product_type == 'com.apple.product-type.bundle'",
  '',
  '      target.build_configurations.each do |build_configuration|',
  "        build_configuration.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'",
  "        build_configuration.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'",
  '      end',
  '    end',
  `    # ${END}`,
].join('\n');

function removeExistingPatch(contents) {
  const pattern = new RegExp(
    `\\n?\\s*# ${escapeRegExp(BEGIN)}[\\s\\S]*?\\s*# ${escapeRegExp(END)}\\n?`,
    'm',
  );
  return contents.replace(pattern, '\n');
}

function insertResourceBundleSigningPatch(contents) {
  const cleaned = removeExistingPatch(contents);
  const lines = cleaned.split('\n');
  const postInstallStart = lines.findIndex((line) => line.includes('react_native_post_install('));

  if (postInstallStart < 0) {
    throw new Error(`[${TAG}] Could not find react_native_post_install in the iOS Podfile.`);
  }

  const insertionIndex = lines.findIndex(
    (line, index) => index > postInstallStart && /^\s*\)\s*$/.test(line),
  );

  if (insertionIndex < 0) {
    throw new Error(
      `[${TAG}] Could not find the end of react_native_post_install in the iOS Podfile.`,
    );
  }

  lines.splice(insertionIndex + 1, 0, PATCH);
  return lines.join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = insertResourceBundleSigningPatch(config.modResults.contents);
    return config;
  });

module.exports.insertResourceBundleSigningPatch = insertResourceBundleSigningPatch;
