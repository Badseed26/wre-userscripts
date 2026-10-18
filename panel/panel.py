# Desk Panel
# Little server on the PC that the iPad talks to over home wifi.
# Only runs the buttons in buttons.json, nothing else. Home network only.
#
#   python panel.py            run it with a window (shows the iPad address)
#   python panel.py --startup  start it hidden every time Windows starts
#   python panel.py --nostartup  stop it starting with Windows
#
# Updates itself from the wre-userscripts repo (panel folder) every 15 minutes,
# and keeps Clipboard Brain up to date too. Put a file called no_auto_update.txt
# in this folder to turn that off.

import ctypes
import ipaddress
import json
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "2.2"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = "https://raw.githubusercontent.com/Badseed26/wre-userscripts/%s/"
LATEST = "https://api.github.com/repos/Badseed26/wre-userscripts/commits/main"
CHECK_EVERY = 15 * 60
PANEL_FILES = ["panel.py", "index.html", "buttons.json", "icon.png", "README.txt"]
PORT = 8765
BUTTONS = os.path.join(HERE, "buttons.json")
KEYFILE = os.path.join(HERE, "panel_key.txt")
ADDRFILE = os.path.join(HERE, "ipad_address.txt")
LOGFILE = os.path.join(HERE, "panel.log")
ICONS = os.path.join(HERE, "icons")  # your own tile icons, updates never touch this
ICON_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml"}
STARTUP_VBS = os.path.join(
    os.environ.get("APPDATA", ""),
    r"Microsoft\Windows\Start Menu\Programs\Startup\WRE Panel.vbs",
)


def log(msg):
    line = time.strftime("%d/%m %H:%M:%S ") + msg
    try:
        print(line)
    except Exception:
        pass  # pythonw has no console
    try:
        with open(LOGFILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        # keep the log small
        if os.path.getsize(LOGFILE) > 200_000:
            with open(LOGFILE, "r", encoding="utf-8") as f:
                tail = f.readlines()[-500:]
            with open(LOGFILE, "w", encoding="utf-8") as f:
                f.writelines(tail)
    except Exception:
        pass


def get_key():
    if os.path.exists(KEYFILE):
        k = open(KEYFILE, encoding="utf-8").read().strip()
        if k:
            return k
    k = secrets.token_urlsafe(12)
    with open(KEYFILE, "w", encoding="utf-8") as f:
        f.write(k)
    return k


def local_ip():
    # works out which address the PC uses on the home network (sends nothing)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def load_buttons():
    with open(BUTTONS, encoding="utf-8") as f:
        return json.load(f)


# ---------- opening things on the PC ----------

def find_chrome():
    for base in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        root = os.environ.get(base)
        if root:
            p = os.path.join(root, r"Google\Chrome\Application\chrome.exe")
            if os.path.exists(p):
                return p
    return None


def open_url(url, cfg):
    if cfg.get("browser", "chrome") == "chrome":
        chrome = find_chrome()
        if chrome:
            subprocess.Popen([chrome, url])
            return
    os.startfile(url)


# ---------- sending a hotkey to whatever window is in front ----------

VK = {"ctrl": 0x11, "alt": 0x12, "shift": 0x10, "win": 0x5B,
      "enter": 0x0D, "esc": 0x1B, "tab": 0x09, "space": 0x20}
for i in range(1, 13):
    VK["f%d" % i] = 0x6F + i


def send_keys(combo):
    names = [p.strip().lower() for p in combo.split("+")]
    codes = []
    for n in names:
        if n in VK:
            codes.append(VK[n])
        elif len(n) == 1 and n.isalnum():
            codes.append(ord(n.upper()))
        else:
            raise ValueError("Unknown key: " + n)
    kb = ctypes.windll.user32.keybd_event
    for c in codes:
        kb(c, 0, 0, 0)
    time.sleep(0.05)
    for c in reversed(codes):
        kb(c, 0, 2, 0)


# ---------- finding files ----------

def known_folder(guid):
    # asks Windows where a folder really is (handles Documents moved to OneDrive or another drive)
    try:
        import ctypes.wintypes
        class GUID(ctypes.Structure):
            _fields_ = [("a", ctypes.c_ulong), ("b", ctypes.c_ushort),
                        ("c", ctypes.c_ushort), ("d", ctypes.c_ubyte * 8)]
        h = guid.strip("{}").split("-")
        tail = bytes.fromhex(h[3] + h[4])
        g = GUID(int(h[0], 16), int(h[1], 16), int(h[2], 16),
                 (ctypes.c_ubyte * 8)(*tail))
        out = ctypes.c_wchar_p()
        if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(out)) == 0:
            path = out.value
            ctypes.windll.ole32.CoTaskMemFree(out)
            return path
    except Exception:
        pass
    return None


