# wre-userscripts

Tampermonkey scripts for WRE. Install links in README.md point at `main`, so a change only reaches Ethan's devices once it's on `main`.

## Where the code lives
- The scripts are in `src/<name>.js`. Change those, never the `<name>.user.js` files at the top, which `build.py` makes.
- `python3 build.py` after every change in src, and commit src and the built files together.
- The built file is the src script with a live updater in front: every 2 min it checks the repo's latest commit, keeps the newest `src/<name>.js` and runs it on the next page load, so a push is live in a few minutes. Tampermonkey's own update (every few hours) still brings the built file up to date. New code that needs a `@grant`, `@connect`, `@match` or `@run-at` the installed copy hasn't got waits for that Tampermonkey update, so tell Ethan to check for updates in Tampermonkey when a change adds one.
- Live code only runs when its `@version` is higher than the installed one, so the version bump matters.

## Every time a script changes
- Bump `@version` in the script header (src).
- Update that script's entry in README.md in the same commit: the version number next to its name, and the description line if what it does has changed (new feature, new device support, etc). A script that's new gets its install link added.
- Desk Panel (panel folder): bump `VERSION` in panel/panel.py for any change in that folder. The PC pulls panel files from `main` every 15 minutes and restarts, and the iPad page reloads when it sees the version change.
- Commit message style: `<Script short name> <version>: <what changed>`.

## Style
- No em dashes anywhere (code comments, README, commit messages).
- Plain, short comments in Aussie English, matching the existing scripts.
