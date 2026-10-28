; WRE Filer (AutoHotkey v2)
; Version 1.0
; One click starts the Inbox Filer: opens the Outlook and AroFlo filer tabs in their own Chrome windows and parks both out of
; the way. Chrome stops drawing a window that's minimised or covered, and then Outlook never builds the mail list (28/10), so
; each window sits in a corner of the screen with only a few pixels showing, pinned on top. Chrome counts them as on screen.
;   WRE Filer (desktop)       start it (the first run puts both shortcuts on the desktop)
;   Stop WRE Filer (desktop)  close both filer windows and stop
;   Tray icon, right click    Show the filer windows / Park them / Restart the filer tabs / Stop all
;   Ctrl+Alt+O                show or park the filer windows
; Minimise all, Win+D or Show desktop: the filer windows get put back in their corners within a few seconds, without taking
; the focus off whatever you're doing. If one gets closed or Chrome drops it, it's opened again.

#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

TABS := [
    {name: "Outlook", url: "https://outlook.cloud.microsoft/mail/#wre-filer", hwnd: 0, opened: 0},
    {name: "AroFlo", url: "https://office.aroflo.com/ims/Site/Home/index.cfm#wre-filer", hwnd: 0, opened: 0}
]
INI := A_Temp "\wre-filer.ini"   ; the two windows, so a restart of this script takes them back instead of opening more
SHOW := 4                        ; pixels left on screen each way
W := 900, H := 700               ; each window's real size (mostly off screen), big enough for a proper mail list
parked := true

; Stop WRE Filer shortcut runs this with "stop"
if (A_Args.Length && A_Args[1] = "stop") {
    StopAll()
    return
}

MakeShortcuts()
A_IconTip := "WRE Filer: running"
tray := A_TrayMenu
tray.Delete()
tray.Add("Show the filer windows", (*) => ToggleShow())
tray.Add("Restart the filer tabs", (*) => Restart())
tray.Add()
tray.Add("Stop all", (*) => StopAll())
tray.Default := "Show the filer windows"

for t in TABS
    Adopt(t) || Open(t)
SetTimer Keep, 3000
TrayTip "Outlook and AroFlo filer tabs open and parked", "WRE Filer", 1
return

^!o:: ToggleShow()

MakeShortcuts() {
    s1 := A_Desktop "\WRE Filer.lnk", s2 := A_Desktop "\Stop WRE Filer.lnk"
    if !FileExist(s1)
        FileCreateShortcut A_AhkPath, s1, A_ScriptDir, '"' A_ScriptFullPath '"', "Start the WRE Inbox Filer"
    if !FileExist(s2)
        FileCreateShortcut A_AhkPath, s2, A_ScriptDir, '"' A_ScriptFullPath '" stop', "Close the WRE filer windows and stop"
}

; A filer window from before (this script restarted) that's still open: use it rather than opening another
Adopt(t) {
    h := IniRead(INI, "win", t.name, 0) + 0
    if (h && WinExist("ahk_id " h) && WinGetProcessName("ahk_id " h) = "chrome.exe") {
        t.hwnd := h
        return true
    }
    return false
}

; Opens the filer tab in a new Chrome window and keeps hold of that window
Open(t) {
    before := Map()
    for h in WinGetList("ahk_exe chrome.exe")
        before[h] := 1
    t.opened := A_TickCount
    try Run 'chrome.exe --new-window "' t.url '"'
    catch {
        MsgBox "Couldn't start Chrome for the " t.name " filer tab.", "WRE Filer"
        return
    }
    loop 60 {  ; up to 30 s for the new window
        Sleep 500
        for h in WinGetList("ahk_exe chrome.exe")
            if !before.Has(h) && WinGetTitle("ahk_id " h) != "" {
                t.hwnd := h
                IniWrite h, INI, "win", t.name
                Park(t, Corners()[t.name = "Outlook" ? 1 : 2])
                return
            }
    }
}