def resolve_path(target):
    t = target
    if "%DOCUMENTS%" in t:
        docs = known_folder("{FDD39AD0-238F-46AF-ADB4-6C85480369C7}") or os.path.expanduser(r"~\Documents")
        t = t.replace("%DOCUMENTS%", docs)
    if "%DESKTOP%" in t:
        desk = known_folder("{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}") or os.path.expanduser(r"~\Desktop")
        t = t.replace("%DESKTOP%", desk)
    t = os.path.expandvars(t)
    if not os.path.isabs(t):
        t = os.path.join(HERE, t)
    if os.path.exists(t):
        return t
    # browsers sometimes save .ahk as .ahk.txt and Windows hides the .txt
    if os.path.exists(t + ".txt"):
        raise FileNotFoundError("It's saved as %s.txt, rename it to drop the .txt" % os.path.basename(t))
    # last go: same file name next to the panel
    here = os.path.join(HERE, os.path.basename(t))
    if os.path.exists(here):
        return here
    raise FileNotFoundError("Can't find " + t)


# ---------- start menu apps ----------

def open_start_menu_app(name):
    # finds the app the same way the Start menu does, so it doesn't matter how it was installed
    ps = ("Get-StartApps | Where-Object { $_.Name -like ('*' + $env:DP_APP + '*') } | "
          "Select-Object -First 1 -ExpandProperty AppID")
    env = dict(os.environ, DP_APP=name)
    out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True,
                         text=True, timeout=30, env=env, creationflags=0x08000000)
    app_id = out.stdout.strip()
    if not app_id:
        raise FileNotFoundError("%s isn't in the Start menu" % name)
    os.startfile("shell:AppsFolder\\" + app_id)


# ---------- runs on the WRE Dashboard ----------
# The dashboard starts checks itself (scheduled tasks, the same as its Run buttons). The panel queues a request here,
# the WRE Inbox Pull script in the dashboard window collects it from /api/dash/next, and the dashboard runs it.

DASH = {"q": [], "last_poll": 0.0}
DASH_LOCK = threading.Lock()
PULL_URL = "https://outlook.cloud.microsoft/mail/#wre-inbox-run"


def dash_open():
    return time.time() - DASH["last_poll"] < 12


def pick_day(day):
    # a day from the last week (YYYY-MM-DD), anything else means today
    import datetime
    try:
        d = datetime.date.fromisoformat(str(day))
        back = (datetime.date.today() - d).days
        if 1 <= back <= 6:
            return d
    except (TypeError, ValueError):
        pass
    return None


def dash_run(btn, cfg, opts=None):
    key = btn["key"]
    was_open = dash_open()
    day = pick_day((opts or {}).get("day")) if key == "inbox" else None
    if key == "inbox":
        # reads that day's inbox and hands the bundle to the dashboard
        open_url(PULL_URL + ("=" + day.isoformat() if day else ""), cfg)
    if not was_open:
        dash = find_button(cfg, "dashboard")
        if dash:
            run_button(dash, cfg)
    with DASH_LOCK:
        now = time.time()
        DASH["q"] = [r for r in DASH["q"] if now - r["at"] < 300 and key not in r["keys"]]
        DASH["q"].append({"id": "p%d" % int(now * 1000), "keys": [key], "at": now})
    name = btn["label"]
    if key == "inbox":
        when = "%s %d/%d's" % (day.strftime("%a"), day.day, day.month) if day else "today's"
        return "Pulling %s inbox, %s starts once it lands" % (when, name)
    return ("%s sent to the dashboard" % name) if was_open else ("Opening the dashboard, %s starts once it's up" % name)


def dash_next():
    with DASH_LOCK:
        DASH["last_poll"] = time.time()
        now = time.time()
        out = [{"id": r["id"], "keys": r["keys"]} for r in DASH["q"] if now - r["at"] < 300]
        DASH["q"] = []
    return out


# ---------- running a button ----------

