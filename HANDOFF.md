# WRE Inbox Filer: handoff prompt

Paste everything below the line into a new chat.

---

You're picking up work on the WRE Inbox Filer for Ethan at Wired Rite Electrical (WRE). Read this, then wait for Ethan to say what's up.

## What it is
A Tampermonkey userscript, wre-inbox-filer.user.js, in the GitHub repo Badseed26/wre-userscripts (local clone on Ethan's PC at C:\Users\Ecall\OneDrive\Documents\WRE\wre-userscripts, pushes go straight to main). It runs in two pinned Chrome tabs on Ethan's PC, opened from the Tampermonkey menu with #wre-filer: one on Outlook (the shared inbox admin@wiredrite.com.au) and one on AroFlo (office.aroflo.com). It reads builder emails with Claude (Sonnet 5.5 at high for emails and PO PDFs, Haiku 5.5 at high for repair schedule PDFs), creates or updates AroFlo tasks in Lisa's layout, uploads the PO PDF and the email's other PDFs and photos, and writes To book and Errors / to check items into the Todoist project WRE follow ups. The WRE Dashboard artifact (claude.ai/artifact/Ah1oAv4j9heVqWdqPRNYAx) shows those items, the filer's live log, and a Try again button. The filer is live (not dry run). Latest version is in the README; the version tag shows above the green chip in each filer tab.

## Ethan's rules for this work
- Don't make him test. Read the live log (Todoist task "* Inbox filer log", id 6hp9c9X7CPQvgRw5, in WRE job tracker > Inbox filer settings; the filer pushes its last 25 lines plus version, reads, spend, last seen and both tabs' status every 30 seconds), work out the fault, fix the script, and re-run through the filer's own mechanisms only: Try again means adding the Todoist label filer-retry to the error or check item in WRE follow ups > Errors / to check (section id 6hmpxJ488W9GCXpP; To book is 6hmpxJ4FXMvm8p4P; the project is 6hfHcM9Gf74fgcJw). To re-read an email the filer skipped, add a task to that section with a line "Email: <subject>" and a last line "filer: err-j<anything>", then label it filer-retry.
- Never do an outcome by hand: no uploading PDFs, no creating AroFlo tasks yourself. The filer must recover itself. Read-only fetches and inspection in your own Chrome tabs are fine (AroFlo task search is a POST to /ims/Site/Home/index.cfm?tid=IMS.STK.CUR with taskString and SearchParam JobNo, CustOn or Location; a task's documents are at /ims/Site/Documents/AJAX_JSON_search_documents.cfm from the task page). Never drive his pinned filer tabs. The Chrome extension blocks any script result that contains a query string or cookie, so return computed values only.
- Verify results in AroFlo itself, never trust the filer's log.
- Claude can't click Tampermonkey's Update. Ethan installs each version from the exact commit hash raw URL: raw.githubusercontent.com/Badseed26/wre-userscripts/<sha>/wre-inbox-filer.user.js, then F5 both filer tabs. He may pause the filer on the dashboard first; a short pause doesn't move its start time. Syntax check a pushed version by fetching the raw file from an AroFlo tab and running new Function on it.
- Repo rules (CLAUDE.md): bump @version, update the README entry in the same commit, commit style "Inbox Filer x.y.z: what changed", no em dashes anywhere, plain short Aussie comments. Git author on the PC is set to Claude.
- Ethan's voice: short, plain, trade wording, no corporate talk. He wants to know what got done and what he has to do.

## How the filer works, the parts that matter
- Outlook tab: scans the Inbox rows every minute (Outlook only draws about 10 rows, so re-reads page the list down), opens a new email from a listed builder sender, previews the attachments to catch the PDFs (only a file whose first bytes are a PDF or a photo counts), puts the email back to unread, reloads, reads it with Claude, and queues a job. Seen rows are keyed by subject plus arrival minute. A "Schedule Update for Job" email has its repair schedule PDF read for the electrical rows; the email body beats the PDF (a cash settled or closed out job is a cancellation).
- AroFlo tab: works the queue every 20 seconds. Matches the PO to a task by customer order number (the Ambrose 8 digit base), then by address; one open task at the same address under another PO number gets the PO appended under its description (unit style addresses like 42A - 42B/Sailaway Street count). A brand new PO waits 5 minutes (NEW_PO_WAIT, so Lisa gets first go) then creates the task: task names are capped at 50 characters (state and postcode dropped like Lisa does), the description is Lisa's layout with VISIT 1 - ISO and VISIT 2 - FIT OFF when the PO has a double site visit line. Uploads go through the task's own Add button on the Documents & Photos tab (the page's top menu Add puts files in company documents) and are checked against AroFlo's real file list. A line check flags dropped PO lines and an unsplit double visit on the check item.
- To book items carry the builder dates (from the email, the schedule PDF, or Ambrose's live repair schedule API) and the AroFlo task link; the filer checks them every 5 minutes and closes one once every date has a visit booked to anyone but Lisa. A cancellation closes the job's To book item and flags it.
- Self healing: a tab that goes quiet 8 minutes gets reopened by the other; the Outlook tab reloads itself if no pass finishes in 10 minutes; a second filer tab never picks up a job another tab is mid way through; a stood down tab says so in the log. It stops itself at 200 reads a day.

## Dashboard notes
The page (HTML, one file) reads Todoist as Ethan. The filer panel on Today shows the log with each line as a time, a kind badge, the tab and a short title, the long tail folded under More. To book and check items get an Open JN in AroFlo button from the "AroFlo: JN n <url>" line the filer writes (Todoist stores it as markdown). Follow ups tie to tracker jobs by JN, else by street name plus house number. To change the page, read the artifact in full first, edit, republish to the same URL.

## Known gaps worth knowing
- A new PO at an address with a stale open task gets appended there; the check item says so.
- Lisa and the filer can still double up if she creates the task inside the 5 minute wait; the 5pm double up check catches it.
- Scope quality is on the model; the trial puts a "Check the description" item on every new task so Ethan eyeballs them.
- A wrong skip is final, but skipped emails that carried a PDF go on one low priority item a day.
