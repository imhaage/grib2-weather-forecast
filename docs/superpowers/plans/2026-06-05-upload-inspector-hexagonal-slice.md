# Upload Inspector Hexagonal Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the upload inspector workflow behind a strict TypeScript use-case boundary while preserving the existing controller API and UI behavior.

**Architecture:** Add an event-driven `inspectUploadedFile` use case under `use-cases/upload-inspector/`, with explicit ports for file reading and GRIB message iteration. Move the browser `FileReader` integration to `adapters/upload-inspector/`, and keep the controller as a thin UI adapter that maps use-case events to existing DOM updates.

**Tech Stack:** TypeScript strict boundaries, JavaScript controller compatibility through `allowJs`, Vitest with jsdom for controller/UI integration, Vitest node/jsdom for use-case tests.

---

## File Structure

- Create: `apps/visualize/src/use-cases/upload-inspector/ports.ts`
  - Defines the upload inspector file, message, result, ports, and event types.

- Create: `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.ts`
  - Implements the event-driven upload inspection use case.
  - Reads file data through `fileReader`.
  - Iterates messages through `messageIterator`.
  - Emits `reading`, `empty`, `ready`, and `error`.

- Create: `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.test.ts`
  - Tests the use case without DOM, FileReader, or real GRIB decoding.

- Create: `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.ts`
  - Implements the browser FileReader adapter.

- Delete: `apps/visualize/src/services/browser-file-reader-service.js`
  - The adapter replaces this transitional service.

- Modify: `apps/visualize/src/controllers/upload-inspector-controller.js`
  - Import the new use case and adapter.
  - Keep the public API: `processFile`, `getSelectedMessage`, `hasFile`, `reset`.
  - Map use-case events to existing DOM updates and UI text.

- Modify: `apps/visualize/src/services/browser-file-reader-service.test.js`
  - Replace with `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.test.ts`, or remove if equivalent coverage is not valuable after the move. Prefer one small adapter test.

- Modify if needed: `apps/visualize/src/controllers/upload-inspector-controller.test.js`
  - Keep behavior expectations unchanged.
  - Update mocks only for the new dependency names.

- Modify if needed: `apps/visualize/src/ui/inspect-flow.test.js`
  - Keep integration behavior unchanged.

## DRY and Boundary Notes Before Editing

Current upload inspector logic has no major duplicated algorithmic blocks. The main issue is responsibility mixing inside `upload-inspector-controller.js`:

- file reading;
- message iteration;
- workflow state;
- summary construction;
- DOM rendering;
- user-facing status text.

Do not introduce helper abstractions just to reduce a few lines. The chosen abstraction is the use-case boundary:

- `inspect-uploaded-file.ts` owns the workflow and emits application events.
- `browser-file-reader-adapter.ts` owns browser `FileReader`.
- `upload-inspector-controller.js` owns DOM mapping and current selected-message state.

---

### Task 1: Add Upload Inspector Ports

**Files:**
- Create: `apps/visualize/src/use-cases/upload-inspector/ports.ts`

- [ ] **Step 1: Create the strict TypeScript port definitions**

Add `apps/visualize/src/use-cases/upload-inspector/ports.ts`:

```ts
export interface UploadInspectorFile {
  name: string;
  size: number;
}

export interface UploadInspectorMessage {
  index: number;
  header: {
    centre?: number;
    [key: string]: unknown;
  };
  product: {
    shortName: string;
    name?: string;
    units?: string;
    [key: string]: unknown;
  };
  grid?: unknown;
  [key: string]: unknown;
}

export interface UploadInspectionResult {
  file: {
    name: string;
    sizeLabel: string;
  };
  summary: {
    messageCount: number;
    centreLabel: string;
    referenceTimeLabel: string;
  };
  messages: UploadInspectorMessage[];
}

export type UploadInspectionEvent =
  | { type: "reading" }
  | { type: "empty" }
  | { type: "ready"; result: UploadInspectionResult }
  | { type: "error"; error: Error };

export interface UploadInspectorFileReaderPort {
  readAsArrayBuffer(file: UploadInspectorFile): Promise<ArrayBuffer>;
}

export interface UploadInspectorMessageIteratorPort {
  iterateMessages(buffer: ArrayBuffer): Iterable<UploadInspectorMessage>;
}

export interface UploadInspectorFormatters {
  formatFileSize(size: number): string;
  formatReferenceTime(header: UploadInspectorMessage["header"]): string;
}

export type UploadInspectionEventHandler = (event: UploadInspectionEvent) => void;
```

