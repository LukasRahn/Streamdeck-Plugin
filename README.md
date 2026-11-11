#  ShutDown Stream Deck Plugin

A Stream Deck plugin that shows a multi-key countdown and runs a system action when it finishes: shut down, restart, sleep, hibernate, log off, lock the screen or turn off the display. Built for Windows and macOS with the Stream Deck app (SDK 3+, Node.js 20); macOS is untested. English and German.

## Install
Download the `.streamDeckPlugin` file from the [latest release](../../releases/latest) and double-click it.

Or build it yourself:
1. `npm install`
2. `npm run pack` → `dist/com.lukas.shutdown.streamDeckPlugin`, double-click it.

## Usage
- Add one **Shutdown Master** action and configure it in the property inspector:
  - Countdown: slider 1–60 plus unit (seconds, minutes, hours), so up to 60 h, e.g. as a sleep timer
  - Action: shut down, restart, sleep, hibernate, log off, lock screen, turn off display (monitors go to standby, the PC keeps running)
  - Force (Windows): close apps without asking. Unsaved work is lost.
  - Accent color
- Add **Shutdown Child** actions on the surrounding keys. The countdown is drawn once across all keys.
- Settings are plugin-wide: every Master and Child key uses the same settings, on any page or device.
- Press the master (or any child) to start or cancel the countdown.
- Hold the master for 0.8 s to switch between **Preview** (animation only) and **Armed** (the action really runs at the end).
- If the action fails (e.g. hibernate disabled, or a macOS permission denied), the keys show Stream Deck's warning triangle.

macOS asks once for permission to control "System Events" (shut down, restart, log off) and needs the Accessibility permission for "lock screen".

## Development
- Build: `npm run build`
- Watch (auto-rebuild + Stream Deck restart): `npm run watch`
- Tests: `npm test`
- Package: `npm run pack`
- Release: push a tag like `v0.3.0`; GitHub Actions builds, tests and attaches the package to a release.
