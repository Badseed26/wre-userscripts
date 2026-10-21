# Plan: filer pushes site info to AroFlo, and keeps a phone list (21/10)

Two jobs moving off Claude and onto the inbox filer, so they cost nothing to run. Claude stays as the fall back.

1. **Push to AroFlo**: site info captured from Ethan's phone (gate codes, dogs, access, site contact) goes on top of the AroFlo task description. Today the dashboard's Push to AroFlo button sends a note to Claude (Notes to Claude task, which drives Chrome). The filer should do it instead, the same way it already handles Try again and Schedule job: the dashboard puts a label on the Todoist item, the filer picks it up.
2. **Phone list**: WRE Capture (the WRE note shortcut, Apps Script in the private repo Badseed26/wre-capture) can't see AroFlo, so it can't match a note or a screenshot of a text by phone number. The filer keeps a list of every open job's phone numbers in a Todoist task, and Capture reads it.

## Who builds what

| Part | Where | Needs Ethan's PC |
| --- | --- | --- |
| A. Filer: site push and phone list | wre-userscripts, wre-inbox-filer.user.js | Yes, live AroFlo testing |
| B. Capture: match by phone number | wre-capture, src/Logic.js | No |
| C. Dashboard: Push to AroFlo goes to the filer first | WRE Dashboard artifact | No |

A is the big one and wants Claude Code on the PC. B and C are small and can be done from a claude.ai chat. Build A first, B and C can go any time (they do nothing until A is live).

## The contract between the parts (don't change without changing all three)

**Site push**
- A captured site info item is a task in WRE follow ups (project `6hfHcM9Gf74fgcJw`, no section) with labels `captured` and `cap-site` (plus `close-done`). Its description has the job's tracker header as the first line (`JN 9440 | PO ... | address | builder`) and a line `SITE INFO: GATE CODE: 4471`.
- The dashboard asks for a push by adding the label `filer-site`.
- Filer, success: adds a comment `Filer put this on top of JN 9440: GATE CODE: 4471`, then closes the task.
- Filer, already on the task: same comment ending `(already there)`, then closes the task.
- Filer, failure: takes `filer-site` off and puts a first line on the description `Site push failed (<h:mm am>): <reason>`, replacing any older one. Doesn't close it.
- Filer, dry run: comment `Dry run: would put on top of JN 9440: <line>`, takes the label off, nothing in AroFlo.

**Phone list**
- Todoist task `* Phone list`, id `6hpjJ2vf294Q3wv5`, in WRE job tracker > Inbox filer settings (section `6hmpxJ2hr8Hc5MRX`). Already made, empty.
- Description, first line: `Phone list <filer version>, <n> jobs, updated <d/m/yyyy h:mm:ss am>`.
- Then one line per open job: `JN 9380 | 24 Balgowlah St Wakerley | 0477900047 site, 0412345678 supervisor, 0755551234 other`.
- Numbers are 10 digits starting with 0, no spaces: `+61 477 900 047`, `0477 900 047` and `0477900047` are all `0477900047`. The word after each says where it came from: `site` (a SITE CONTACT line), `supervisor` (a SUPERVISOR line), `other` (anywhere else in the task).
- Keep the description under 15,000 characters.

## Part A: the filer (wre-inbox-filer.user.js, AroFlo side)

