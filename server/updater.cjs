const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

// Keep release settings here so they are easy to maintain.
const GITHUB_REPOSITORY = "tv12bedehuskanalen/bk-prompter";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`;

function versionParts(value) {
  const match = String(value || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}
function compareVersions(a, b) {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
function assetForRelease(release, platform = process.platform, arch = process.arch) {
  const assets = release?.assets || [];
  const names = assets.map((asset) => asset.name);
  if (platform === "win32") return assets.find((a) => /Setup\.exe$/i.test(a.name) && (arch !== "x64" || !/arm64/i.test(a.name))) || null;
  if (platform === "darwin") return assets.find((a) => /\.dmg$/i.test(a.name) && (arch !== "arm64" || /arm64|aarch64/i.test(a.name))) || assets.find((a) => /\.zip$/i.test(a.name) && (arch !== "arm64" || /arm64|aarch64/i.test(a.name))) || null;
  return assets.find((a) => /\.AppImage$/i.test(a.name)) || null;
}

function createUpdater({ currentVersion, dataDir, platform = process.platform, arch = process.arch } = {}) {
  let state = { checking: false, downloading: false, available: false, current: currentVersion, latest: null, release: null, asset: null, downloaded: null, error: null };
  const updateDir = path.join(dataDir || os.tmpdir(), "updates");
  const snapshot = () => ({ ...state, repository: GITHUB_REPOSITORY });
  async function check() {
    state = { ...state, checking: true, error: null };
    try {
      const response = await fetch(RELEASES_URL, { headers: { "User-Agent": "BK-Prompter-Updater", Accept: "application/vnd.github+json" } });
      if (!response.ok) throw Error(`GitHub svarte med HTTP ${response.status}.`);
      const release = await response.json();
      const asset = assetForRelease(release, platform, arch);
      state = { ...state, checking: false, latest: release.tag_name, release: { tag: release.tag_name, name: release.name, url: release.html_url, notes: release.body || "" }, asset: asset ? { name: asset.name, size: asset.size, url: asset.browser_download_url } : null, available: compareVersions(release.tag_name, currentVersion) > 0 && !!asset };
    } catch (error) { state = { ...state, checking: false, error: error.message }; }
    return snapshot();
  }
  async function download() {
    if (!state.asset) throw Error("Ingen passende installasjon funnet for denne maskinen.");
    fs.mkdirSync(updateDir, { recursive: true });
    state = { ...state, downloading: true, error: null };
    try {
      const response = await fetch(state.asset.url, { headers: { "User-Agent": "BK-Prompter-Updater", Accept: "application/octet-stream" } });
      if (!response.ok || !response.body) throw Error(`Kunne ikke laste ned oppdateringen (HTTP ${response.status}).`);
      const target = path.join(updateDir, path.basename(state.asset.name));
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
      state = { ...state, downloading: false, downloaded: target };
      return snapshot();
    } catch (error) { state = { ...state, downloading: false, error: error.message }; throw error; }
  }
  function openInstaller() {
    if (!state.downloaded) throw Error("Last ned oppdateringen først.");
    if (platform === "win32") spawn(state.downloaded, [], { detached: true, stdio: "ignore" }).unref();
    else if (platform === "darwin") spawn("open", [state.downloaded], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [state.downloaded], { detached: true, stdio: "ignore" }).unref();
    return snapshot();
  }
  return { check, download, openInstaller, status: snapshot, assetForRelease, compareVersions };
}

module.exports = { GITHUB_REPOSITORY, assetForRelease, compareVersions, createUpdater };
