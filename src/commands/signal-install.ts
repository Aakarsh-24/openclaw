// Replace these lines:
let expectedHash: string | null = null;
let checksumFilePath: string | null = null;
if (checksumAsset && checksumAsset.browser_download_url) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-signal-"));
  checksumFilePath = path.join(tmpDir, checksumAsset.name!);
  await downloadToFile(checksumAsset.browser_download_url, checksumFilePath);
  const checksumContent = await fs.readFile(checksumFilePath, "utf8");
  const line = checksumContent.split("\n").find((l) => l.includes(assetName));
  if (line) {
    expectedHash = line.split(/\s+/)[0];
  }
}

// With these lines:
let expectedHash: string | null = null;
const checksumAsset = assets.find(
  (a) =>
    typeof a.name === "string" &&
    /sha256sum/i.test(a.name || "") &&
    a.browser_download_url,
);
if (!checksumAsset || !checksumAsset.browser_download_url) {
  return { ok: false, error: "No checksum file found for integrity verification." };
}
const tmpChecksumDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-signal-"));
const checksumFilePath = path.join(tmpChecksumDir, checksumAsset.name!);
await downloadToFile(checksumAsset.browser_download_url, checksumFilePath);
const checksumContent = await fs.readFile(checksumFilePath, "utf8");
const line = checksumContent.split("\n").find((l) => l.includes(assetName));
if (line) {
  expectedHash = line.split(/\s+/)[0];
} else {
  return { ok: false, error: "Checksum for asset not found in checksum file." };
}
// 🔒 VOTAL.AI Security Fix: Untrusted download and install of remote binary without integrity verification (supply-chain risk) [CWE-494] - CRITICAL