- [ ] **Step 2: Run typecheck to verify the new file is valid**

Run:

```bash
npm run typecheck:visualize
```

Expected: PASS.

---

### Task 2: Add the Event-Driven Use Case

**Files:**
- Create: `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.ts`
- Create: `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.test.ts`

- [ ] **Step 1: Write failing use-case tests**

Add `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { inspectUploadedFile } from "./inspect-uploaded-file";
import type { UploadInspectionEvent, UploadInspectorMessage } from "./ports";

function message(index: number, shortName = `var-${index}`): UploadInspectorMessage {
  return {
    index,
    header: { centre: 85 },
    product: { shortName, name: shortName.toUpperCase() },
  };
}

describe("inspectUploadedFile", () => {
  test("emits reading then ready with a typed summary", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "forecast.grib2", size: 123 },
      centres: { 85: "Meteo-France" },
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => [message(0, "t"), message(1, "r")]),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "2026-06-01 00:00 UTC",
      },
      emit: (event) => events.push(event),
    });

    expect(events.map((event) => event.type)).toEqual(["reading", "ready"]);
    expect(events[1]).toEqual({
      type: "ready",
      result: {
        file: {
          name: "forecast.grib2",
          sizeLabel: "123 bytes",
        },
        summary: {
          messageCount: 2,
          centreLabel: "Meteo-France",
          referenceTimeLabel: "2026-06-01 00:00 UTC",
        },
        messages: [message(0, "t"), message(1, "r")],
      },
    });
  });

  test("emits empty when no messages are decoded", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "empty.grib2", size: 0 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => []),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "unused",
      },
      emit: (event) => events.push(event),
    });

    expect(events.map((event) => event.type)).toEqual(["reading", "empty"]);
  });

  test("emits error when reading or decoding fails", async () => {
    const events: UploadInspectionEvent[] = [];
    const failure = new Error("Could not read file.");

    await inspectUploadedFile({
      file: { name: "broken.grib2", size: 1 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => {
          throw failure;
        }),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => []),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "unused",
      },
      emit: (event) => events.push(event),
    });

    expect(events).toEqual([{ type: "reading" }, { type: "error", error: failure }]);
  });

  test("falls back to a centre label when the centre code is unknown", async () => {
    const events: UploadInspectionEvent[] = [];

    await inspectUploadedFile({
      file: { name: "forecast.grib2", size: 123 },
      centres: {},
      fileReader: {
        readAsArrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      },
      messageIterator: {
        iterateMessages: vi.fn(() => [message(0, "t")]),
      },
      formatters: {
        formatFileSize: (size) => `${size} bytes`,
        formatReferenceTime: () => "2026-06-01 00:00 UTC",
      },
      emit: (event) => events.push(event),
    });

    expect(events[1]).toMatchObject({
      type: "ready",
      result: {
        summary: {
          centreLabel: "Centre 85",
        },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:visualize -- --run src/use-cases/upload-inspector/inspect-uploaded-file.test.ts
```

Expected: FAIL because `inspect-uploaded-file.ts` does not exist yet.

- [ ] **Step 3: Implement the use case**

Add `apps/visualize/src/use-cases/upload-inspector/inspect-uploaded-file.ts`:

```ts
import type {
  UploadInspectionEventHandler,
  UploadInspectorFile,
  UploadInspectorFileReaderPort,
  UploadInspectorFormatters,
  UploadInspectorMessageIteratorPort,
} from "./ports";

interface InspectUploadedFileOptions {
  file: UploadInspectorFile;
  centres: Record<number, string>;
  fileReader: UploadInspectorFileReaderPort;
  messageIterator: UploadInspectorMessageIteratorPort;
  formatters: UploadInspectorFormatters;
  emit: UploadInspectionEventHandler;
}

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function inspectUploadedFile({
  file,
  centres,
  fileReader,
  messageIterator,
  formatters,
  emit,
}: InspectUploadedFileOptions): Promise<void> {
  emit({ type: "reading" });

  try {
    const buffer = await fileReader.readAsArrayBuffer(file);
    const messages = [...messageIterator.iterateMessages(buffer)];
    if (messages.length === 0) {
      emit({ type: "empty" });
      return;
    }

    const first = messages[0];
    const centreCode = first.header.centre;
    emit({
      type: "ready",
      result: {
        file: {
          name: file.name,
          sizeLabel: formatters.formatFileSize(file.size),
        },
        summary: {
          messageCount: messages.length,
          centreLabel:
            centreCode == null ? "Unknown centre" : (centres[centreCode] ?? `Centre ${centreCode}`),
          referenceTimeLabel: formatters.formatReferenceTime(first.header),
        },
        messages,
      },
    });
  } catch (error) {
    emit({ type: "error", error: errorFromUnknown(error) });
  }
}
```

