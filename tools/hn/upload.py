"""Upload one episode mp3 to your YouTube Music library through Helium.

usage: python3 tools/hn/upload.py MP3 TITLE STATUS_FILE

Off by default: hn.sh calls it only when `.janus/hn/upload` exists, and it
needs a Helium profile signed in to YouTube Music. This script only uploads
the given file once. It never makes anything public, edits or deletes library
items, or touches account settings. It accepts exactly one dialog, YouTube
Music's "One more step before uploading" upload-policy prompt. Any other
visible dialog stops the upload.

TITLE must match the mp3's ID3 title (tts.py --title): it is how the library
check recognizes the song. Writes one status line to STATUS_FILE:
uploaded | already uploaded | processing | failed: <step and reason>.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT = r'''
import json, os, time
job = json.load(open(os.environ["JANUS_HN_JOB"]))
title, mp3 = job["title"], job["mp3"]
LIB = "https://music.youtube.com/library/uploaded_songs"
status = "failed: unknown"
tabs = []

def in_library():
    t = new_tab(LIB); tabs.append(t)
    wait_for_load(timeout=25); time.sleep(5)
    text = js("document.querySelector('ytmusic-section-list-renderer')?.innerText || ''") or ""
    close_tab(t); tabs.remove(t)
    return title in text

def visible_dialogs():
    return json.loads(js("""JSON.stringify([...document.querySelectorAll('tp-yt-paper-dialog')]
      .filter(d => d.getBoundingClientRect().width > 0)
      .map(d => d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200)))"""))

try:
    if in_library():
        status = "already uploaded"
        raise SystemExit
    t = new_tab(LIB); tabs.append(t)
    wait_for_load(timeout=25); time.sleep(4)
    # Catch YouTube Music's hidden file input instead of letting it open the OS picker.
    js("""(() => { const o = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () {
        if (this.type === 'file') { this.id = 'janus-file';
          if (!this.isConnected) { this.style.display = 'none'; document.body.appendChild(this); }
          return; }
        return o.call(this); }; })()""")
    if not js("!!document.querySelector('button[aria-label=\"Open avatar menu\"]')"):
        status = "failed: avatar menu button not found (signed out or layout changed)"
        raise SystemExit
    js("document.querySelector('button[aria-label=\"Open avatar menu\"]').click()")
    time.sleep(2)
    clicked = js("""(() => { const s = [...document.querySelectorAll('ytmusic-popup-container yt-formatted-string')]
      .find(e => e.innerText.trim() === 'Upload music');
      const el = s && s.closest('a,tp-yt-paper-item,ytd-compact-link-renderer');
      if (!el) return false; el.click(); return true; })()""")
    if not clicked:
        status = "failed: 'Upload music' menu item not found"
        raise SystemExit
    time.sleep(2)
    if not js("!!document.getElementById('janus-file')"):
        status = "failed: upload file input not captured"
        raise SystemExit
    upload_file("#janus-file", mp3)
    time.sleep(4)
    for d in visible_dialogs():
        if d.startswith("One more step before uploading") and "use policy" in d:
            js("""[...document.querySelectorAll('tp-yt-paper-dialog')].filter(d => d.getBoundingClientRect().width > 0)
              .flatMap(d => [...d.querySelectorAll('button')]).find(b => b.getAttribute('aria-label') === 'Accept').click()""")
            time.sleep(3)
        else:
            status = "failed: unexpected dialog: " + d
            raise SystemExit
    if visible_dialogs():
        status = "failed: dialog still open after Accept: " + visible_dialogs()[0]
        raise SystemExit
    # Upload progress: tp-yt-paper-progress reaches its max (the text can keep saying "Uploading").
    done = False
    for _ in range(90):
        p = js("""(() => { const p = document.querySelector('ytmusic-upload-progression tp-yt-paper-progress');
          return p ? [Number(p.value), Number(p.max)] : null; })()""")
        if p and p[1] and p[0] >= p[1]:
            done = True
            break
        time.sleep(10)
    if not done:
        status = "failed: upload progress did not finish within 15 minutes"
        raise SystemExit
    status = "processing: upload finished; not yet listed in Library > Uploads"
    for _ in range(10):
        if in_library():
            status = "uploaded: '" + title + "' listed in Library > Uploads > Songs"
            break
        time.sleep(50)
except SystemExit:
    pass
except Exception as e:
    status = f"failed: {type(e).__name__}: {e}"[:300]
finally:
    for t in tabs:
        try: close_tab(t)
        except Exception: pass
    open(job["status"], "w").write(status + "\n")
'''


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    mp3, title, status = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve()
    if not mp3.exists():
        status.write_text(f"failed: no file at {mp3}\n")
        sys.exit(1)
    status.unlink(missing_ok=True)
    job = status.with_suffix(".job.json")
    job.write_text(json.dumps({"mp3": str(mp3), "title": title, "status": str(status)}))
    env = os.environ | {"BU_NAME": "helium", "BU_CDP_URL": "http://127.0.0.1:9333", "JANUS_HN_JOB": str(job)}
    try:
        r = subprocess.run(["browser-use"], input=SCRIPT, text=True, env=env, timeout=1800, capture_output=True)
        if not status.exists():
            status.write_text(f"failed: browser-use exited {r.returncode}: {(r.stderr or r.stdout).strip()[-250:]}\n")
    except subprocess.TimeoutExpired:
        status.write_text("failed: upload script timed out after 30 minutes\n")
    job.unlink(missing_ok=True)
    line = status.read_text().strip()
    print(line)
    sys.exit(0 if not line.startswith("failed") else 1)


if __name__ == "__main__":
    main()