def run_button(btn, cfg, opts=None):
    t = btn["type"]
    if t == "url":
        open_url(btn["target"], cfg)
    elif t == "urls":
        for u in btn["targets"]:
            open_url(u, cfg)
            time.sleep(0.6)
    elif t == "claude":
        open_url("https://claude.ai/new?q=" + urllib.parse.quote(btn["prompt"]), cfg)
    elif t in ("ahk", "file"):
        path = resolve_path(btn["target"])
        # an AHK script that's already open stays as it is (SingleInstance Force would restart it)
        if t == "ahk" and ahk_running(os.path.basename(path)):
            return "%s is already running" % btn["label"]
        os.startfile(path)
    elif t == "keys":
        send_keys(btn["keys"])
    elif t == "app":
        # desktop apps, first one that's installed wins (e.g. classic Outlook then new Outlook)
        for name in btn["targets"]:
            try:
                if name.startswith("startmenu:"):
                    open_start_menu_app(name[10:])  # works for Store and normal installs
                elif "://" in name or not ("\\" in name or "/" in name):
                    os.startfile(os.path.expandvars(name))  # app name or link
                else:
                    os.startfile(resolve_path(name))  # a file or shortcut, %DESKTOP% works
                return
            except OSError:
                continue
        raise FileNotFoundError("Couldn't find %s on this PC" % btn["label"])
    elif t == "lock":
        ctypes.windll.user32.LockWorkStation()
    elif t == "update":
        return check_updates()
    elif t == "dashrun":
        return dash_run(btn, cfg, opts)
    else:
        raise ValueError("Unknown button type: " + t)


def find_button(cfg, bid):
    for g in cfg.get("groups", []):
        for b in g.get("buttons", []):
            if b.get("id") == bid:
                return b
    return None


def squash(text):
    return "".join(c for c in text.lower() if c.isalnum())


def icon_files(btn):
    # an icon named after the button id wins, then one named after its label
    # e.g. icons/aroflo.png or icons/AroFlo.png
    if not os.path.isdir(ICONS):
        return []
    by_id, by_label = [], []
    for f in os.listdir(ICONS):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in ICON_TYPES:
            continue
        if squash(stem) == squash(btn["id"]):
            by_id.append(f)
        elif squash(stem) == squash(btn["label"]):
            by_label.append(f)
    return sorted(by_id) + sorted(by_label)


def public_view(cfg):
    # what the iPad gets: labels and layout, not file paths
    out = {"title": cfg.get("title", "Desk Panel"), "name": cfg.get("name", ""),
           "groups": [], "favourites": []}
    ids = set()
    for g in cfg.get("groups", []):
        gb = []
        for b in g.get("buttons", []):
            item = {"id": b["id"], "label": b["label"], "sub": b.get("sub", ""),
                    "type": b["type"], "icon": b.get("icon", ""),
                    "color": b.get("color", "slate")}
            if b["type"] == "ipad":
                item["href"] = b["target"]
            if b.get("confirm"):
                item["confirm"] = True
            if b.get("pickday"):
                item["pickday"] = True
            files = icon_files(b)
            if files:
                f = files[0]
                v = int(os.path.getmtime(os.path.join(ICONS, f)))
                item["img"] = "/icons/%s?v=%d" % (urllib.parse.quote(f), v)
            ids.add(b["id"])
            gb.append(item)
        out["groups"].append({"name": g["name"], "buttons": gb})
    out["favourites"] = [i for i in cfg.get("favourites", []) if i in ids]
    return out


def save_icon(btn, b64):
    import base64
    data = base64.b64decode(b64.split(",")[-1])
    if len(data) > 2_000_000:
        raise ValueError("That image is too big")
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected a PNG from the iPad")
    os.makedirs(ICONS, exist_ok=True)
    for f in icon_files(btn):
        os.remove(os.path.join(ICONS, f))
    with open(os.path.join(ICONS, btn["id"] + ".png"), "wb") as f:
        f.write(data)


def reset_icon(btn):
    for f in icon_files(btn):
        os.remove(os.path.join(ICONS, f))


# ---------- auto updates ----------

SRV = None
RESTARTING = False
update_lock = threading.Lock()
last_check = {"when": "", "result": "Not checked yet"}


