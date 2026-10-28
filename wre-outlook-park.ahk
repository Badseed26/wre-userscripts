; WRE Outlook Park (AutoHotkey v2)
; Version 1.0
; Keeps the Inbox Filer's Outlook window drawing without taking up your screen.
; Chrome stops drawing a window that's minimised or fully covered, and then Outlook never builds the mail list, so the filer
; has nothing to read (28/10). This parks that one window in a corner of the screen with only a few pixels showing, pinned
; on top so nothing covers it. Chrome counts it as on screen and keeps drawing it.
;   Ctrl+Alt+O  bring the Outlook filer window out to look at it, press again to park it back
; It only touches the Chrome window whose title starts with "[WRE filer]" (the Inbox Filer puts that on its Outlook tab).
; Drag the Outlook filer tab into its own Chrome window first. If you minimise it, it gets put back in the corner.

#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

TARGET := "[WRE filer] ahk_exe chrome.exe"
SHOW := 4          ; pixels left on screen each way
W := 900, H := 700 ; the window's real size (mostly off screen). Big enough for Outlook to draw a proper list
parked := true

SetTitleMatchMode 1 ; title starts with
SetTimer Keep, 3000
Keep()

^!o:: {
    global parked
    hwnd := WinExist(TARGET)
    if !hwnd {
        ToolTip "No Outlook filer window open"
        SetTimer () => ToolTip(), -2000
        return
    }
    parked := !parked
    if parked {
        Keep()
        ToolTip "Outlook filer parked"
    } else {
        WinSetAlwaysOnTop 0, hwnd
        MonitorGetWorkArea MonitorGetPrimary(), &L, &T, &R, &B
        WinMove L + (R - L - 1200) // 2, T + (B - T - 800) // 2, 1200, 800, hwnd
        WinActivate hwnd
        ToolTip "Outlook filer out, Ctrl+Alt+O to park it again"
    }
    SetTimer () => ToolTip(), -2500
}

Keep() {
    global parked
    if !parked
        return
    hwnd := WinExist(TARGET)
    if !hwnd
        return
    if WinGetMinMax(hwnd) != 0  ; minimised or maximised: back to a normal window
        WinRestore hwnd
    c := Corner()
    WinGetPos &x, &y, &cw, &ch, hwnd
    if (x != c.x || y != c.y || cw != W || ch != H)
        WinMove c.x, c.y, W, H, hwnd
    if !(WinGetExStyle(hwnd) & 0x8)  ; 0x8 = always on top
        WinSetAlwaysOnTop 1, hwnd
}

; A corner of the main screen's work area (above the taskbar) with no other screen past it, so the bit that hangs off the edge
; isn't showing on a second monitor. Bottom right first, then the others.
Corner() {
    global SHOW, W, H
    MonitorGetWorkArea MonitorGetPrimary(), &L, &T, &R, &B
    tries := [
        {x: R - SHOW, y: B - SHOW, ox: R + 20, oy: B - 20},
        {x: L - W + SHOW, y: B - SHOW, ox: L - 20, oy: B - 20},
        {x: R - SHOW, y: T - H + SHOW, ox: R + 20, oy: T + 20},
        {x: L - W + SHOW, y: T - H + SHOW, ox: L - 20, oy: T + 20}
    ]
    for c in tries
        if !OnAMonitor(c.ox, c.oy)
            return c
    return tries[1]
}

OnAMonitor(x, y) {
    loop MonitorGetCount() {
        MonitorGet A_Index, &l, &t, &r, &b
        if (x >= l && x < r && y >= t && y < b)
            return true
    }
    return false
}
