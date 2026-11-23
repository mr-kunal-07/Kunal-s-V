# Kunal’s Vault

Mobile-first React + Vite app using IBM Carbon, Firebase Authentication, Firestore, and Storage.

## Offline access and phone installation

Keep is an installable PWA. Build with `npm run build`, then use `npm run preview -- --host 127.0.0.1 --port 4174` to test the built service worker locally. The development server serves live source; the production build precaches the app, local fonts and icons for offline launches. Firebase data and uploaded media are not cached by the service worker.

On your phone, open the deployed **HTTPS** site. Android Chrome: choose **Install app** in Keep or the browser menu. iPhone/iPad Safari: **Share → Add to Home Screen → Add**. `127.0.0.1` refers to the phone itself, so use your hosted URL rather than the computer's localhost address. The manifest includes standalone display, regular and maskable PNG icons, an Apple touch icon, and shortcuts to Day Book and the archive.

Sign in online first and open the notes/dates you want available offline. Firestore uses persistent IndexedDB storage with coordination across tabs. You can create/edit text notes, checklists, one-time tasks, and recurring task schedules offline. Saves finish after the local cache acknowledges the change. Pending writes survive reopening and sync automatically when Keep is open and connected again; closing the app does not run a background sync job. Only previously loaded archive records/tasks are available offline. Concurrent edits to the same field follow Firestore's last-write-wins behavior.

The status line distinguishes offline, connecting, syncing, and synced states. A separate local recovery journal keeps submitted note/task text if a server later rejects a change; **Sync details / Recover text** lets you copy it after fixing the problem. Recovery text for notes inside locked folders stays hidden until the folder is unlocked. Keep blocks sign-out while recoverable changes are pending. Do not clear browser/app storage before syncing: cached records and unsynced changes are stored on that device. Use the offline feature on your personal device. Folder passwords remain an application privacy lock rather than encryption.

File/image/audio uploads, attachment changes, permanent file deletion and Carry yesterday require internet. Existing attachments remain linked when editing note text offline. Recurring instances for other dates are generated after reconnection. New releases prompt for an update rather than automatically reloading an open editor.

The existing production deployment is **GitHub → Vercel**. Push the tested changes to the connected production branch to deploy. `vercel.json` selects Vite, runs `npm run build`, publishes `dist`, enables SPA routes such as `/day-book`, and sets fresh service-worker/manifest headers. Firebase remains the authentication, Firestore and file-storage backend; no Firebase Hosting deployment or Firebase CLI sign-in is needed for this update. No Firestore/Storage rule changes are required.

Validation: `npm test`; `npm run build`; `npm run check:pwa`. `npm run test:offline` uses local Auth (`9099`) and Firestore (`8088`) emulators plus the IndexedDB test adapter to check offline acknowledgement, persistence across replacing the app instance, exact-once visible records after reconnect, and recoverable rejected writes. `tests/offline-browser.html` supports manual real-browser validation when served with `VITE_FIREBASE_EMULATORS=true`; this opt-in test configuration is removed from production builds. The Rollup build dependency uses its official WebAssembly package to avoid a native module blocked by Windows security.

## Local development

```powershell
npm install
npm run dev
```

Open the printed URL. `/login` accepts an email ID and password. `/dashboard` requires authentication.

## Firebase setup (project task-d72fd)

The client configuration is in `src/firebase.js`. Firebase web configuration is public; data access is controlled by the rules, not by hiding the API key.

1. In Firebase Console > Authentication, enable the Email/Password provider. Create your account in the Users tab (Add user). There is deliberately no public registration form.
2. In Authentication > Settings > Authorized domains, add `127.0.0.1` and `localhost` if missing, plus your eventual hosted domain.
3. Create a Cloud Firestore database in Native/Standard mode. Publish `firestore.rules` in its Rules tab.
4. Initialize Cloud Storage for the configured `task-d72fd.firebasestorage.app` bucket. Firebase may require the Blaze billing plan to enable Storage. Publish `storage.rules` in its Rules tab.
5. Alternatively, with Firebase CLI installed and signed in to this project: `firebase deploy --only firestore:rules,storage`.

Rules have been supplied locally; they are not automatically deployed by running the frontend. Never use public test-mode rules for personal files.

## Features

