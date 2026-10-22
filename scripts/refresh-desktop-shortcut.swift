// File metadata only: point the desktop alias at the latest bundle and set its icon.
import AppKit
let arguments = CommandLine.arguments
if arguments.count != 3 { exit(2) }
let target = URL(fileURLWithPath: arguments[1])
let shortcut = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop/Reqoto Workbench")
let bookmark = try target.bookmarkData(options: .suitableForBookmarkFile, includingResourceValuesForKeys: nil, relativeTo: nil)
try URL.writeBookmarkData(bookmark, to: shortcut)
if let image = NSImage(contentsOfFile: arguments[2]) {
    if !NSWorkspace.shared.setIcon(image, forFile: shortcut.path, options: []) { exit(1) }
}
