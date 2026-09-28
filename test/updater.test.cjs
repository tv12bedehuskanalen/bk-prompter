const test = require("node:test");
const assert = require("node:assert/strict");
const { assetForRelease, compareVersions } = require("../server/updater.cjs");

test("updater compares semantic patch versions", () => {
  assert.equal(compareVersions("v0.6.1", "0.6.0"), 1);
  assert.equal(compareVersions("0.6.0", "v0.6.0"), 0);
  assert.equal(compareVersions("0.5.9", "0.6.0"), -1);
});

test("updater selects desktop release assets", () => {
  const release = { assets: [
    { name: "BK Prompter-0.6.1-mac-arm64.dmg", browser_download_url: "dmg" },
    { name: "BK Prompter-0.6.1-win-x64-Setup.exe", browser_download_url: "exe" },
  ] };
  assert.equal(assetForRelease(release, "darwin", "arm64").browser_download_url, "dmg");
  assert.equal(assetForRelease(release, "win32", "x64").browser_download_url, "exe");
});
