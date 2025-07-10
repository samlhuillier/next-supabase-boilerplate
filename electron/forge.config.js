const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [
      "src/swift/Recorder"
    ],

    // TODO: add signing config
    osxSign: {
      identity: "Developer ID Application: SAM LHUILLIER JANSA (ZHJMNQM65Q)",
      entitlements: "entitlements.plist",
      "entitlements-inherit": "entitlements.plist",
    },
    osxNotarize: {
      tool: "notarytool",
      appleApiKey: "/Users/sam/Downloads/AuthKey_D9QVK9H7WB.p8",
      appleApiKeyId: "D9QVK9H7WB",
      appleApiIssuer: "c8dd02f1-5d41-41d4-8af4-1b23dec01d6d",
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
