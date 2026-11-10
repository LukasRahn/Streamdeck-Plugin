#  ShutDown Stream Deck Plugin

A Stream Deck plugin that shows a multi-key countdown and triggers a system power action (shutdown, restart, sleep, hibernate, or log off) when it finishes. Built for Windows and macOS with the Stream Deck app (SDK 3+, Node.js 20); macOS is untested.

## Install
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the plugin bundle:
   ```bash
   npm run build
   ```
3. Copy the folder `com.lukas.shutdown.sdPlugin` into your Stream Deck plugins directory (e.g. `%AppData%\Elgato\StreamDeck\Plugins` on Windows).
4. Restart Stream Deck. :)

## Usage
- Add one **Shutdown Master** action to a page and configure it in the property inspector:
  - Countdown duration (seconds)
  - Accent color
  - Power action: shutdown, restart, sleep, hibernate, or log off
- Add **Shutdown Child** actions on the surrounding keys. Children automatically mirror the master settings, and the countdown is drawn once across all keys.
- Press the master (or any child) to start/cancel the countdown.
- Hold the master for 0.8 s to switch between **Preview** (animation only) and **Armed** (the power action really runs at the end).

## Development
- Build: `npm run build`
- Watch (auto-rebuild + Stream Deck restart): `npm run watch`
:)
