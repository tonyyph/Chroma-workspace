const fs = require('node:fs');
const path = require('node:path');

const {
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} = require('expo/config-plugins');

/**
 * Adds the WidgetKit extension target, reproducibly.
 *
 * **The problem this solves.** `apps/mobile/ios/` is gitignored and regenerated
 * by `expo prebuild`. A target added by hand in Xcode lives exactly until the
 * next prebuild and then vanishes, taking the widget with it — and it vanishes
 * on a CI machine long before anyone notices locally. So the target is not a
 * thing that exists in the project; it is a thing the project is *derived from*.
 * The Swift under `targets/ChromawaveWidget/` is the source of truth, this file
 * is how it becomes an Xcode target, and both are committed.
 *
 * **Why hand-written rather than a community plugin.** Adding a build-critical
 * dependency to the one path that cannot be debugged from JavaScript was the
 * trade we chose not to make. `@expo/config-plugins` is already a transitive
 * dependency of `expo` at the exact version the SDK pins, so this file adds
 * nothing to the lockfile.
 *
 * Ordering matters and is not obvious: the dangerous mod that copies sources
 * must run *before* the Xcode mod that references them, and `withXcodeProject`
 * mods run in registration order, so the copy is registered first.
 */

const TARGET_NAME = 'ChromawaveWidget';
const SOURCE_DIR = 'targets/ChromawaveWidget';
const DEVELOPMENT_TEAM = process.env.CHROMAWAVE_IOS_DEVELOPMENT_TEAM || 'YC5GD8U2GQ';

/**
 * The shared container, and the reason there is one.
 *
 * An extension runs in its own sandbox and cannot read the app's documents
 * directory. An App Group is the only sanctioned way to hand it a file. The id
 * is derived from the bundle identifier rather than written twice, because the
 * two drifting apart produces a widget that renders the empty state forever with
 * no error anywhere.
 */
const appGroupFor = (bundleIdentifier) => `group.${bundleIdentifier}`;

/* ------------------------------------------------------------ swift sources */

/** Copies the committed Swift into the generated project. */
const withWidgetSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const from = path.join(projectRoot, SOURCE_DIR);
      const to = path.join(config.modRequest.platformProjectRoot, TARGET_NAME);

      if (!fs.existsSync(from)) {
        throw new Error(
          `[${TARGET_NAME}] Missing ${SOURCE_DIR}. The widget's Swift sources are committed and must exist before prebuild.`,
        );
      }

      // Replaced wholesale rather than merged: a stale file left behind by a
      // rename is a compile error that only appears on a clean machine.
      fs.rmSync(to, { recursive: true, force: true });
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from)) {
        fs.copyFileSync(path.join(from, entry), path.join(to, entry));
      }

      return config;
    },
  ]);

/* ------------------------------------------------------------- entitlements */

/** The app's half of the App Group. The extension's half is written as a file. */
const withAppGroupOnApp = (config) =>
  withEntitlementsPlist(config, (config) => {
    const group = appGroupFor(config.ios?.bundleIdentifier ?? 'com.chromawave.app');
    const existing = config.modResults['com.apple.security.application-groups'] ?? [];
    if (!existing.includes(group)) {
      config.modResults['com.apple.security.application-groups'] = [...existing, group];
    }
    return config;
  });

/* --------------------------------------------------------------- the target */

const withWidgetTarget = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const bundleIdentifier = config.ios?.bundleIdentifier ?? 'com.chromawave.app';
    const widgetBundleId = `${bundleIdentifier}.widget`;
    const platformRoot = config.modRequest.platformProjectRoot;

    /**
     * Rewritten on every prebuild, deliberately outside the idempotency guard
     * below.
     *
     * These files are *generated content*, not project structure: a correction
     * to the Info.plist has to reach a project that already has the target, or
     * the fix only lands on machines that happen to run `--clean`. That is how
     * a missing `CFBundleExecutable` survived a compile, an embed and a commit —
     * it was written once and never revisited.
     */
    writeSupportingFiles(platformRoot, bundleIdentifier);

    // The *target* is what must not be added twice. Build settings still run on
    // every prebuild so signing/config corrections reach reused native output.
    if (findTarget(project, TARGET_NAME)) {
      applyBuildSettings(project, bundleIdentifier, widgetBundleId);
      return config;
    }

    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, widgetBundleId);

    // A group, so the sources are visible in Xcode's navigator rather than only
    // in the build. Somebody will open this project to debug a layout.
    const swiftFiles = fs
      .readdirSync(path.join(platformRoot, TARGET_NAME))
      .filter((entry) => entry.endsWith('.swift'));

    const group = project.addPbxGroup(
      [...swiftFiles, 'Info.plist', `${TARGET_NAME}.entitlements`],
      TARGET_NAME,
      TARGET_NAME,
    );

    // Under the project root group, which is the one with no name.
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      if (typeof groups[key] === 'object' && !groups[key].name && !groups[key].path) {
        project.addToPbxGroup(group.uuid, key);
      }
    }

    project.addBuildPhase(swiftFiles, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    /**
     * Remove the stray "Copy Files" phase `addTarget` leaves behind.
     *
     * `addTarget` registers the product through `addProductFile(..., { group:
     * 'Copy Files' })`, which creates a `PBXCopyFilesBuildPhase` that belongs to
     * no target and holds the `.appex` build file. Adding the real embed phase
     * below then reuses that *same* `PBXBuildFile` — the lookup in
     * `addBuildPhase` matches on the file reference's path — and one build file
     * sitting in two phases is what makes CocoaPods' post-install hook die with
     * `[Xcodeproj] Consistency issue: no parent for object ChromawaveWidget.appex`.
     * Dropping the orphan leaves exactly one referrer, which is what Xcode wants.
     */
    removeOrphanCopyPhase(project, `${TARGET_NAME}.appex`);

    /**
     * Embed the extension in the app.
     *
     * Without this the target builds happily and produces an `.appex` that is
     * never copied into the bundle — the single most common way a widget
     * "doesn't appear" with no error to point at.
     */
    const mainTarget = project.getFirstTarget();
    project.addBuildPhase(
      [`${TARGET_NAME}.appex`],
      'PBXCopyFilesBuildPhase',
      'Embed App Extensions',
      mainTarget.uuid,
      'app_extension',
    );

    // So the app builds the extension before trying to embed it. Without the
    // dependency a clean build races and intermittently embeds nothing.
    project.addTargetDependency(mainTarget.uuid, [target.uuid]);

    applyBuildSettings(project, bundleIdentifier, widgetBundleId);

    return config;
  });