Restart() {
    global parked
    for t in TABS
        if (t.hwnd && WinExist("ahk_id " t.hwnd))
            WinClose "ahk_id " t.hwnd
    Sleep 1500
    parked := true
    for t in TABS
        Open(t)
}

StopAll() {
    SetTimer Keep, 0
    for name in ["Outlook", "AroFlo"] {
        h := IniRead(INI, "win", name, 0) + 0
        if (h && WinExist("ahk_id " h) && WinGetProcessName("ahk_id " h) = "chrome.exe")
            WinClose "ahk_id " h
    }
    try FileDelete INI
    TrayTip "Filer windows closed. Anything that comes in now gets picked up next time you start it.", "WRE Filer stopped", 1
    Sleep 2500
    ExitApp
}

Keep() {
    global parked
    cs := Corners()
    for i, t in TABS {
        if !(t.hwnd && WinExist("ahk_id " t.hwnd)) {
            ; closed, or Chrome dropped it: open it again (not more than once every 2 min)
            if (A_TickCount - t.opened > 120000)
                Open(t)
            continue
        }
        if parked
            Park(t, cs[i])
    }
}

Park(t, c) {
    global W, H
    if !(t.hwnd && WinExist("ahk_id " t.hwnd))
        return
    id := "ahk_id " t.hwnd
    mm := WinGetMinMax(id)
    if (mm = -1)
        DllCall("ShowWindow", "Ptr", t.hwnd, "Int", 4)  ; un-minimise without taking the focus (SW_SHOWNOACTIVATE)
    else if (mm = 1)
        WinRestore id
    WinGetPos &x, &y, &cw, &ch, id
    if (x != c.x || y != c.y || cw != W || ch != H)
        WinMove c.x, c.y, W, H, id
    if !(WinGetExStyle(id) & 0x8)  ; 0x8 = always on top
        WinSetAlwaysOnTop 1, id
}

ToggleShow() {
    global parked
    parked := !parked
    if parked {
        A_TrayMenu.Rename("Park the filer windows", "Show the filer windows")
        Keep()
        ToolTip "Filer windows parked"
    } else {
        A_TrayMenu.Rename("Show the filer windows", "Park the filer windows")
        MonitorGetWorkArea MonitorGetPrimary(), &L, &T, &R, &B
        half := (R - L) // 2
        for i, t in TABS
            if (t.hwnd && WinExist("ahk_id " t.hwnd)) {
                WinSetAlwaysOnTop 0, "ahk_id " t.hwnd
                WinMove L + (i - 1) * half, T, half, B - T, "ahk_id " t.hwnd
                WinActivate "ahk_id " t.hwnd
            }
        ToolTip "Filer windows out. Ctrl+Alt+O or the tray icon to park them again"
    }
    SetTimer () => ToolTip(), -2500
}

; Corners of the main screen's work area (above the taskbar) with no other screen past them, so the part hanging off the edge
; doesn't show on a second monitor. Outlook gets the first, AroFlo the second.
Corners() {
    global SHOW, W, H
    MonitorGetWorkArea MonitorGetPrimary(), &L, &T, &R, &B
    all := [
        {x: R - SHOW, y: B - SHOW, ox: R + 20, oy: B - 20},
        {x: L - W + SHOW, y: B - SHOW, ox: L - 20, oy: B - 20},
        {x: R - SHOW, y: T - H + SHOW, ox: R + 20, oy: T + 20},
        {x: L - W + SHOW, y: T - H + SHOW, ox: L - 20, oy: T + 20}
    ]
    free := []
    for c in all
        if !OnAMonitor(c.ox, c.oy)
            free.Push(c)
    while free.Length < 2
        free.Push(all[free.Length + 1])
    return free
}

OnAMonitor(x, y) {
    loop MonitorGetCount() {
        MonitorGet A_Index, &l, &t, &r, &b
        if (x >= l && x < r && y >= t && y < b)
            return true
    }
    return false
}
