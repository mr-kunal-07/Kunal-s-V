# Kunal’s Vault

Mobile-first React + Vite app using IBM Carbon, Firebase Authentication, Firestore, and Storage.

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

All authentication and archive data use Firebase. No mock account or browser-local archive is used. Firebase Analytics is not initialized because it is not needed for a private archive.

## Build and hosting

```powershell
npm run build
npm run preview
```

`dist` is the output. Firebase Hosting SPA rewrites are included in `firebase.json` so direct `/login` and `/dashboard` URLs work. With Firebase CLI authorization, deploy using `firebase deploy --only hosting`.

## Username accounts

The login form accepts a username or email. The username kunal maps to kunal@task-d72fd.firebaseapp.com in Firebase Authentication. Firebase requires a password of at least six characters. Passwords must never be saved in Firestore. Alias accounts do not have a real inbox, so their password resets must be performed by the Firebase project administrator. Use a real email account for email-based recovery.


## Single-user access

Only kunal's Firebase UID is accepted by the app and by the supplied Firestore/Storage rules. Publish the updated rules to enforce this on the backend. The Firebase Authentication password is not stored in Firestore and must have at least six characters.


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

Document capture uses the phone camera when supported, with an image-picker fallback. Rotate and optional grayscale/contrast are applied to a single JPEG, scaled to a maximum 2400 pixels. No OCR, automatic edge detection, perspective correction, or multipage PDF generation is included. HEIC and other image decoding depends on the browser.

Change folder color through Date & tags in the folder Actions menu. Publish the updated Firestore rules for link and folderColor fields before using them. Camera/microphone behavior and live Firebase saves need verification on your target phone.

Checklist notes: use Add item in the note dialog, check off tasks, and Save memory. Checklist text is searchable. Publish the updated Firestore rules for the checklist field.
Photo gallery: open an image to swipe left/right, use Previous/Next, or use keyboard arrows. The gallery uses images in the current filtered collection. Device swipe behavior still needs verification on your phone.


## Extended Day Book

Carry yesterday moves pending tasks from the previous calendar day to the selected day. Transactions make retries safe. For recurring instances, the target has a deterministic ID and the original instance is suppressed after a successful carry, preventing regeneration and duplicates. Existing daily instances are not duplicated.

Repeat supports Once, Daily, or selected weekdays. Schedules are stored in users/{uid}/recurringTasks. Opening a day generates due instances on demand, once per schedule/date. This is not a background scheduler: future days have no tasks until opened. Recurring schedules can be paused/resumed; existing instances stay. Deleting a recurring instance suppresses that occurrence so it does not regenerate.

Edit opens task notes, subtasks and morning/afternoon/evening slots. Main completion is independent of subtasks. Weekly review shows saved tasks Monday–Sunday; select a day card to open it. Updating an instance does not alter its recurring template. Publish the updated Firestore rules (including recurringTasks) before using these features. Date/schedule/review logic is unit tested; cloud operations still need live verification after rule deployment.


## Archive pagination and shared UI styles

The archive initially listens to 25 documents plus one lookahead record, ordered by document ID. Load 25 more expands the bounded live window. The collection renders 25 visible results per UI page, and Select page only selects that page. While partially loaded, counts carry a + marker, folder sizes are withheld, and archive totals offer an explicit Load totals action. Pinned/recent sorting applies to loaded records until the complete archive is available.

Global search (350 ms debounce), folder/filter navigation, complete totals, moves, bulk actions, trash and deletion hydrate the remaining records using cursor-based batches of 100. This preserves existing global search and recursive folder semantics rather than treating a partial inventory as complete. Full hydration is still proportional to archive size; this change reduces initial browsing reads, not the cost of global operations. No metadata migration or new Firestore indexes are needed. Loaded records remain live through a bounded Firestore subscription.

Styles now enter through src/styles.scss with foundation and component partials. Shared compact-control dimensions use --control-height (28px); existing mobile breakpoints, warm-paper colors and focus styling are retained. Day Book uses a shared CompactSelect instead of browser-native priority/repeat menus.
