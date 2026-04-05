# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-04-05

### Added
- Glassmorphism rewind (−10 s) and fast-forward (+10 s) buttons injected over the Hotstar live-stream player.
- Keyboard shortcuts: `←` / `→` arrow keys trigger seek and play the button animation.
- Ripple, icon-nudge, and floating feedback-text animations on seek.
- `MutationObserver`-based lifecycle management for Hotstar's React SPA navigation.
- Keyboard listener is attached on overlay injection and removed on cleanup — no lingering handlers.
- Responsive layout: buttons shrink to 60 px on viewports ≤ 600 px.
- Published as:
  - Chrome extension (Manifest V3) on the Chrome Web Store.
  - Firefox add-on (Manifest V3) on Firefox Add-ons (AMO).
  - Userscript on GreasyFork (synced from the `dist` branch).

### Fixed
- Right-click handler now correctly calls `seekVideo()` (was calling animation-only function in the draft).
- `video.currentTime` guard now checks for element existence, not truthiness of `currentTime`, so seeks at `t = 0` work correctly.
- Arrow-key handler skips `<input>`, `<textarea>`, and `contenteditable` targets, preventing interference with Hotstar's own text inputs.

[Unreleased]: https://github.com/ramvignesh-b/bbls/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ramvignesh-b/bbls/releases/tag/v1.0.0