/**
 * Settings `addTarget` does not write, and that a widget does not build without.
 *
 * `IPHONEOS_DEPLOYMENT_TARGET` deliberately matches the app's 15.1 rather than
 * being raised: WidgetKit has been available since iOS 14, and raising it here
 * would silently deny widgets to iOS 15 devices that can run them perfectly
 * well. Live Activity code is `@available(iOS 16.1, *)`-gated in Swift instead,
 * which is where that constraint actually belongs.
 */
function applyBuildSettings(project, bundleIdentifier, widgetBundleId) {
  const configurations = project.pbxXCBuildConfigurationSection();

  for (const key of Object.keys(configurations)) {
    const entry = configurations[key];
    if (typeof entry !== 'object' || !entry.buildSettings) continue;

    const settings = entry.buildSettings;
    const product = String(settings.PRODUCT_NAME ?? '').replace(/"/g, '');
    if (product !== TARGET_NAME) continue;

    settings.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`;
    settings.INFOPLIST_FILE = `"${TARGET_NAME}/Info.plist"`;
    settings.CODE_SIGN_ENTITLEMENTS = `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`;
    settings.IPHONEOS_DEPLOYMENT_TARGET = '15.1';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '"1"';
    settings.SWIFT_EMIT_LOC_STRINGS = 'YES';
    // We supply a complete Info.plist; letting Xcode also generate one produces
    // two, and the build fails on a duplicate output.
    settings.GENERATE_INFOPLIST_FILE = 'NO';
    settings.SKIP_INSTALL = 'YES';
    settings.CURRENT_PROJECT_VERSION = '1';
    settings.MARKETING_VERSION = '1.0.0';
    // EAS still needs the extension target to declare the Apple team before
    // archive signing begins. The profile itself is generated from the app
    // extension declaration in app.json.
    settings.CODE_SIGN_STYLE = 'Automatic';
    settings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
  }
}

/**
 * The extension's Info.plist and entitlements.
 *
 * Written here rather than committed alongside the Swift because both contain
 * the bundle identifier, and a committed copy is a second place for it to be
 * wrong. `NSExtensionPointIdentifier` is what makes iOS treat the bundle as a
 * widget rather than as dead weight.
 */
function writeSupportingFiles(platformRoot, bundleIdentifier) {
  const directory = path.join(platformRoot, TARGET_NAME);
  fs.mkdirSync(directory, { recursive: true });

  fs.writeFileSync(
    path.join(directory, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Chroma Wave</string>
  <!-- Without this, the extension compiles, embeds, and then fails to install
       with "missing or invalid CFBundleExecutable" — a failure no build step
       reports, because it is the installer that rejects the bundle. -->
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`,
  );

  fs.writeFileSync(
    path.join(directory, `${TARGET_NAME}.entitlements`),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroupFor(bundleIdentifier)}</string>
  </array>
</dict>
</plist>
`,
  );
}

/**
 * Deletes the parentless `Copy Files` phase holding `productName`.
 *
 * Matched on both the name and its contents rather than on the name alone, so a
 * legitimate copy phase belonging to the app target is never touched.
 */
function removeOrphanCopyPhase(project, productName) {
  const phases = project.hash.project.objects.PBXCopyFilesBuildPhase ?? {};
  for (const key of Object.keys(phases)) {
    const phase = phases[key];
    if (typeof phase !== 'object' || phase === null) continue;
    if (String(phase.name ?? '').replace(/"/g, '') !== 'Copy Files') continue;

    const holdsProduct = (phase.files ?? []).some((file) =>
      String(file.comment ?? '').includes(productName),
    );
    if (!holdsProduct) continue;

    delete phases[key];
    delete phases[`${key}_comment`];
  }
}

/** `xcode` quotes target names inconsistently; compare unquoted. */
function findTarget(project, name) {
  const targets = project.pbxNativeTargetSection();
  return Object.keys(targets).some(
    (key) =>
      typeof targets[key] === 'object' &&
      String(targets[key].name ?? '').replace(/"/g, '') === name,
  );
}

module.exports = (config) => {
  config = withWidgetSources(config);
  config = withAppGroupOnApp(config);
  config = withWidgetTarget(config);
  return config;
};

module.exports.APP_GROUP_FOR = appGroupFor;
module.exports.TARGET_NAME = TARGET_NAME;