- [ ] **Step 4: Run use-case tests**

Run:

```bash
npm run test:visualize -- --run src/use-cases/upload-inspector/inspect-uploaded-file.test.ts
```

Expected: PASS.

---

### Task 3: Move Browser FileReader to an Adapter

**Files:**
- Create: `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.ts`
- Create: `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.test.ts`
- Delete: `apps/visualize/src/services/browser-file-reader-service.js`
- Delete: `apps/visualize/src/services/browser-file-reader-service.test.js`

- [ ] **Step 1: Write the adapter test**

Add `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.test.ts`:

```ts
// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { createBrowserFileReaderAdapter } from "./browser-file-reader-adapter";

describe("createBrowserFileReaderAdapter", () => {
  test("reads a browser file as an ArrayBuffer", async () => {
    const buffer = new ArrayBuffer(4);
    const readAsArrayBuffer = vi.fn(function read(this: FileReader) {
      this.onload?.({ target: { result: buffer } } as ProgressEvent<FileReader>);
    });
    const OriginalFileReader = globalThis.FileReader;

    class StubFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer = readAsArrayBuffer;
    }

    vi.stubGlobal("FileReader", StubFileReader);
    const adapter = createBrowserFileReaderAdapter();

    await expect(adapter.readAsArrayBuffer({ name: "forecast.grib2", size: 4 })).resolves.toBe(
      buffer,
    );
    expect(readAsArrayBuffer).toHaveBeenCalledOnce();

    vi.stubGlobal("FileReader", OriginalFileReader);
  });

  test("rejects when FileReader fails", async () => {
    const readAsArrayBuffer = vi.fn(function read(this: FileReader) {
      this.onerror?.();
    });
    const OriginalFileReader = globalThis.FileReader;

    class StubFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer = readAsArrayBuffer;
    }

    vi.stubGlobal("FileReader", StubFileReader);
    const adapter = createBrowserFileReaderAdapter();

    await expect(adapter.readAsArrayBuffer({ name: "broken.grib2", size: 4 })).rejects.toThrow(
      "Could not read file.",
    );

    vi.stubGlobal("FileReader", OriginalFileReader);
  });
});
```

- [ ] **Step 2: Run adapter tests to verify they fail**

Run:

```bash
npm run test:visualize -- --run src/adapters/upload-inspector/browser-file-reader-adapter.test.ts
```

Expected: FAIL because the adapter does not exist yet.

- [ ] **Step 3: Implement the adapter**

Add `apps/visualize/src/adapters/upload-inspector/browser-file-reader-adapter.ts`:

```ts
import type { UploadInspectorFileReaderPort } from "../../use-cases/upload-inspector/ports";

export function createBrowserFileReaderAdapter(): UploadInspectorFileReaderPort {
  return {
    readAsArrayBuffer(file) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result;
          if (result instanceof ArrayBuffer) {
            resolve(result);
            return;
          }
          reject(new Error("Could not read file."));
        };
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsArrayBuffer(file as Blob);
      });
    },
  };
}
```

- [ ] **Step 4: Remove the old service files**

Delete:

```txt
apps/visualize/src/services/browser-file-reader-service.js
apps/visualize/src/services/browser-file-reader-service.test.js
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
npm run test:visualize -- --run src/adapters/upload-inspector/browser-file-reader-adapter.test.ts
```

Expected: PASS.

---

### Task 4: Rewire the Upload Inspector Controller

**Files:**
- Modify: `apps/visualize/src/controllers/upload-inspector-controller.js`
- Test: `apps/visualize/src/controllers/upload-inspector-controller.test.js`
- Test: `apps/visualize/src/ui/inspect-flow.test.js`

- [ ] **Step 1: Update the controller implementation**

Modify `apps/visualize/src/controllers/upload-inspector-controller.js`:

