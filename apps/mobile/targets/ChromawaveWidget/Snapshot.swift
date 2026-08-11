import Foundation
import SwiftUI
import UIKit

/// The Swift half of `packages/domain/src/snapshot.ts`.
///
/// Every field here has a counterpart there and the two are checked against each
/// other by that file's "Codable compatibility" suite. Synthesised `Decodable`
/// fails the *whole* decode on a key it expects and cannot find, so the TS side
/// emits every key explicitly — including nulls — and this side declares the
/// nullable ones as optionals. Neither half may change alone.
///
/// Nothing in this file computes anything a widget could get wrong: contrast,
/// truncation, ordering and band weights all arrive already decided.

let kSchemaVersion = 1
let kSnapshotFileName = "widget-snapshot.json"

struct WidgetBand: Codable, Hashable {
  let hex: String
  /// 0–1, already normalised to sum to one across the set.
  let weight: Double
}

struct WidgetMemorySnapshot: Codable, Hashable, Identifiable {
  let id: String
  /// Relative to the App Group container. Never absolute — the app's data
  /// container UUID changes between installs.
  let imagePath: String?
  let artworkPath: String?
  let bands: [WidgetBand]
  let dominantHex: String
  /// Already contrast-checked against `dominantHex` on the JavaScript side.
  let inkHex: String
  let mood: String
  let trackTitle: String?
  let trackArtist: String?
  /// ISO 8601. Formatted here, in the viewer's locale.
  let capturedAt: String
  let deepLink: String
}

struct WidgetSnapshotFile: Codable {
  let schemaVersion: Int
  let updatedAt: String
  let skin: String
  let entries: [WidgetMemorySnapshot]
}

// MARK: - Reading

/// Mirrors `readWidgetSnapshotFile`, including its refusals.
///
/// The important behaviour is what it does *not* do: an unrecognised
/// `schemaVersion` is refused rather than best-effort decoded, because a widget
/// that renders a confident guess at an unknown shape puts wrong information on
/// somebody's lock screen. Refusing shows the empty state, which is honest.
enum SnapshotRead {
  case ok(WidgetSnapshotFile)
  case empty
  case unsupported(Int)
  case corrupt

  var file: WidgetSnapshotFile? {
    if case let .ok(file) = self { return file }
    return nil
  }
}

enum SnapshotStore {
  /// Resolved from the extension's own entitlement rather than passed in, so the
  /// widget and the app cannot disagree about which container they mean.
  static var appGroup: String {
    guard
      let identifier = Bundle.main.object(forInfoDictionaryKey: "CFBundleIdentifier") as? String
    else { return "group.com.chromawave.app" }
    // `com.chromawave.app.widget` → `group.com.chromawave.app`
    let base = identifier.hasSuffix(".widget") ? String(identifier.dropLast(7)) : identifier
    return "group.\(base)"
  }

  static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
  }

  static func read() -> SnapshotRead {
    guard let container = containerURL else { return .empty }
    let url = container.appendingPathComponent(kSnapshotFileName)

    guard let data = try? Data(contentsOf: url), !data.isEmpty else { return .empty }

    // The version is read before the body, so a future file is refused rather
    // than producing a decode error that looks like corruption.
    guard
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let version = object["schemaVersion"] as? Int
    else { return .corrupt }

    guard version == kSchemaVersion else { return .unsupported(version) }

    guard let file = try? JSONDecoder().decode(WidgetSnapshotFile.self, from: data) else {
      return .corrupt
    }
    return .ok(file)
  }

  /// An image the app cached into the shared container for exactly this purpose.
  ///
  /// Returns nil rather than reaching for the original: the app's copy is
  /// already resized for the largest family, and decoding a camera frame during
  /// a timeline request is how a widget gets killed for exceeding its memory
  /// limit.
  static func image(at relativePath: String?) -> UIImage? {
    guard let relativePath, let container = containerURL else { return nil }
    let url = container.appendingPathComponent(relativePath)
    guard let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }
}

