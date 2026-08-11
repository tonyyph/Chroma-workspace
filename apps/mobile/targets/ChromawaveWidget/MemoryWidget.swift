import SwiftUI
import WidgetKit

/// The widget surfaces.
///
/// Two families, both drawn from the same snapshot: a small "Memory Pulse" and a
/// medium "Chromawave Memory". Both render the two skins the app renders, because
/// a widget that ignores the appearance the user chose reads as a different
/// product sitting next to the real one.
///
/// The rule the layouts are built on: **colour is never the only carrier**. The
/// palette is always accompanied by the mood as a word and the date as text, so
/// the tile still says something in greyscale, under Increase Contrast, and to
/// VoiceOver.

// MARK: - Timeline

struct MemoryEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetMemorySnapshot?
  let skin: String
  /// Set when the file was readable but unusable. Drawn as a quiet line of copy
  /// rather than hidden, so a broken container is visible instead of looking
  /// like an empty library.
  let problem: String?

  static func placeholder(_ date: Date = Date()) -> MemoryEntry {
    MemoryEntry(date: date, snapshot: .placeholder, skin: "chroma", problem: nil)
  }
}

struct MemoryProvider: TimelineProvider {
  func placeholder(in context: Context) -> MemoryEntry { .placeholder() }

  func getSnapshot(in context: Context, completion: @escaping (MemoryEntry) -> Void) {
    // The gallery preview must never show the user's own memory: it is rendered
    // in contexts they did not choose, including screenshots.
    completion(context.isPreview ? .placeholder() : entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MemoryEntry>) -> Void) {
    /// One entry, refreshed on a slow cadence.
    ///
    /// The content changes when the *app* changes it, and the app calls
    /// `reloadTimelines` when it does — see `snapshotChanged`. This interval is
    /// only the backstop that keeps the relative date ("2 days ago") from going
    /// stale, so it is deliberately long: WidgetKit budgets reloads per day and
    /// silently starts ignoring an app that spends them.
    let next = Calendar.current.date(byAdding: .hour, value: 4, to: Date()) ?? Date()
    completion(Timeline(entries: [entry()], policy: .after(next)))
  }

  private func entry() -> MemoryEntry {
    switch SnapshotStore.read() {
    case let .ok(file):
      return MemoryEntry(
        date: Date(),
        snapshot: file.entries.first,
        skin: file.skin,
        problem: nil
      )
    case .empty:
      return MemoryEntry(date: Date(), snapshot: nil, skin: "chroma", problem: nil)
    case .unsupported:
      return MemoryEntry(
        date: Date(), snapshot: nil, skin: "chroma", problem: "Update Chroma Wave")
    case .corrupt:
      return MemoryEntry(date: Date(), snapshot: nil, skin: "chroma", problem: "Open the app")
    }
  }
}

// MARK: - Shared parts

/// The palette, at true weights. The one element both families and both skins
/// share, because it is the thing the product is about.
struct BandStrip: View {
  let bands: [WidgetBand]
  var square: Bool = false

  var body: some View {
    GeometryReader { proxy in
      HStack(spacing: 0) {
        ForEach(Array(bands.enumerated()), id: \.offset) { _, band in
          band.hex.chromaColor.frame(width: proxy.size.width * band.weight)
        }
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: square ? 0 : 3, style: .continuous))
  }
}

/// Chroma's ground: the memory's own colours, darkened enough to carry type.
struct ChromaGround: View {
  let snapshot: WidgetMemorySnapshot

  var body: some View {
    ZStack {
      if let image = SnapshotStore.image(at: snapshot.imagePath) {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        LinearGradient(
          colors: snapshot.bands.map { $0.hex.chromaColor },
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      }
      // A readability scrim, not decoration: the copy above it sits on whatever
      // the photograph happens to contain.
      LinearGradient(
        colors: [.black.opacity(0.15), .black.opacity(0.72)],
        startPoint: .top,
        endPoint: .bottom
      )
    }
  }
}

/// The state a fresh install sees, and it is a real design rather than a blank.
struct EmptyTile: View {
  let problem: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      BandStrip(bands: WidgetMemorySnapshot.placeholder.bands)
        .frame(height: 10)
        .opacity(0.35)
      Spacer(minLength: 0)
      Text(problem ?? "No memories yet")
        .font(.system(.footnote, design: .rounded).weight(.semibold))
      Text(problem == nil ? "Capture one to see it here." : "Something needs attention.")
        .font(.system(.caption2, design: .monospaced))
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// MARK: - Small · Memory Pulse

struct MemoryPulseView: View {
  let entry: MemoryEntry

  var body: some View {
    guard let snapshot = entry.snapshot else {
      return AnyView(EmptyTile(problem: entry.problem))
    }
    return AnyView(
      entry.skin == "swiss"
        ? AnyView(swiss(snapshot))
        : AnyView(chroma(snapshot))
    )
  }

