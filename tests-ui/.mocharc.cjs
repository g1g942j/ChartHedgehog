module.exports = {
  require: ["tsx/cjs"],
  spec: [
    "specs/ch-login.spec.ts",
    "specs/ch-register.spec.ts",
    "specs/ch-navbar.spec.ts",
    "specs/ch-diagrams.spec.ts",
    "specs/ch-diagram-settings.spec.ts",
    "specs/ch-diagram-editor.spec.ts",
    "specs/ch-participants.spec.ts",
    "specs/ch-profile.spec.ts",
  ],
  timeout: 60_000,
  slow: 10_000,
  ui: "bdd",
};