// MARK: - Presentation helpers

extension String {
  /// `#7C5CFF` → Color. Returns a mid grey for anything unparseable, because a
  /// widget must draw something and a crash in a timeline provider is a blank
  /// tile the user cannot dismiss.
  var chromaColor: Color {
    var hex = trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") { hex.removeFirst() }
    guard hex.count == 6, let value = UInt64(hex, radix: 16) else {
      return Color(white: 0.5)
    }
    return Color(
      .sRGB,
      red: Double((value & 0xFF0000) >> 16) / 255,
      green: Double((value & 0x00FF00) >> 8) / 255,
      blue: Double(value & 0x0000FF) / 255,
      opacity: 1
    )
  }
}

extension WidgetMemorySnapshot {
  var capturedDate: Date? {
    ISO8601DateFormatter.chromawave.date(from: capturedAt)
  }

  /// "3 days ago" in the viewer's language, or a plain date when it is old
  /// enough that a relative phrase stops being useful.
  var displayDate: String {
    guard let date = capturedDate else { return "" }
    let elapsed = Date().timeIntervalSince(date)
    if elapsed < 60 * 60 * 24 * 7 {
      let formatter = RelativeDateTimeFormatter()
      formatter.unitsStyle = .abbreviated
      return formatter.localizedString(for: date, relativeTo: Date())
    }
    return date.formatted(.dateTime.day().month(.abbreviated))
  }

  /// What the widget calls the memory when there is no track yet. Never the
  /// user's own note — that never crosses into this process. See `snapshot.ts`.
  var headline: String { trackTitle ?? mood.capitalized }
  var subhead: String? { trackArtist }
  var isPaired: Bool { trackTitle != nil }

  var url: URL? { URL(string: deepLink) }
}

extension ISO8601DateFormatter {
  /// The app writes fractional seconds; the default formatter rejects them, and
  /// a nil date here silently blanks every timestamp in every widget family.
  static let chromawave: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}

// MARK: - Fixtures

/// Placeholder and preview content.
///
/// Deliberately real-looking rather than lorem: a placeholder with a one-word
/// title hides exactly the layout bug — a long title colliding with the date —
/// that shipping without one guarantees.
extension WidgetMemorySnapshot {
  static let placeholder = WidgetMemorySnapshot(
    id: "00000000-0000-4000-8000-000000000000",
    imagePath: nil,
    artworkPath: nil,
    bands: [
      WidgetBand(hex: "#2A2352", weight: 0.42),
      WidgetBand(hex: "#7C5CFF", weight: 0.26),
      WidgetBand(hex: "#22D3EE", weight: 0.17),
      WidgetBand(hex: "#F4A38C", weight: 0.15),
    ],
    dominantHex: "#2A2352",
    inkHex: "#FFFFFF",
    mood: "nocturnal",
    trackTitle: "Nightswimming",
    trackArtist: "R.E.M.",
    capturedAt: ISO8601DateFormatter.chromawave.string(from: Date()),
    deepLink: "chromawave://memory/00000000-0000-4000-8000-000000000000"
  )

  /// The unpaired case, which is the one most likely to be laid out badly
  /// because it is the one nobody screenshots.
  static let unpaired = WidgetMemorySnapshot(
    id: "00000000-0000-4000-8000-000000000001",
    imagePath: nil,
    artworkPath: nil,
    bands: [
      WidgetBand(hex: "#F2F1EE", weight: 0.55),
      WidgetBand(hex: "#101010", weight: 0.30),
      WidgetBand(hex: "#D8352A", weight: 0.15),
    ],
    dominantHex: "#F2F1EE",
    inkHex: "#09090B",
    mood: "austere",
    trackTitle: nil,
    trackArtist: nil,
    capturedAt: ISO8601DateFormatter.chromawave.string(from: Date()),
    deepLink: "chromawave://memory/00000000-0000-4000-8000-000000000001"
  )
}
