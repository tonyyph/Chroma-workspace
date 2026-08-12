import ExpoModulesCore
import Foundation
import WidgetKit

/// The App Group container, and the WidgetKit reload, exposed to JavaScript.
///
/// **Why this module exists at all.** The widget extension runs in its own
/// sandbox and cannot read the app's documents directory; an App Group container
/// is the only sanctioned way to hand it a file. Nothing already in this project
/// can resolve that container's path from JavaScript — `expo-file-system` has no
/// concept of App Groups, and `react-native-mmkv` resolves one internally but
/// does not export the resolver, and switching it on would silently relocate
/// every existing user's library. So this is roughly ninety lines of Swift
/// instead of a data-loss risk. See `docs/13` R1.
///
/// Every function is synchronous and total: it returns a value or a `false`,
/// never a rejected promise. The caller is on the tail of a save, and a save must
/// not fail because a widget could not be updated.
public class ChromawaveSharedContainerModule: Module {
  /// Derived from the bundle identifier rather than written down, because the
  /// entitlement, the widget's copy and this string all have to agree, and a
  /// literal in three places disagrees eventually.
  private var appGroupIdentifier: String {
    "group.\(Bundle.main.bundleIdentifier ?? "com.chromawave.app")"
  }

  private var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
  }

  /// Everything the app publishes lives under one directory, so `prune` has a
  /// bounded thing to walk and can never reach a file it did not write.
  private static let imageFolder = "widget"

  public func definition() -> ModuleDefinition {
    Name("ChromawaveSharedContainer")

    /// Null when the entitlement is missing — an ordinary state on a simulator
    /// without provisioning, and the signal the writer uses to become a no-op.
    Function("containerPath") { () -> String? in
      self.containerURL?.path
    }

    Function("write") { (relativePath: String, contents: String) -> Bool in
      guard let target = self.resolve(relativePath) else { return false }
      do {
        try FileManager.default.createDirectory(
          at: target.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        // Atomic, so a widget waking mid-write reads the previous complete file
        // rather than half of the next one.
        try contents.write(to: target, atomically: true, encoding: .utf8)
        return true
      } catch {
        return false
      }
    }

    Function("read") { (relativePath: String) -> String? in
      guard let target = self.resolve(relativePath) else { return nil }
      return try? String(contentsOf: target, encoding: .utf8)
    }

    Function("copyIn") { (sourceUri: String, relativePath: String) -> Bool in
      guard
        let target = self.resolve(relativePath),
        let source = URL(string: sourceUri) ?? URL(fileURLWithPath: sourceUri) as URL?
      else { return false }

      let manager = FileManager.default
      // `file://` uris arrive from expo-file-system; bare paths arrive from a
      // few older call sites. Both are accepted rather than making the caller
      // care which it has.
      let resolved = source.isFileURL ? source : URL(fileURLWithPath: sourceUri)
      guard manager.fileExists(atPath: resolved.path) else { return false }

      do {
        try manager.createDirectory(
          at: target.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        if manager.fileExists(atPath: target.path) {
          try manager.removeItem(at: target)
        }
        try manager.copyItem(at: resolved, to: target)
        return true
      } catch {
        return false
      }
    }

    /// Deletes every image under `widget/` that the published snapshot no longer
    /// names. A memory the user deleted must not leave its photograph readable
    /// in a container other processes can open.
    Function("prune") { (keep: [String]) -> Int in
      guard let container = self.containerURL else { return 0 }
      let folder = container.appendingPathComponent(Self.imageFolder)
      let manager = FileManager.default

      guard
        let entries = try? manager.contentsOfDirectory(
          at: folder, includingPropertiesForKeys: nil)
      else { return 0 }

      let kept = Set(keep.map { ($0 as NSString).lastPathComponent })
      var removed = 0
      for entry in entries where !kept.contains(entry.lastPathComponent) {
        if (try? manager.removeItem(at: entry)) != nil { removed += 1 }
      }
      return removed
    }

    /// Asks WidgetKit to rebuild its timelines.
    ///
    /// Rationed by the system, which is why the JavaScript side gates this on
    /// the content having actually changed — see `snapshotChanged`. Calling it
    /// on every save is how an app's widgets quietly stop updating.
    Function("reloadWidgets") { () -> Void in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }

  /// Refuses anything that would escape the container.
  ///
  /// The relative paths this module receives are built from memory ids, so they
  /// are not attacker-controlled today — but a path-joining function that
  /// accepts `../` is one refactor away from being the thing that writes outside
  /// the sandbox, and the check costs a line.
  private func resolve(_ relativePath: String) -> URL? {
    guard let container = containerURL else { return nil }
    guard !relativePath.contains(".."), !relativePath.hasPrefix("/") else { return nil }
    return container.appendingPathComponent(relativePath)
  }
}
