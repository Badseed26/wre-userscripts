DESK PANEL - SETUP

1. Python
   If it's not on the PC already, get it from python.org and tick "Add python.exe to PATH" when installing.
   AHK buttons also need AutoHotkey v2 installed.

2. Put this folder at:
   Documents\WRE\WRE Panel

3. Clipboard Brain
   It isn't on the PC yet. Download wre-clipboard-brain.ahk from the wre-userscripts repo and put it in Documents\WRE

4. First run
   Double click "Start WRE Panel.bat"
   Windows Firewall will pop up: tick Private networks and hit Allow.
   The window shows the iPad address (it's also saved in ipad_address.txt).

5. iPad
   Open that address in Safari (key on the end, only needed once).
   Share, Add to Home Screen. Open it from the home screen icon from now on.

6. Start with Windows
   Once it's working, close the window and double click "Start with Windows.bat".
   From the next restart it runs hidden in the background.
   To stop that: python panel.py --nostartup

UPDATES
The panel updates itself from the wre-userscripts repo every 15 minutes (or tap Check for updates on the PC tab).
That covers the panel, the buttons and Clipboard Brain. If Clipboard Brain is running it reloads itself.
The iPad page reloads on its own when the PC updates.
To turn auto updates off, put an empty file called no_auto_update.txt in this folder.

YOUR OWN ICONS
Two ways, use whichever is easier:
- On the iPad: tap the pencil (top right), tap a tile, Choose image. It gets cropped square and saved on the PC.
  Same place has "Back to the default icon".
- On the PC: drop an image in the icons folder named after the tile, like AroFlo.png or Daily check.png
  (png, jpg, webp, gif or svg). Square images look best.
The icons folder is yours, updates never touch it.

ADDING OR CHANGING BUTTONS
Ask Claude to change them in the repo, they'll land on the PC within 15 minutes.
Editing buttons.json here works too, but the next update will put it back to the repo version.
Button types:
  url      opens a link on the PC (in Chrome)
  urls     opens a few links at once
  app      opens a desktop app, like Outlook
  claude   opens a new Claude chat on the PC with the prompt filled in
  dashrun  runs a check through the WRE Dashboard, same as its Run button
  ahk      runs an AutoHotkey file
  file     opens a file or folder
  keys     presses a hotkey on the PC, like ctrl+alt+1
  lock     locks the PC
  update   checks for updates now

GOOD TO KNOW
- Home wifi only. It ignores anything from outside the house, and needs the key.
- It can only run what's in buttons.json, nothing else.
- If the iPad says it can't reach the PC after a router restart, the PC's address probably changed.
  Check ipad_address.txt, or set a reserved address for the PC in the router so it never changes.
- panel.log in this folder shows what ran and any errors.
