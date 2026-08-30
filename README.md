# Marquee — watch movies together, in sync

A tiny two-person "watch party" site. Each of you loads **your own local
copy** of the movie file — nothing is uploaded anywhere, so a 30GB file
is no different from a 300MB one. Only play/pause/seek moments are sent
between you, through a free Firebase database, so pressing pause on one
side pauses the other side instantly.

## Why this fixes the "only updating one side" problem

Sites like Syncup/Watch2gether either upload your video to a server (that's
why they cap file size) or rely on a sync connection that silently drops.
Here, sync is handled by Firebase Realtime Database, which keeps a
permanent live connection open in both browsers — if one of you presses
play, it writes one line of data, and the other browser is *listening*
for that line and reacts immediately. There's no "check for updates"
polling to fail silently.

The one requirement: **you must both already have the identical file**
(same encode, same cut) — sharing that file is up to you (USB drive,
Google Drive, WeTransfer, whatever). This tool only syncs the *playback*,
not the file transfer.

---

## Setup (about 10 minutes, one-time)

### 1. Create a free Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with any Google account.
2. Click **Add project**, give it any name (e.g. "movie-nights"), and finish the wizard (you can decline Google Analytics).
3. In the left sidebar, go to **Build → Realtime Database → Create Database**. Choose any region close to you, and start in **test mode** for now.
4. In the left sidebar, click the gear icon → **Project settings**. Under "Your apps", click the **</> (web)** icon to register a new web app (any nickname is fine).
5. Firebase will show you a `firebaseConfig` object with keys like `apiKey`, `authDomain`, etc. Keep this tab open.

### 2. Drop your config into the project
1. Open `firebase-config.js` in this project.
2. Replace the placeholder values with the real ones Firebase just showed you.
3. Save the file.

### 3. Lock the database down to just the two of you (important)
By default "test mode" allows anyone on the internet who finds your
database URL to read/write it. Since only you and your partner know your
**room code**, and the room code is the only "key" here, tighten the
rules a bit:

1. In Firebase, go to **Realtime Database → Rules**.
2. Replace the rules with:
   ```json
   {
     "rules": {
       "rooms": {
         "$room": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
   This keeps things simple (no login system to build), while meaning a
   stranger would need to guess your exact room code to see anything.
   Pick a room code that isn't guessable (e.g. `firefly-teacup-42`, not
   `room1`).

### 4. Put it on GitHub Pages
1. Create a new GitHub repository and upload all the files in this
   folder (`index.html`, `style.css`, `app.js`, `firebase-config.js`).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a
   branch", branch `main`, folder `/ (root)`. Save.
4. GitHub will give you a URL like
   `https://yourusername.github.io/your-repo-name/`. That's your site —
   send it to your partner.

### 5. Watch something
1. Both of you open the site, type the same room code and your own name.
2. Each of you clicks **Choose file** and picks your own copy of the movie.
3. Either of you hits play — the other side follows automatically.
4. Use the **Resync to partner** button any time things drift apart
   (e.g. after a slow seek), or just re-pause/re-play.

---

## Notes & limits

- **Browser support for file types**: Chrome/Edge play MP4 (H.264) and
  WebM natively. MKV support varies by browser and by the codecs inside
  the file — if a file won't play, that's a browser codec limitation,
  not a bug in this site. MP4 is the safest bet.
- **Small time drift** (half a second or so) between two different
  laptops/phones is normal and expected — the "Resync to partner" button
  fixes it instantly.
- **This is intentionally not multi-room-secure.** It's built for two
  people who trust each other with a shared code, not as a public
  product. Don't reuse a Firebase project across many different couples'
  room codes without adding real authentication.
- Want to reuse this for Instagram Reels or short clips too? Same flow —
  just pick that file instead of a movie file.
