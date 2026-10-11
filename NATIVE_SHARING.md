# Native sharing — what's left for Android and iOS

The app is a PWA today. Sharing into it works on **Android (Chrome, Edge, Samsung Internet) and desktop Chrome/Edge once the app is installed**, through the Web Share Target API. **iPhone can't receive web shares at all**: Safari doesn't support Web Share Target, so iOS sharing needs a native wrapper.

Everything below is preparation: nothing native has been built or shipped yet.

## How a share flows today

```
Share sheet ─POST /share-target─▶ public/sw.js ──▶ Cache Storage ──▶ redirect /?share=<id>
                                                                          │
src/lib/share/pwaShareInbox.js  ◀─────────────────────────────────────────┘
        │  reads the share back, deletes it
        ▼
handleIncomingShare(payload)        ← the ONE entry point (src/lib/share/handleIncomingShare.js)
        │  normalises it (classifyShare.js)
        ▼
App.jsx → link: recipe form (step 1 runs straight away)
        → text / photos: "New recipe or freezer list?" sheet
```

A native wrapper adds **another source** and calls the same function. It doesn't need to know about screens, AI, or routing.

### The contract

```js
import { handleIncomingShare } from './src/lib/share/handleIncomingShare.js'

handleIncomingShare({
  title: 'Optional subject line',
  text:  'Any shared text; a link inside it is found automatically',
  url:   'https://… (optional)',
  files: [File, File],          // images only; others are ignored. Max 3 are used per AI read.
  source: 'android' | 'ios',
})
```

`files` must be web `File` objects. Native code hands over file paths, which the bridge turns into `File`s:

```js
import { Capacitor } from '@capacitor/core'
const toFile = async ({ path, name, mimeType }) => {
  const blob = await (await fetch(Capacitor.convertFileSrc(path))).blob()
  return new File([blob], name || 'shared-photo.jpg', { type: mimeType || blob.type })
}
```

A share that arrives before React mounts is held and delivered when App subscribes, so cold starts work.

## Wrapper basics (both platforms)

1. Add Capacitor to this repo: `npm i @capacitor/core @capacitor/cli`, then `npx cap init "5 Minutes to Dinner" <app id, e.g. com.yourname.fiveminutes> --web-dir dist`.
2. `npm run build && npx cap add android` / `npx cap add ios`, and `npx cap sync` after every web build.
3. Create one bridge module, e.g. `src/lib/share/nativeShareBridge.js`. It listens for the plugin's "share received" event, converts paths with `toFile`, and calls `handleIncomingShare`. Import it from `main.jsx` behind `isNativeApp()`.
4. Things already prepared in the web code:
   - `src/lib/platform.js`: `isNativeApp()` and `openExternal()` are the only web/native switch points.
   - The service worker isn't registered inside a native app (`main.jsx`).
   - The install prompts hide themselves (`isInstalled()` is true in a native app).

## Android — left to do

1. **Intent filters.** In `android/app/src/main/AndroidManifest.xml`, on the main activity:
   ```xml
   <intent-filter>
     <action android:name="android.intent.action.SEND" />
     <category android:name="android.intent.category.DEFAULT" />
     <data android:mimeType="text/plain" />
   </intent-filter>
   <intent-filter>
     <action android:name="android.intent.action.SEND" />
     <category android:name="android.intent.category.DEFAULT" />
     <data android:mimeType="image/*" />
   </intent-filter>
   <intent-filter>
     <action android:name="android.intent.action.SEND_MULTIPLE" />
     <category android:name="android.intent.category.DEFAULT" />
     <data android:mimeType="image/*" />
   </intent-filter>
   ```
   Set `android:launchMode="singleTask"` so a share reaches the running app instead of opening a second copy.
2. **Read the intent.** Use a maintained share-intent Capacitor plugin (check that it's maintained and supports your Capacitor version), or a small plugin of your own:
   - In `MainActivity`, handle `onCreate` and `onNewIntent`.
   - Read `EXTRA_SUBJECT` → `title` and `EXTRA_TEXT` → `text`, plus `EXTRA_STREAM`: one `Uri` for `SEND`, or a list for `SEND_MULTIPLE`.
   - Copy each image `Uri` into the app's cache directory. Content URIs don't outlive the share.
   - Emit an event to JS with `{ title, text, files: [{ path, name, mimeType }] }`.
3. **Bridge** → `handleIncomingShare({ …, source: 'android' })`. Clear the intent afterwards so a rotation doesn't replay it.
4. **Test**: share a recipe link from Chrome, a caption from Instagram, a screenshot, and 3 photos at once; also try with the app cold-started.

## iOS — left to do

1. **Share Extension target.** In Xcode: File › New › Target › Share Extension. In its `Info.plist` → `NSExtensionActivationRule`:
   - `NSExtensionActivationSupportsWebURLWithMaxCount` = 1
   - `NSExtensionActivationSupportsText` = YES
   - `NSExtensionActivationSupportsImageWithMaxCount` = 3
2. **App Group.** Add the same App Group (e.g. `group.<app id>`) to the app and the extension. The extension:
   - reads its `NSExtensionItem` attachments (`public.url`, `public.plain-text`, `public.image`)
   - writes `share-<id>.json` (`{ title, text, url, files: [{ path, name, mimeType }] }`) and the image files into the shared container
   - then hands over to the app. Extensions can't open their host app directly, so either:
     - open a custom URL scheme (`fiveminutes://share?id=<id>`) through the responder chain, a common but unofficial workaround, or
     - show "Saved — open 5 Minutes to Dinner" and let the app pick it up on its next resume. This is the safer route for App Review.
3. **Main app side.** A small Capacitor plugin to:
   - read the App Group container on launch, on `appUrlOpen` and on resume
   - copy the files into the app's own storage, return them to JS, and delete them from the container.
4. **Bridge** → `handleIncomingShare({ …, source: 'ios' })`.
5. Register the URL scheme (`CFBundleURLTypes`) if you use it, and test each content type from Safari, Photos, Notes and Instagram.

## Native items outside sharing

These came up while preparing the code. None are needed for the PWA.

| Area | Today (web) | In a native wrapper |
|---|---|---|
| Owner sign-in | Email link | Add a deep link and its redirect URL in Supabase Auth, or add `{{ .Token }}` to the email template and a code box (see the note in `src/lib/supabase.js`) |
| User's Google AI key | `localStorage` (`src/lib/geminiKey.js`) | Move to Keychain / Keystore through a secure-storage plugin; keep the same three functions |
| Opening AI Studio / GitHub | `window.open` (`openExternal`) | `@capacitor/browser` |
| Service worker | Receives share posts | Not registered; native intents replace it |
| `manifest.webmanifest` `share_target` | Used by Chrome | Ignored; harmless |

## Checklist

- [ ] Capacitor added; `dist` builds into both shells
- [ ] `nativeShareBridge.js` calling `handleIncomingShare`
- [ ] Android intent filters + intent reader + `singleTask`
- [ ] iOS Share Extension + App Group + main-app reader
- [ ] Google key moved to secure storage
- [ ] External links through `@capacitor/browser`
- [ ] Share tests on real devices: link, text, 1 photo, 3 photos, cold start
