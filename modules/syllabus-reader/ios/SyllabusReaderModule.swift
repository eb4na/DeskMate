// On-device text extraction for the syllabus importer. Nothing leaves the phone:
// PDFKit reads a PDF's embedded text; Apple's Vision framework (the engine behind
// Live Text) reads photos and scanned PDF pages. Both are free system frameworks.

import ExpoModulesCore
import PDFKit
import UIKit
import Vision

public class SyllabusReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SyllabusReader")

    // Text of every page. Pages with almost no embedded text (a scanned syllabus)
    // are rendered to an image and run through Vision instead.
    AsyncFunction("extractPdfText") { (uri: String) -> String in
      guard let url = Self.fileURL(uri), let doc = PDFDocument(url: url) else { return "" }
      var pages: [String] = []
      let count = min(doc.pageCount, 40)
      for i in 0..<count {
        guard let page = doc.page(at: i) else { continue }
        let embedded = page.string ?? ""
        if embedded.trimmingCharacters(in: .whitespacesAndNewlines).count >= 40 {
          pages.append(embedded)
        } else {
          let bounds = page.bounds(for: .mediaBox)
          let scale = 2000 / max(bounds.width, bounds.height, 1)
          let img = page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)
          if let cg = img.cgImage { pages.append(Self.recognize(cg)) }
        }
      }
      return pages.joined(separator: "\n")
    }

    AsyncFunction("recognizeImageText") { (uri: String) -> String in
      guard let url = Self.fileURL(uri),
            let data = try? Data(contentsOf: url),
            let img = UIImage(data: data) else { return "" }
      guard let cg = Self.upright(img).cgImage else { return "" }
      return Self.recognize(cg)
    }
  }

  private static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") { return URL(string: uri) }
    return URL(fileURLWithPath: uri)
  }

  // Camera photos carry an EXIF orientation; Vision wants upright pixels.
  private static func upright(_ img: UIImage) -> UIImage {
    if img.imageOrientation == .up { return img }
    let r = UIGraphicsImageRenderer(size: img.size)
    return r.image { _ in img.draw(in: CGRect(origin: .zero, size: img.size)) }
  }

  // Vision returns one observation per text run. Rebuild LINES by grouping runs
  // whose vertical centres line up — so a table row "Oct 12 | Midterm 1" comes back
  // as one line, which is what the date parser needs.
  private static func recognize(_ image: CGImage) -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    request.recognitionLanguages = ["en-US", "es-ES", "fr-FR", "ja-JP", "ko-KR", "zh-Hans", "zh-Hant"]
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do { try handler.perform([request]) } catch { return "" }
    let obs = (request.results ?? []).compactMap { o -> (text: String, box: CGRect)? in
      guard let t = o.topCandidates(1).first?.string else { return nil }
      return (t, o.boundingBox)
    }
    // Vision's origin is bottom-left: higher midY = higher on the page.
    let sorted = obs.sorted { $0.box.midY > $1.box.midY }
    var rows: [[(text: String, box: CGRect)]] = []
    for o in sorted {
      if let last = rows.last, let ref = last.first,
         abs(ref.box.midY - o.box.midY) < min(ref.box.height, o.box.height) * 0.6 {
        rows[rows.count - 1].append(o)
      } else {
        rows.append([o])
      }
    }
    return rows
      .map { $0.sorted { $0.box.minX < $1.box.minX }.map { $0.text }.joined(separator: "  ") }
      .joined(separator: "\n")
  }
}