def latest_ref():
    # the newest commit on main, so every file comes from the same commit and GitHub's
    # 5 minute cache on main can't hand back old files. Falls back to main if the API's busy.
    try:
        req = urllib.request.Request(LATEST, headers={"Accept": "application/vnd.github.sha",
                                                      "User-Agent": "desk-panel"})
        with urllib.request.urlopen(req, timeout=15) as r:
            sha = r.read().decode().strip()
        if len(sha) == 40 and all(c in "0123456789abcdef" for c in sha):
            return sha
    except Exception as e:
        log("Couldn't get the latest commit, using main: %s" % e)
    return "main"


def fetch(path, ref="main"):
    url = (RAW % ref) + urllib.parse.quote(path) + "?t=%d" % int(time.time())
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()


def looks_ok(name, data):
    # never swap in a half downloaded or broken file
    if not data:
        return False
    try:
        if name.endswith(".py"):
            compile(data, name, "exec")
        elif name.endswith(".json"):
            json.loads(data.decode("utf-8"))
        return True
    except Exception as e:
        log("Skipped a broken %s from GitHub: %s" % (name, e))
        return False


def write_if_changed(dest, data):
    try:
        with open(dest, "rb") as f:
            if f.read() == data:
                return False
    except FileNotFoundError:
        pass
    tmp = dest + ".new"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, dest)
    return True


def brain_path():
    try:
        b = find_button(load_buttons(), "cb-start")
        if b:
            return resolve_path(b["target"])
    except Exception:
        pass
    return None


def ahk_running(script_name):
    # is this AutoHotkey script open right now (matched on its file name)
    ps = ("Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'AutoHotkey*' -and "
          "$_.CommandLine -like ('*' + $env:DP_AHK + '*') } | Select-Object -First 1 -ExpandProperty ProcessId")
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True,
                             timeout=30, env=dict(os.environ, DP_AHK=script_name), creationflags=0x08000000)
        return out.stdout.strip() != ""
    except Exception:
        return False


def brain_running():
    # is Clipboard Brain open right now (so it can be reloaded after an update)
    return ahk_running("wre-clipboard-brain.ahk")


def check_updates():
    if os.path.exists(os.path.join(HERE, "no_auto_update.txt")):
        return "Auto update is turned off (no_auto_update.txt)"
    if not update_lock.acquire(blocking=False):
        return "Already checking"
    try:
        changed, restart = [], False
        ref = latest_ref()
        for name in PANEL_FILES:
            try:
                data = fetch("panel/" + name, ref)
            except Exception as e:
                raise RuntimeError("Can't reach GitHub (%s)" % e)
            if looks_ok(name, data) and write_if_changed(os.path.join(HERE, name), data):
                changed.append(name)
                if name == "panel.py":
                    restart = True
        bp = brain_path()
        if bp:
            data = fetch("wre-clipboard-brain.ahk", ref)
            if looks_ok("brain.ahk", data) and write_if_changed(bp, data):
                changed.append("Clipboard Brain")
                if brain_running():
                    os.startfile(bp)  # SingleInstance Force swaps in the new one
        result = ("Updated " + ", ".join(changed)) if changed else "Up to date"
        last_check["when"] = time.strftime("%d/%m %H:%M")
        last_check["result"] = result
        if changed:
            log(result)
        if restart:
            restart_soon()
            result += ", restarting"
        return result
    finally:
        update_lock.release()


def restart_soon():
    def go():
        global RESTARTING
        time.sleep(1.5)
        RESTARTING = True
        log("Restarting on the new version")
        SRV.shutdown()
    threading.Thread(target=go, daemon=True).start()


def updater_loop():
    time.sleep(5)
    while True:
        try:
            check_updates()
        except Exception as e:
            last_check["result"] = str(e)
            log("Update check failed: %s" % e)
        time.sleep(CHECK_EVERY)


# ---------- web server ----------

KEY = None


def private_client(addr):
    try:
        ip = ipaddress.ip_address(addr)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False