Read HANDOFF.md first: how Ethan wants filer work done (don't make him test, verify in AroFlo, never drive his pinned filer tabs, install by commit hash). Follow the repo's CLAUDE.md (bump `@version`, README entry, commit style, no em dashes).

### A1. siteInfo(): the push
- New async function in the AroFlo side, called from `tick()`'s idle branch next to `retries()` and `bookings()`. Throttle it like they are (`wfSiteAt`, about 50 s).
- Find the items: Todoist API v1 `GET tasks/filter?query=` + `encodeURIComponent('@filer-site')`. If that endpoint doesn't behave, fall back to `GET tasks?project_id=6hfHcM9Gf74fgcJw` paged and filter on labels. One item per tick.
- Parse the JN (`/\bJN\s?(\d{4,5})\b/` on the description) and the line (`/^SITE INFO: (.+)$/m`). Either missing is a failure ("no JN on it" / "no SITE INFO line").
- `R.dry`: the dry run comment, label off, stop.
- `findJn(jn)`, then `isOpenTask(r)`. Not open is a failure ("JN 9440 is Completed, site info only goes on open tasks").
- Then a page op, the same machinery as `opDesc` (`startOp`, `resumeOp`, `firedWatch`), new op type `site` that opens the task's Edit Task Header page (`descOf(href).hh`):
  - wait for the `Edit - JN` title and `ckReady('description')`
  - `old = ed.getData()`. If `plain(old)` already contains `plain(line)`, it's the "already there" outcome.
  - `want = '<p>' + esc(line) + '</p>' + old`, `setData`, then check: `plain(new)` starts with `plain(line)`, ends with `plain(old)`, and `hdrFields()` is unchanged. Any of those false: put `old` back, `resetDirty`, failure "check failed before save, nothing saved".
  - save with the header's own `updateheader__btn` (same as `opDesc`), then after the reload re-read with `findJn` and `descOf` and check the description now starts with the line. Mismatch is a failure "saved but the re-read doesn't match, check JN 9440".
  - do the Todoist side (comment and close, or the failure line and label off) before `go(HOME)`. Don't route it through `opDone`, that writes to the email job queue.
- Only ever the top of the description, plain `<p>line</p>`, never change any other text or header field. Same rule as the skills' `_addSiteInfo` (wre-house-rules section 5).
- Log lines with the usual prefixes so the dashboard's log badges work: `Done: site info on JN 9440: GATE CODE: 4471`, `Error: site info JN 9440: <reason>`.
- Test hook like `W.wfBook` when `!IS_FILER` (e.g. `W.wfSite = { find, parse, run }`) so Claude can test in its own tab with the Todoist stand in (`W.__wfTd`).

### A2. phones(): the phone list
- Called from the idle branch too. Full refresh at most every 60 min (`wfPhonesAt`), worked in batches of about 10 jobs per tick so a tick stays short.
- Which jobs: every `JN dddd` in the WRE job tracker headers (project `6hfHgcxH8W9q4qf5`, skip the settings section `6hmpxJ2hr8Hc5MRX`), plus any `JN dddd` on items in the To book and Errors / to check sections. Unique JNs, open tasks only (`isOpenTask`).
- For each: `findJn`, then `descOf(href)` for the description html, plus the task page's own text if it shows contact numbers (check one live task to see where the client and contact phones sit; only take what's clearly a phone).
- Numbers: match `/(?:\+?61[\s-]?|0)[2-478](?:[\s-]?\d){8}/g` on plain text, normalise to `0` plus 9 digits. Tag `site` when it's on a SITE CONTACT line, `supervisor` on a SUPERVISOR line, else `other`. Dedupe per job (keep the most specific tag).
- Address: the tracker job's title, else the AroFlo task name.
- Cache per JN for 6 hrs (`wfPhoneCache`) so most refreshes only fetch new jobs. Drop JNs that are no longer open.
- Write the whole list to `tasks/6hpjJ2vf294Q3wv5` once a refresh finishes. A failed write logs an Error line and tries again next hour.
- No AI anywhere in this. Read only on AroFlo.

### A3. Ship it
- `@version` 0.9.60, README entry, commit `Inbox Filer 0.9.60: site info push from the dashboard and a phone list for WRE Capture`.
- Test A1 in Claude's own tab with the stand in, then one real push: Ethan taps Push to AroFlo on a real captured site info item, Claude checks the AroFlo task description in AroFlo itself (line on top, old text intact).
- Test A2 by reading the `* Phone list` task after the first refresh and spot checking 3 jobs against AroFlo.

## Part B: WRE Capture (wre-capture, src/Logic.js)

Follow wre-capture's CLAUDE.md (both test files pass before push, bump VERSION, push to main goes live in 10 minutes).
- `context()`: also `GET tasks/6hpjJ2vf294Q3wv5` and parse the lines into `phone -> [JN]` and `JN -> tracker job` (tracker jobs carry the JN in `_head`). Missing or empty list: carry on without it.
- Sonnet's JSON gets `"numbers": ["0477900047"]`: every phone number it sees in the note or the images, normalised. Add it to SYSTEM's JSON shape with one line on what it is.
- After `clean()`'s street check: numbers = regex on the text plus Sonnet's `numbers`, normalised. A number on exactly one job: if an action has no job, give it that job; if the action's job came from Sonnet and no street was named, the number wins. A number on two or more jobs (a supervisor): add them to `candidates`, don't pick.
- Tests: number in a screenshot (via Sonnet's `numbers`) places the job; `+61 477 900 047` in typed text matches `0477900047`; a supervisor number on 3 jobs gives candidates, not a pick; no phone list task still works.

## Part C: WRE Dashboard (artifact Ah1oAv4j9heVqWdqPRNYAx)

- `capPush`: add the `filer-site` label with `setLabels` (keep the others) and remember the time (`store.set('site.'+id, ...)`) instead of writing a note. Chip: "Sent to the filer, it goes on within a minute".
- Still labelled after 10 min, or `filerQuiet()`: chip "Filer hasn't picked it up" plus a **Send to Claude instead** button that does what `capPush` does today (the Notes to Claude note).
- A `Site push failed (...)` line on the description: show it, with **Try again** (label back on) and **Send to Claude instead**.
- Add `filer-site` to `HIDE_LAB`. Keep the existing note path working, it's the fall back.
- Render test before publishing (the page reads Todoist live, so a stand in `window.claude` is enough).

## What stays the same
- Nothing goes into AroFlo without Ethan pressing Push to AroFlo.
- The filer pauses on PAUSED and the PAUSE DATES like everything else.
- If the filer's off (PC asleep), the dashboard offers Claude, and Capture uses the last phone list it has.