- Existing-account email/password sign-in, password reset, persistent Firebase session, sign-out, protected routes.
- Live per-user archive at `users/{uid}/memories`.
- Nested folders, folder breadcrumbs, notes with edit support, rename, favorites, global name search, grid/list views.
- Multiple-file uploads, folder picker, recursive folder drag-and-drop on browsers supporting directory entries. Mobile uses the native file picker. Empty folders are preserved for directory drag-and-drop; directory pickers only expose folders containing files.
- Resumable file transfers with progress, 100 MB maximum per file, original folder structure and file types.
- Open/download files. Download URLs are bearer links: do not share them if a file should stay private.
- Delete files, notes, and empty folders with confirmation. Delete folder contents first.
- Accessible Carbon forms, dialogs, notifications, loading/error/empty states and responsive navigation.

All authentication and cloud archive data use Firebase. Offline copies and pending note/task changes are cached on the device; there is no separate mock account or local-only archive. Firebase Analytics is not initialized because it is not needed for a private archive.

## Build and hosting

```powershell
npm run build
npm run preview
```

`dist` is the output. Vercel deploys it from the connected GitHub repository using `vercel.json`. Direct `/login`, `/dashboard` and `/day-book` routes load the SPA. The existing Firebase rules/config files remain available for managing the data backend.

## Username accounts

The login form accepts a username or email. The username kunal maps to kunal@task-d72fd.firebaseapp.com in Firebase Authentication. Firebase requires a password of at least six characters. Passwords must never be saved in Firestore. Alias accounts do not have a real inbox, so their password resets must be performed by the Firebase project administrator. Use a real email account for email-based recovery.


## Single-user access

Only kunal's Firebase UID is accepted by the app and by the supplied Firestore/Storage rules. Publish the updated rules to enforce this on the backend. The Firebase Authentication password is not stored in Firestore and must have at least six characters.

## Password-protected folders

New folder includes an optional **Protect with password** toggle. When enabled, enter and confirm an 8–128 character password. Existing folders and folders created with the toggle off behave as before. Only a random salt and a PBKDF2-SHA-256 verifier (600,000 iterations) are saved; the password is never stored.

Opening a protected folder prompts for its password. Unlocks stay in memory until refresh or sign-out. Nested protected folders require their own passwords. Locked descendants are hidden from search, favorites, notes, files, gallery previews, and Trash listings. Direct folder URLs are also gated. Bulk downloads and recursive changes reject selections containing any locked folder; move destinations exclude locked folders.

This is an app-level privacy lock, not encryption or a second Firebase authorization boundary. The signed-in owner and project administrators retain backend access. Existing file download URLs remain bearer links. Forgotten folder passwords cannot be recovered through the app.

Publish the updated `firestore.rules` in project `task-d72fd` before creating protected folders. The rules validate the verifier format and prevent client updates from removing or replacing an existing lock. Storage rules do not change. Tests cover password derivation, incorrect passwords, nested locks, direct-path access checks, and missing or cyclic ancestry. Firestore emulator checks also verified valid writes, malformed locks, and owner restrictions.


## Previews, moves, dates and tags

Click a file card to preview images, PDFs, browser-supported video/audio, or text (up to 1 MB). Unsupported formats retain an open/download action. HTML is displayed as escaped text. Text previews require the Storage bucket to permit the app origin via CORS.

Use each card's Actions menu for **Move to folder** or **Date & tags**. Moves include a folder's descendants and exclude itself and all descendant destinations. Set a memory date and up to 20 comma-separated tags, then search by name, tag, person, occasion, or year.

Publish the updated `firestore.rules` before saving dates/tags; older strict rules reject these new fields. Existing memories work without metadata. Tests cover directory batching, move cycles, tag limits, search, and preview detection. Live cloud writes and media playback require verification with your configured Firebase services.

## Bulk actions and Trash

Select row/card checkboxes or Select all, then Move, Tag, Download, or Delete. Move and Tag commit atomically for up to 400 targets; tags are appended without removing existing ones. Downloads are a single uncompressed ZIP, including selected folder contents and notes as text; maximum 200 MB of source files per operation.

Delete now moves items and folder contents to Trash without deleting stored files. Open Trash in the sidebar to restore or permanently delete (confirmed). Bulk trash/restore supports up to 400 items including folder contents; restoring a child also restores any trashed ancestors so the item stays reachable. Permanent deletion stops on the first failure and reports partial completion.

Publish the updated Firestore rules to allow the deletedAt field. These features were checked with build and unit tests; live operations depend on the deployed Firebase rules and Storage CORS settings.