class Handler(BaseHTTPRequestHandler):
    server_version = "WREPanel"

    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def key_ok(self, given):
        return given and secrets.compare_digest(given, KEY)

    def do_GET(self):
        if not private_client(self.client_address[0]):
            return self.send(403, {"error": "home network only"})
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path in ("/", "/index.html"):
            html = open(os.path.join(HERE, "index.html"), "rb").read()
            return self.send(200, html, "text/html; charset=utf-8")
        if u.path in ("/icon.png", "/apple-touch-icon.png"):
            p = os.path.join(HERE, "icon.png")
            if os.path.exists(p):
                return self.send(200, open(p, "rb").read(), "image/png")
            return self.send(404, {"error": "no icon"})
        if u.path.startswith("/icons/"):
            name = os.path.basename(urllib.parse.unquote(u.path[7:]))
            ext = os.path.splitext(name)[1].lower()
            p = os.path.join(ICONS, name)
            if ext in ICON_TYPES and os.path.isfile(p):
                extra = {"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"}
                return self.send(200, open(p, "rb").read(), ICON_TYPES[ext], extra)
            return self.send(404, {"error": "no icon"})
        if u.path == "/api/buttons":
            if not self.key_ok(q.get("k", [""])[0]):
                return self.send(401, {"error": "bad key"})
            try:
                return self.send(200, public_view(load_buttons()))
            except Exception as e:
                log("buttons.json problem: %s" % e)
                return self.send(500, {"error": "buttons.json has a problem: %s" % e})
        if u.path == "/api/dash/next":
            # only the browser on this PC (the dashboard window), no key needed
            if self.client_address[0] not in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
                return self.send(403, {"error": "this PC only"})
            return self.send(200, {"reqs": dash_next()})
        if u.path == "/api/ping":
            return self.send(200, {"ok": True, "version": VERSION})
        if u.path == "/api/version":
            return self.send(200, {"version": VERSION, "last_check": last_check})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if not private_client(self.client_address[0]):
            return self.send(403, {"error": "home network only"})
        if self.path not in ("/api/run", "/api/icon"):
            return self.send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 3_000_000:
                return self.send(413, {"error": "too big"})
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self.send(400, {"error": "bad request"})
        if not self.key_ok(data.get("k", "")):
            return self.send(401, {"error": "bad key"})
        try:
            cfg = load_buttons()
            btn = find_button(cfg, data.get("id", ""))
            if not btn:
                return self.send(404, {"error": "no button with that id"})
            if self.path == "/api/icon":
                if data.get("reset"):
                    reset_icon(btn)
                    log("icon reset for %s" % btn["id"])
                    return self.send(200, {"ok": True, "msg": "Icon reset"})
                save_icon(btn, data.get("png", ""))
                log("new icon for %s" % btn["id"])
                return self.send(200, {"ok": True, "msg": "Icon saved"})
            msg = run_button(btn, cfg, {"day": data.get("day")})
            log("ran %s (%s)" % (btn["id"], btn["label"]))
            return self.send(200, {"ok": True, "msg": msg or ""})
        except Exception as e:
            log("failed %s: %s" % (data.get("id"), e))
            return self.send(500, {"error": str(e)})


# ---------- startup ----------

def set_startup(on):
    if on:
        pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if not os.path.exists(pyw):
            pyw = sys.executable
        script = os.path.abspath(__file__)
        vbs = ('CreateObject("WScript.Shell").Run """%s"" ""%s""", 0, False\r\n'
               % (pyw, script))
        with open(STARTUP_VBS, "w", encoding="utf-8") as f:
            f.write(vbs)
        print("Done. Desk Panel will start hidden every time Windows starts.")
    else:
        if os.path.exists(STARTUP_VBS):
            os.remove(STARTUP_VBS)
        print("Done. Desk Panel won't start with Windows any more.")


def main():
    global KEY
    if "--startup" in sys.argv:
        return set_startup(True)
    if "--nostartup" in sys.argv:
        return set_startup(False)

    global SRV
    KEY = get_key()
    load_buttons()  # fail early if the json is broken
    os.makedirs(ICONS, exist_ok=True)
    srv = None
    for _ in range(15):  # after a restart the old one can take a sec to let go
        try:
            srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
            break
        except OSError:
            time.sleep(1)
    if not srv:
        log("Port %d is already in use, the panel is probably already running." % PORT)
        return
    SRV = srv
    addr = "http://%s:%d/?k=%s" % (local_ip(), PORT, KEY)
    with open(ADDRFILE, "w", encoding="utf-8") as f:
        f.write(addr + "\n")
    log("Desk Panel %s running. Open this on the iPad:" % VERSION)
    log("  " + addr)
    threading.Thread(target=updater_loop, daemon=True).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    srv.server_close()
    if RESTARTING:
        flags = 0x10 if os.path.basename(sys.executable).lower() == "python.exe" else 0
        subprocess.Popen([sys.executable, os.path.abspath(__file__)], cwd=HERE,
                         creationflags=flags)


if __name__ == "__main__":
    main()
