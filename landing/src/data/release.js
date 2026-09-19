// ---------------------------------------------------------------------------
// Single source of truth for every release fact printed on this page.
// Nothing here is estimated. If a value can't be verified, it stays null and
// the UI hides the affordance that would have shown it.
// ---------------------------------------------------------------------------

export const REPO = "https://github.com/FTC-KJSSE/fintrace";
export const RELEASES_URL = `${REPO}/releases`;
export const VERSION = "1.0.0";
export const TAG = `v${VERSION}`;

const DOWNLOAD_BASE = `${REPO}/releases/download/${TAG}`;

// Asset filenames are as GitHub serves them: electron-builder writes
// "FinTrace Setup 1.0.0.exe" locally, but GitHub replaces the spaces with dots
// when the asset is uploaded, so that is what actually lands in Downloads.
//
// TODO(tanmay): paste the two SHA-256 values here once you have them.
// Generate on Windows with:  certutil -hashfile "<file>" SHA256
// Leave as null and the checksum row simply won't render.
export const BUILDS = [
  {
    id: "installer",
    name: "Installer",
    recommended: true,
    filename: "FinTrace.Setup.1.0.0.exe",
    size: "107 MB",
    url: `${DOWNLOAD_BASE}/FinTrace.Setup.1.0.0.exe`,
    sha256: null,
    blurb: "Desktop and Start Menu shortcuts, choose your own install location.",
    details: ["Creates desktop shortcut", "Creates Start Menu entry", "Custom install directory", "Clean uninstall entry"],
  },
  {
    id: "portable",
    name: "Portable",
    recommended: false,
    filename: "FinTrace-1.0.0-Portable.exe",
    size: "107 MB",
    url: `${DOWNLOAD_BASE}/FinTrace-1.0.0-Portable.exe`,
    sha256: null,
    blurb: "Single executable. Runs from anywhere with no installation.",
    details: ["No installer", "No registry writes", "Run from a USB drive", "Delete the file to remove"],
  },
];

export const PLATFORM = {
  os: "Windows 10 / 11",
  arch: "x64",
  runtime: "Electron 44 — Node.js and Vite are bundled, nothing to install separately",
  privileges: "No administrator rights required",
};

export const STATS = [
  { label: "version", value: `v${VERSION}` },
  { label: "platform", value: "Windows x64" },
  { label: "size", value: "107 MB" },
  { label: "tests", value: "38/38 passing" },
];