## Links, voice memories, folder colors and document capture

Search now includes note bodies, saved-link descriptions and URLs. Toolbar icons create saved links, record voice memories, or capture a document. Saved links support an HTTP(S) URL, title, notes and tags; a Saved links sidebar filter is included. ZIP downloads export links as text containing the URL and notes.

Voice recording starts only after pressing Start recording and granting microphone permission. Recordings stop after approximately five minutes and can be played before saving. Microphone tracks are stopped on dialog close. Use HTTPS on a phone (localhost is suitable on the development computer).

Document capture uses the phone camera when supported, with an image-picker fallback. All image uploads, including document captures and note attachments, preserve the exact bytes of the file supplied by the device: original resolution, format, embedded metadata, animation, and file size. The app does not resize, compress, convert images to JPEG, or apply saved filters. A capture title can change the filename while preserving its original extension and content. Images up to 100 MB are accepted; larger images are rejected rather than compressed. Audio note attachments retain their 20 MB limit. Files are stored in Firebase Storage, with their size, MIME type, and path in Firestore. Existing images that were previously reduced cannot regain their original quality without being uploaded again. No OCR, automatic edge detection, perspective correction, or multipage PDF generation is included. HEIC and other image previews depend on the browser; uploading does not require decoding the image.

Change folder color through Date & tags in the folder Actions menu. Publish the updated Firestore rules for link and folderColor fields before using them. Camera/microphone behavior and live Firebase saves need verification on your target phone.

Checklist notes: use Add item in the note dialog, check off tasks, and Save memory. Checklist text is searchable. Publish the updated Firestore rules for the checklist field.
Photo gallery: open an image to swipe left/right, use Previous/Next, or use keyboard arrows. The gallery uses images in the current filtered collection. Device swipe behavior still needs verification on your phone.


## Extended Day Book

Carry yesterday moves pending tasks from the previous calendar day to the selected day. Transactions make retries safe. For recurring instances, the target has a deterministic ID and the original instance is suppressed after a successful carry, preventing regeneration and duplicates. Existing daily instances are not duplicated.

Repeat supports Once, Daily, or selected weekdays. Schedules are stored in users/{uid}/recurringTasks. Opening a day generates due instances on demand, once per schedule/date. This is not a background scheduler: future days have no tasks until opened. Recurring schedules can be paused/resumed; existing instances stay. Deleting a recurring instance suppresses that occurrence so it does not regenerate.

Edit opens task notes, subtasks and morning/afternoon/evening slots. Main completion is independent of subtasks. Weekly review shows saved tasks Monday–Sunday; select a day card to open it. Updating an instance does not alter its recurring template. Publish the updated Firestore rules (including recurringTasks) before using these features. Date/schedule/review logic is unit tested; cloud operations still need live verification after rule deployment.


## Archive pagination and shared UI styles

Sidebar badges match the view opened by each button: All memories counts active items at the archive root, while Notes, Files, Saved links, Favorites and Trash count the accessible records in their respective views. Folder rows and sidebar entries show immediate child counts, excluding trashed children of active folders. Protected-folder counts stay hidden until unlocked. A `+` means the archive is only partially loaded. Day Book shows the task count for its selected date (today in India initially), including completed tasks and excluding suppressed occurrences. The sidebar and daily view share one live task subscription, so additions and deletions update both together.

The archive initially listens to 25 documents plus one lookahead record, ordered by document ID. Load 25 more expands the bounded live window. The collection renders 25 visible results per UI page, and Select page only selects that page. While partially loaded, counts carry a + marker, folder sizes are withheld, and archive totals offer an explicit Load totals action. Pinned/recent sorting applies to loaded records until the complete archive is available.

Global search (350 ms debounce), folder/filter navigation, complete totals, moves, bulk actions, trash and deletion hydrate the remaining records using cursor-based batches of 100. This preserves existing global search and recursive folder semantics rather than treating a partial inventory as complete. Full hydration is still proportional to archive size; this change reduces initial browsing reads, not the cost of global operations. No metadata migration or new Firestore indexes are needed. Loaded records remain live through a bounded Firestore subscription.

Styles now enter through src/styles.scss with foundation and component partials. Shared compact-control dimensions use --control-height (28px); existing mobile breakpoints, warm-paper colors and focus styling are retained. Day Book uses a shared CompactSelect instead of browser-native priority/repeat menus.
