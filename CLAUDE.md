# wre-userscripts

Tampermonkey scripts for WRE. Install links in README.md point at `main`, so a change only reaches Ethan's devices once it's on `main`.

## Every time a script changes
- Bump `@version` in the script header.
- Update that script's entry in README.md in the same commit: the version number next to its name, and the description line if what it does has changed (new feature, new device support, etc). A script that's new gets its install link added.
- Desk Panel (panel folder): bump `VERSION` in panel/panel.py for any change in that folder. The PC pulls panel files from `main` every 15 minutes and restarts, and the iPad page reloads when it sees the version change.
- Commit message style: `<Script short name> <version>: <what changed>`.

## Style
- No em dashes anywhere (code comments, README, commit messages).
- Plain, short comments in Aussie English, matching the existing scripts.