  private func chroma(_ snapshot: WidgetMemorySnapshot) -> some View {
    ZStack(alignment: .bottomLeading) {
      ChromaGround(snapshot: snapshot)
      VStack(alignment: .leading, spacing: 3) {
        Spacer(minLength: 0)
        BandStrip(bands: snapshot.bands).frame(height: 6)
        Text(snapshot.headline)
          .font(.system(.subheadline, design: .rounded).weight(.semibold))
          .lineLimit(2)
          .minimumScaleFactor(0.85)
        if let subhead = snapshot.subhead {
          Text(subhead)
            .font(.system(.caption2, design: .rounded))
            .opacity(0.8)
            .lineLimit(1)
        }
        Text(snapshot.displayDate.uppercased())
          .font(.system(.caption2, design: .monospaced))
          .opacity(0.65)
      }
      .foregroundStyle(.white)
      .padding(.top, 2)
    }
  }

  /// Not a recolour. Paper ground, hard rules, square geometry, mono metadata —
  /// the specimen-sheet reading of the same data.
  private func swiss(_ snapshot: WidgetMemorySnapshot) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(snapshot.mood.uppercased())
        .font(.system(.caption2, design: .monospaced).weight(.semibold))
        .tracking(0.8)
      Rectangle().frame(height: 1).padding(.top, 3)
      BandStrip(bands: snapshot.bands, square: true)
        .frame(height: 26)
        .padding(.top, 6)
      Spacer(minLength: 4)
      Text(snapshot.headline)
        .font(.system(.subheadline, design: .default).weight(.bold))
        .lineLimit(2)
        .minimumScaleFactor(0.8)
      if let subhead = snapshot.subhead {
        Text(subhead).font(.system(.caption2)).lineLimit(1)
      }
      Rectangle().frame(height: 1).opacity(0.25).padding(.vertical, 3)
      Text(snapshot.displayDate.uppercased())
        .font(.system(.caption2, design: .monospaced))
    }
    .foregroundStyle(Color(white: 0.06))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// MARK: - Medium · Chromawave Memory

struct ChromawaveMemoryView: View {
  let entry: MemoryEntry

  var body: some View {
    guard let snapshot = entry.snapshot else {
      return AnyView(EmptyTile(problem: entry.problem))
    }
    return AnyView(
      entry.skin == "swiss"
        ? AnyView(swiss(snapshot))
        : AnyView(chroma(snapshot))
    )
  }

  private func chroma(_ snapshot: WidgetMemorySnapshot) -> some View {
    ZStack {
      ChromaGround(snapshot: snapshot)
      HStack(alignment: .bottom, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Spacer(minLength: 0)
          Text(snapshot.mood.uppercased())
            .font(.system(.caption2, design: .monospaced))
            .tracking(1)
            .opacity(0.7)
          Text(snapshot.headline)
            .font(.system(.title3, design: .rounded).weight(.semibold))
            .lineLimit(2)
            .minimumScaleFactor(0.8)
          if let subhead = snapshot.subhead {
            Text(subhead).font(.system(.footnote, design: .rounded)).opacity(0.85).lineLimit(1)
          }
          BandStrip(bands: snapshot.bands).frame(height: 8).padding(.top, 2)
          Text(snapshot.displayDate.uppercased())
            .font(.system(.caption2, design: .monospaced))
            .opacity(0.6)
        }
        if let artwork = SnapshotStore.image(at: snapshot.artworkPath) {
          Image(uiImage: artwork)
            .resizable()
            .scaledToFill()
            .frame(width: 74, height: 74)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
      }
      .foregroundStyle(.white)
    }
  }

  private func swiss(_ snapshot: WidgetMemorySnapshot) -> some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 0) {
        HStack {
          Text("CHROMA WAVE")
            .font(.system(.caption2, design: .monospaced).weight(.bold))
            .tracking(1.2)
          Spacer()
          Text(snapshot.displayDate.uppercased())
            .font(.system(.caption2, design: .monospaced))
        }
        Rectangle().frame(height: 1.5).padding(.top, 4)
        Text(snapshot.headline)
          .font(.system(.title3).weight(.bold))
          .lineLimit(2)
          .minimumScaleFactor(0.8)
          .padding(.top, 6)
        if let subhead = snapshot.subhead {
          Text(subhead).font(.system(.footnote)).lineLimit(1)
        }
        Spacer(minLength: 4)
        Text(snapshot.mood.uppercased())
          .font(.system(.caption2, design: .monospaced).weight(.semibold))
          .tracking(0.8)
        BandStrip(bands: snapshot.bands, square: true).frame(height: 18).padding(.top, 4)
      }
      // The specimen block: the dominant colour stated as an object, with its
      // own hex under it, the way a paper swatch book does it.
      VStack(spacing: 3) {
        Rectangle().fill(snapshot.dominantHex.chromaColor).frame(width: 58, height: 58)
        Text(snapshot.dominantHex.uppercased())
          .font(.system(size: 8, design: .monospaced))
      }
    }
    .foregroundStyle(Color(white: 0.06))
  }
}

