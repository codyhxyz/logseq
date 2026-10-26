# Inline page editors

This feature targets Logseq DB 2.0.2 on Apple Silicon macOS.
The base revision is `533ac4382a7b69baa98de3a973bff90305b212dc`.

## Use

1. Open `artifacts/inline-desktop/mac-arm64/Logseq Inline.app`.
2. Create a page link with `[[`.
3. Click the link to expand its page below the bullet.
4. Edit the content with the normal Logseq editor.
5. Create another link inside the expansion.
6. Click that link to expand another editor.

Click an expanded link again to collapse its editor.
The close button also collapses the editor.
The editor saves the current block before it closes.

Shift-click retains Logseq's sidebar action.
The panel title retains normal page navigation.
Command-click or Control-click bypasses inline expansion.

Edits change the original blocks, not copies.
Other open editors show these changes.
The normal editor supplies autocomplete, new pages, blocks, indentation, formatting, and undo.

Each link occurrence has separate expansion state.
An expansion cannot open a page already present in its ancestor chain.
Other branches can open the same page.
Circular links remain valid graph data.

Expansion state belongs to the current view.
It does not change the graph schema or synchronize between devices.
Changes to a block's structure can close its expansions.

## Appearance

Inline editors use a thin neutral frame and the normal page background.
Expanded references have a cyan background.
Page titles retain normal navigation and show an underline on hover.
Close buttons appear on hover or keyboard focus on desktop.
Touch devices always show the close buttons.
Nested editors use less padding and keep the same background.

## Data separation

The custom app uses this directory:

```text
~/Library/Application Support/Logseq Inline/
├── graphs/
├── home/
└── profile/
```

It does not automatically open the installed app's graphs.
Its launcher separates preferences, plugins, and graph storage.
It preserves the real home directory so macOS can access the normal Keychain.
It does not install the CLI, register the stock protocol, or enable upstream application updates.

To use existing graphs in place, create `inline-config.json` in that directory:

```json
{
  "graphsDir": "/absolute/path/to/existing/graphs"
}
```

The directory must exist.
This setting selects the original databases, not copies.
Preferences and plugins remain separate.
Close stock Logseq before the custom app opens these graphs.

For tests, `LOGSEQ_INLINE_DATA_DIR` selects another isolated directory.
Keep this directory separate from real graph storage.

## Try a copy of your notes

1. Back up the graph from stock Logseq.
2. Export the graph using Logseq's DB export.
3. Import the export into Logseq Inline.

Keep the stock app and its original graph unchanged during evaluation.
Do not open the same database with both apps.

## Build

Requirements: Node 22.20 or newer, pnpm 10.33, Java 21, and Clojure CLI.

From the repository root:

```bash
node scripts/build-inline-desktop.mjs
```

The script compiles the app, bundles the worker, and builds an unsigned `.app`.
It installs desktop dependencies in a temporary directory outside the pnpm workspace.
The sandbox build does not require the separate OCaml CLI toolchain.

If the release artifacts already match the source, package them with:

```bash
node scripts/build-inline-desktop.mjs --package-only
```

If the current app is running, build into a separate directory:

```bash
LOGSEQ_INLINE_OUTPUT_DIR=artifacts/inline-quiet-frame \
  node scripts/build-inline-desktop.mjs --package-only
```

This command does not replace the running app.
After the build passes its tests, quit the current app before opening the new build.

The app is not signed or notarized.
macOS can require approval under System Settings → Privacy & Security.

## Test

Test the packaged desktop app:

```bash
LOGSEQ_ELECTRON_EXECUTABLE="$PWD/artifacts/inline-desktop/mac-arm64/Logseq Inline.app/Contents/MacOS/Logseq Inline" \
  node scripts/test-inline-expansions.cjs
```

The test creates a disposable graph.
It covers separate occurrences, shared edits, recursive expansion, cycles, native link creation, new blocks, save-on-close, and undo/redo.
The test terminates its isolated app process after the assertions.

Test launcher isolation:

```bash
node scripts/test-inline-launcher.cjs
```

Test the pure expansion model:

```bash
clojure -Sdeps '{:paths ["src/main" "src/test"]}' -M -e \
  "(require '[frontend.components.block.inline-expansion-test] '[clojure.test :as t]) (let [r (t/run-tests 'frontend.components.block.inline-expansion-test)] (System/exit (+ (:fail r) (:error r))))"
```

The CLJS test runner also discovers the same model tests.

## Verification notes

- Native browser interaction tests passed.
- The optimized desktop build passed the interaction tests against an isolated SQLite graph.
- The model tests passed in Clojure and ClojureScript.
- The i18n checks found no new hardcoded UI text or missing translation keys.
- A broader Node block-test run stopped on an asynchronous `document is not defined` error in existing selection code.
- The repository's `bb` and `spec-dev-tool` commands were unavailable locally.
- Automated review helpers timed out without a final report; they are not evidence of a completed independent review.

## Roll back

Quit Logseq Inline.
Open the original Logseq app.
The original installation and its graph remain unchanged.
Keep the custom app's data directory if it contains notes you want to retain.