```js
import { createBrowserFileReaderAdapter } from "../adapters/upload-inspector/browser-file-reader-adapter";
import { inspectUploadedFile } from "../use-cases/upload-inspector/inspect-uploaded-file";

export function createUploadInspectorController({
  centres,
  dom,
  formatRefTime,
  formatSize,
  iterateMessages,
  fileReader = createBrowserFileReaderAdapter(),
  readFileAsArrayBuffer,
  renderCard,
}) {
  let fileState = null;
  const resolvedFileReader = readFileAsArrayBuffer
    ? { readAsArrayBuffer: readFileAsArrayBuffer }
    : fileReader;

  function setStatus(message, isError = false) {
    dom.status.textContent = message;
    dom.status.classList.toggle("error", isError);
  }

  function resetRenderedFile() {
    dom.summary.hidden = true;
    dom.results.hidden = true;
    dom.cards.replaceChildren();
  }

  function renderInspectionResult(result) {
    fileState = { messages: result.messages };
    dom.name.textContent = result.file.name;
    dom.size.textContent = result.file.sizeLabel;
    dom.count.textContent = result.summary.messageCount;
    dom.centre.textContent = result.summary.centreLabel;
    dom.referenceTime.textContent = result.summary.referenceTimeLabel;
    dom.summary.hidden = false;
    dom.cards.replaceChildren(
      ...result.messages.map((message) => renderCard(dom.cards.ownerDocument, message)),
    );
    dom.results.hidden = false;
    setStatus("");
  }

  function handleInspectionEvent(event) {
    switch (event.type) {
      case "reading":
        resetRenderedFile();
        setStatus("Reading file...");
        break;
      case "empty":
        fileState = null;
        setStatus("No GRIB2 messages found.", true);
        break;
      case "ready":
        renderInspectionResult(event.result);
        break;
      case "error":
        fileState = null;
        setStatus(`Error: ${event.error.message}`, true);
        break;
    }
  }

  function reset() {
    fileState = null;
    resetRenderedFile();
    dom.status.textContent = "";
    dom.status.classList.remove("error");
  }

  async function processFile(file) {
    await inspectUploadedFile({
      file,
      centres,
      fileReader: resolvedFileReader,
      messageIterator: { iterateMessages },
      formatters: {
        formatFileSize: formatSize,
        formatReferenceTime: formatRefTime,
      },
      emit: handleInspectionEvent,
    });
  }

  function getSelectedMessage(route) {
    if (!fileState) return null;
    if (route.messageIndex != null) {
      return fileState.messages.find((message) => message.index === route.messageIndex) ?? null;
    }
    return (
      fileState.messages.find((message) => message.product.shortName === route.variableShortName) ??
      null
    );
  }

  return {
    getSelectedMessage,
    hasFile: () => Boolean(fileState),
    processFile,
    reset,
  };
}
```

- [ ] **Step 2: Run controller and flow tests**

Run:

```bash
npm run test:visualize -- --run src/controllers/upload-inspector-controller.test.js src/ui/inspect-flow.test.js
```

Expected: PASS.

- [ ] **Step 3: Search for stale imports**

Run:

```bash
rg "browser-file-reader-service|readFileAsArrayBuffer" apps/visualize/src
```

Expected: no `browser-file-reader-service` matches. `readFileAsArrayBuffer` may still appear in controller tests as a backwards-compatible injection name.

---

### Task 5: Verify Strict Boundaries and Commit

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run focused upload tests**

Run:

```bash
npm run test:visualize -- --run src/use-cases/upload-inspector/inspect-uploaded-file.test.ts src/adapters/upload-inspector/browser-file-reader-adapter.test.ts src/controllers/upload-inspector-controller.test.js src/ui/inspect-flow.test.js
```

Expected: PASS.

- [ ] **Step 2: Run visualize typecheck**

Run:

```bash
npm run typecheck:visualize
```

Expected: PASS.

- [ ] **Step 3: Run visualize lint/check**

Run:

```bash
npm run check:visualize
```

Expected: PASS.

- [ ] **Step 4: Run visualize build**

Run:

```bash
npm run build:visualize
```

Expected: PASS. Existing Vite warnings about browser externalization or chunk size are acceptable if unchanged.

- [ ] **Step 5: Commit the upload inspector slice**

Run:

```bash
git add apps/visualize/src/use-cases/upload-inspector apps/visualize/src/adapters/upload-inspector apps/visualize/src/controllers/upload-inspector-controller.js apps/visualize/src/controllers/upload-inspector-controller.test.js apps/visualize/src/ui/inspect-flow.test.js apps/visualize/src/services/browser-file-reader-service.js apps/visualize/src/services/browser-file-reader-service.test.js
git commit -m "Extract upload inspector use case"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: the plan implements the first upload inspector slice, creates `use-cases/` and `adapters/`, uses strict TypeScript for new boundaries, keeps `ui/` unchanged, and removes one file from `services/`.
- Placeholder scan: no deferred TODO/TBD steps remain.
- Type consistency: port names, event names, result fields, controller injection names, and test expectations match across tasks.