// MARK: - Widgets

struct MemoryPulseWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ChromawaveMemoryPulse", provider: MemoryProvider()) { entry in
      MemoryPulseView(entry: entry)
        .widgetAccessibility(entry)
        .chromawaveContainer(entry)
    }
    .configurationDisplayName("Memory Pulse")
    .description("The last moment you read, and what it sounds like.")
    .supportedFamilies([.systemSmall])
  }
}

struct ChromawaveMemoryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ChromawaveMemory", provider: MemoryProvider()) { entry in
      ChromawaveMemoryView(entry: entry)
        .widgetAccessibility(entry)
        .chromawaveContainer(entry)
    }
    .configurationDisplayName("Chromawave Memory")
    .description("A colour, its atmosphere, and the track paired with it.")
    .supportedFamilies([.systemMedium])
  }
}

@main
struct ChromawaveWidgetBundle: WidgetBundle {
  var body: some Widget {
    MemoryPulseWidget()
    ChromawaveMemoryWidget()
  }
}

// MARK: - Container and accessibility

extension View {
  /// Background, margins and the tap destination, in one place so the two
  /// families cannot drift apart.
  ///
  /// `containerBackground` is required from iOS 17 — a widget without one is
  /// rendered with a default background it did not ask for — and unavailable
  /// before it, which is what the availability check is for. The deployment
  /// target stays at 15.1 so iOS 15 devices keep their widgets.
  @ViewBuilder
  func chromawaveContainer(_ entry: MemoryEntry) -> some View {
    let ground: Color =
      entry.skin == "swiss" ? Color(red: 0.949, green: 0.945, blue: 0.933) : Color(white: 0.03)

    if #available(iOS 17.0, *) {
      self
        .widgetURL(entry.snapshot?.url)
        .containerBackground(for: .widget) { ground }
    } else {
      self
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ground)
        .widgetURL(entry.snapshot?.url)
    }
  }

  /// One spoken sentence per tile.
  ///
  /// Without this VoiceOver reads the tile as a pile of fragments — "nocturnal",
  /// "Nightswimming", "R.E.M.", "2D" — in layout order, which is not a sentence
  /// and does not say what the widget is.
  func widgetAccessibility(_ entry: MemoryEntry) -> some View {
    let label: String = {
      guard let snapshot = entry.snapshot else {
        return entry.problem ?? "No memories yet. Capture one to see it here."
      }
      let when = snapshot.displayDate
      if let title = snapshot.trackTitle, let artist = snapshot.trackArtist {
        return "A \(snapshot.mood) memory from \(when), paired with \(title) by \(artist)."
      }
      return "A \(snapshot.mood) memory from \(when), not yet paired with music."
    }()

    return
      self
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(label))
      // The photograph and the track are the user's own; iOS hides them on a
      // locked device when the widget says they are private.
      .privacySensitive(entry.snapshot?.imagePath != nil)
  }
}

// MARK: - Previews

/// SwiftUI previews are a convenience, not the validation.
///
/// They cannot open the App Group container, so everything below renders the
/// fixtures. The real check is the widget running on a simulator against a file
/// the app wrote — `docs/10` records that run.
struct ChromawaveWidget_Previews: PreviewProvider {
  static var previews: some View {
    Group {
      MemoryPulseView(entry: .placeholder())
        .previewContext(WidgetPreviewContext(family: .systemSmall))
        .previewDisplayName("Small · chroma")

      MemoryPulseView(
        entry: MemoryEntry(date: Date(), snapshot: .unpaired, skin: "swiss", problem: nil)
      )
      .previewContext(WidgetPreviewContext(family: .systemSmall))
      .previewDisplayName("Small · swiss · unpaired")

      ChromawaveMemoryView(entry: .placeholder())
        .previewContext(WidgetPreviewContext(family: .systemMedium))
        .previewDisplayName("Medium · chroma")

      ChromawaveMemoryView(
        entry: MemoryEntry(date: Date(), snapshot: .unpaired, skin: "swiss", problem: nil)
      )
      .previewContext(WidgetPreviewContext(family: .systemMedium))
      .previewDisplayName("Medium · swiss")

      MemoryPulseView(entry: MemoryEntry(date: Date(), snapshot: nil, skin: "chroma", problem: nil))
        .previewContext(WidgetPreviewContext(family: .systemSmall))
        .previewDisplayName("Small · empty")
    }
  }
}
