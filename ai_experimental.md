# AI-Powered PDM Description Validation (Experimental)

> Gemini-powered PDM description validation for the QC Report.
> Status: **Experimental** | Model: `gemini-2.5-flash` | Provider: Google Generative AI

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [How It Works — Step by Step](#how-it-works--step-by-step)
4. [Setup & Configuration](#setup--configuration)
5. [What the AI Checks](#what-the-ai-checks)
6. [Security Measures](#security-measures)
7. [Reliability Features](#reliability-features)
8. [API Endpoints](#api-endpoints)
9. [Backend Files & Functions](#backend-files--functions)
10. [Frontend Files & Functions](#frontend-files--functions)
11. [Test Files & Coverage](#test-files--coverage)
12. [Disabling the Feature](#disabling-the-feature)
13. [Production Checklist](#production-checklist)
14. [Cost & Performance](#cost--performance)
15. [Complete File Summary](#complete-file-summary)

---

## Overview

The QC Tool includes an **experimental AI review feature** that uses Google's Gemini API to analyze PDM (Product Description Module) descriptions for grammar, style, and content quality issues. This feature runs **after** the standard QC report is generated and displays results inline within each PDM card.

> **This is an additive feature** — it does not modify any existing validation or report logic. Disabling it (via the toggle or by removing the API key) has zero impact on the rest of the application.

> **Disabled by default** — the toggle is OFF on first use. Users must manually enable it each session (preference is then saved in `localStorage`).

> **Async by design** — descriptions are processed in background queue jobs (25 PDMs per batch). Results are rendered progressively as each batch completes, allowing reports with 100–200 PDMs to be validated without hitting HTTP timeouts.

---

## Architecture Overview

### High-Level Flow

```
User clicks "Generate" on QC Report
        |
        v
+------------------------+
|  Backend generates     |  <-- Existing flow, unchanged
|  QC Report + Rules     |
|  Validation            |
+----------+-------------+
           |
           v
+------------------------+
|  Report renders in     |
|  the browser           |
+----------+-------------+
           | 'reportGenerated' event fires
           v
+------------------------+
|  AI module checks      |  <-- AI feature
|  if toggle is ON       |
|  Default: OFF          |
|  If ON:                |
|   - Shows spinner      |
|     per PDM card       |
|   - POST to            |
|     /ai-validate-start |
|   - Backend checks     |
|     cache first        |
|   - Cache hit:         |
|     immediate render   |
|   - Cache miss:        |
|     dispatches queue   |
|     job, returns jobId |
|   - Frontend polls     |
|     /ai-validate-status|
|     every 2.5 seconds  |
|   - Each batch of 25   |
|     PDMs renders as it |
|     completes          |
+------------------------+
```

### Detailed Call Chain

```
qcReport.js fires 'reportGenerated' event
        |
        v
qcAiValidation.js listens --> collects PDM descriptions from qcReportState
        |
        v
AuthManager.aiValidateStart() --> POST /api/qc/ai-validate-start
        |
        v
QualityControlController::aiValidateStart()
   |-- input validation (max 200 PDMs, strings only)
   |-- checks config (api_key, enabled)
   |-- filters empty descriptions
   |-- checks cache (md5 hash of filtered descriptions)
   |    |
   |    +-- Cache HIT:  returns results immediately { cached: true, results, ... }
   |    |
   |    +-- Cache MISS: creates AiValidationTask record (status=pending)
   |                    dispatches ProcessAiValidationJob to queue
   |                    returns { cached: false, jobId, totalBatches }
        |
        v  (cache miss path)
ProcessAiValidationJob::handle()  <-- runs in background worker
   |-- marks task status = 'processing'
   |-- splits filtered[] into chunks of 25
   |-- for each chunk:
   |     GeminiValidationService::processChunk()
   |       |-- sanitizeDescription() per PDM
   |       |-- buildPrompt() with injection boundary markers
   |       |-- callGeminiApi() with retry + exponential backoff (3 attempts)
   |       |-- parseResponse() with JSON fallback + markdown fence stripping
   |     updates AiValidationTask.completed_batches + results in DB
   |-- on all chunks done: Cache::put() full result, marks status = 'complete'
        |
        v  (frontend polling)
qcAiValidation.js --> GET /api/qc/ai-validate-status/{taskId} every 2.5s
        |
        v
QualityControlController::aiValidateStatus() --> reads AiValidationTask from DB
        |
        v
Frontend renders each PDM card as its batch result arrives
```

---

## How It Works — Step by Step

1. **User generates** a QC report as usual (click "Generate").
2. The report renders with all existing validation errors.
3. A `reportGenerated` event fires automatically.
4. The AI module (`qcAiValidation.js`) picks up this event.
5. If the **"Enable AI Review"** toggle is ON (it is **OFF by default**), it collects all PDM descriptions.
6. All descriptions are sent to `POST /api/qc/ai-validate-start`.
7. The controller validates input (type checks, max 200 PDMs), checks config, and filters empty descriptions.
8. The backend computes an MD5 cache key from the filtered descriptions.
9. **Cache hit** — if identical descriptions were validated within the last 15 minutes, results are returned immediately and rendered at once. No job is dispatched.
10. **Cache miss** — a new `AiValidationTask` record is created (status: `pending`), and a `ProcessAiValidationJob` is dispatched to the database queue. The controller returns `{ jobId, totalBatches }` immediately.
11. The frontend starts polling `GET /api/qc/ai-validate-status/{jobId}` every 2.5 seconds.
12. The queue worker picks up the job and processes descriptions in batches of 25. After each batch completes, it updates the `AiValidationTask` record with partial results.
13. Each poll checks for newly available results — PDM cards are rendered progressively as batches complete.
14. When `status === 'complete'`, polling stops and remaining loading indicators are removed.
15. Full results are cached for 15 minutes — regenerating the same report within that window returns instantly.

**Polling safeguards:**
- If the task stays `pending` for 60 seconds (24 polls), a warning is shown: "queue worker may not be running."
- If polling runs for 15 minutes (360 polls) without completing, it times out with a user-friendly message.
- If the user clears the report or generates a new one mid-poll, the active poll loop is cancelled immediately via an `activeJobId` sentinel variable.

---

## Setup & Configuration

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with a Google account
3. Click **"Create API Key"**
4. Copy the key

### 2. Add the Key to `.env`

Open the `.env` file in the project root and add:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_ENABLED=true
GEMINI_VERIFY_SSL=true
QUEUE_CONNECTION=database
```

### 3. Run Migrations

The async feature requires two database tables:

```bash
php artisan queue:table   # creates the Laravel jobs table
php artisan migrate
```

This creates:
- `jobs` — Laravel's built-in queue payload store
- `ai_validation_tasks` — progress tracking (status, completed_batches, partial results)

### 4. Start the Queue Worker

The queue worker must be running to process AI validation jobs:

```bash
# Development (run in a separate terminal)
php artisan queue:work --sleep=3 --tries=1 --max-time=3600

# Production — managed by Supervisor (see Production Checklist)
```

### 5. Configuration Options

The following settings are available in `config/qualitycontrol.php` under the `gemini` section:

| Setting      | Env Variable        | Default            | Description                                 |
|--------------|---------------------|--------------------|---------------------------------------------|
| `api_key`    | `GEMINI_API_KEY`    | `''`               | Your Gemini API key                         |
| `model`      | `GEMINI_MODEL`      | `gemini-2.5-flash` | Which Gemini model to use                   |
| `enabled`    | `GEMINI_ENABLED`    | `true`             | Master enable/disable on the backend        |
| `verify_ssl` | `GEMINI_VERIFY_SSL` | `true`             | SSL certificate verification for API calls  |

### 6. Enable/Disable in the UI

The **"Enable AI Review"** toggle switch in the QC Report header lets users turn the feature on/off at any time. This preference is saved in the browser's `localStorage` and persists across sessions.

- **Default state: OFF (disabled)** — the toggle starts unchecked on first use. Users must manually enable it.
- When the toggle is OFF, **no API calls are made**.
- Once a user enables it, that preference is remembered across sessions.

---

## What the AI Checks

The Gemini prompt instructs the AI to review each PDM description exhaustively across all three categories independently — it does not stop after finding the first error and continues checking all rules even if earlier categories returned issues.

### Grammar & Language (highest priority — checked first)
- Spelling errors — all misspellings flagged, including British English variants (e.g. "colour" → "color", "aluminium" → "aluminum")
- Grammar mistakes
- Punctuation issues
- Broken or unnatural English — non-native sentence structures, missing articles, incorrect prepositions
- Awkward or unclear phrasing
- **Not flagged:** Standard industrial abbreviations (CNC, ISO, ASTM, OEM, CAD, MIL-SPEC, etc.)
- **Not flagged:** Hyphenation of any kind — whether a compound is hyphenated, unhyphenated, or two words is acceptable

### Style Rules (checked independently)
- First-person language ("we", "our", "us") — descriptions must be third-person
- Inconsistent tense usage

### Internal PDM Rules (checked independently)
- Brand name usage when the brand is not listed in the material list
- Vague or promotional claims without measurable specifics (e.g. "high quality", "best solutions", "world-class", "state-of-the-art")
- Content that is irrelevant, contradictory, or technically incorrect
- Excessive list structure — more than 8 comma-separated values in a single sentence
- Keyword stuffing or unnatural listing patterns

---

## Security Measures

| Measure | Details |
|---------|---------|
| **SSL verification** | Enabled by default (`GEMINI_VERIFY_SSL=true`). Only disable for local dev if needed. |
| **API key protection** | Key is never embedded in URLs. Redacted (`[REDACTED]`) from all log messages and frontend error responses. |
| **Prompt injection defense** | Input sanitized (control characters stripped, 5000 char/PDM limit). Prompt uses explicit boundary markers (`--- BEGIN/END PDM DESCRIPTIONS ---`) to separate instructions from user data. |
| **Authentication** | All endpoints protected by `auth:sanctum` middleware. Only authenticated users can access them. |
| **Rate limiting** | 10 requests per minute per user via `throttle:ai-validate` middleware on both start and legacy endpoints (keyed by user ID, fallback to IP). |
| **Input validation** | Max 200 PDMs per request. Only string keys/values accepted. Non-strings silently dropped. |
| **XSS prevention** | Frontend uses `textContent` (not `innerHTML`) when rendering AI error messages. |
| **Error sanitization** | Frontend only receives generic error messages on failure — no raw API errors, response bodies, or stack traces are ever exposed. |

---

## Reliability Features

### Retry with Exponential Backoff

When the Gemini API returns a transient error, the service automatically retries per chunk:

| Attempt | Delay  | Retried On                    |
|---------|--------|-------------------------------|
| 1       | —      | Initial request               |
| 2       | 500ms  | 5xx, 429, network timeout     |
| 3       | 1000ms | 5xx, 429, network timeout     |

- **4xx errors** (except 429) fail immediately with no retry.
- All retries are logged with attempt number, delay, and HTTP status.
- After 3 failed attempts on a chunk, the chunk is skipped and the job continues with remaining chunks.
- Constants: `MAX_RETRIES = 3`, `BASE_DELAY_MS = 500`

### Batch Processing

- Descriptions are split into chunks of **25 PDMs each** (`BATCH_SIZE = 25`) before being sent to Gemini.
- Each chunk is a separate Gemini API call, keeping context tight and responses accurate.
- For a 200-PDM report: 8 batches run sequentially in the background worker.
- Progress is written to the database after each batch completes.

### Response Caching

- Successful full results are cached using an MD5 hash of the complete filtered input descriptions.
- Cache key format: `gemini_validation_{md5_hash}`
- **TTL: 15 minutes** — short enough to stay fresh, long enough to avoid duplicate API calls.
- Regenerating the same report within 15 minutes returns cached results instantly, with no job dispatched.
- Only fully successful results are cached; partial results and errors are never cached.
- Uses Laravel's configured cache driver (`file` by default).

### Polling Safeguards

| Condition | Timeout | Action |
|-----------|---------|--------|
| Task stays `pending` | 60s (24 polls × 2.5s) | Warning: "queue worker may not be running" |
| Job never completes | 15 min (360 polls × 2.5s) | Timeout warning shown |
| Report cleared | Immediate | `activeJobId = null` — polling stops silently |
| New report generated | Immediate | New `activeJobId` set — old poll loop exits |
| Toggle disabled | Immediate | `clearAiValidation()` resets `activeJobId` |

---

## API Endpoints

### `POST /api/qc/ai-validate-start`

**Middleware:** `auth:sanctum`, `throttle:ai-validate` (10 req/min/user)

Starts an async AI validation job. Returns immediately with either a cached result or a job ID to poll.

**Request body:**
```json
{
  "pdmDescriptions": {
    "12345": "Company manufactures high-quality hydraulic pumps for industrial applications.",
    "67890": "We provide the best custom machining services in the world."
  }
}
```

**Response (cache hit — returns immediately):**
```json
{
  "cached": true,
  "enabled": true,
  "results": [
    {
      "pdmNum": "67890",
      "aiErrors": [
        {
          "text": "First-person language: 'We provide' should be rewritten in third-person",
          "flags": ["Style"],
          "suggestions": ["Replace 'We provide' with 'The company provides'"]
        }
      ]
    }
  ],
  "warning": null
}
```

**Response (job dispatched):**
```json
{
  "cached": false,
  "enabled": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "totalBatches": 3
}
```

**Response (feature disabled / no API key):**
```json
{
  "enabled": false
}
```

---

### `GET /api/qc/ai-validate-status/{taskId}`

**Middleware:** `auth:sanctum`

Polls for job progress. Called every 2.5 seconds by the frontend.

**Response (in progress):**
```json
{
  "status": "processing",
  "completedBatches": 1,
  "totalBatches": 3,
  "results": [
    { "pdmNum": "12345", "aiErrors": [] },
    { "pdmNum": "67890", "aiErrors": [{ "text": "...", "flags": ["Style"], "suggestions": ["..."] }] }
  ],
  "warning": null,
  "enabled": true
}
```

**Response (complete):**
```json
{
  "status": "complete",
  "completedBatches": 3,
  "totalBatches": 3,
  "results": [ ... ],
  "warning": null,
  "enabled": true
}
```

**Response (task not found / expired):**
```json
{
  "status": "failed",
  "warning": "AI validation session not found. Please try again.",
  "enabled": true,
  "completedBatches": 0,
  "totalBatches": 0,
  "results": []
}
```

---

### `POST /api/qc/ai-validate` *(legacy — kept for backward compatibility)*

**Middleware:** `auth:sanctum`, `throttle:ai-validate`

The original synchronous endpoint. Still functional for small sets but limited by the 130s Nginx timeout. The frontend no longer calls this — use `/ai-validate-start` instead.

---

## Backend Files & Functions

### 1. `app/Domain/QualityControl/GeminiValidationService.php`

Core AI service. Handles prompt construction, API communication, response parsing, caching, and retry logic.

| Function | Visibility | Description |
|----------|-----------|-------------|
| `validateDescriptions(array $pdmDescriptions)` | `public` | Legacy entry point. Checks config, checks cache, splits into chunks of 25, calls `processChunk()` per batch, merges and caches results. Still used by the legacy `/ai-validate` endpoint. |
| `processChunk(array $chunk)` | `public` | Processes a single batch through the full Gemini pipeline: sanitize → prompt → API call → parse. Used by `ProcessAiValidationJob` for async batch processing. |
| `sanitizeDescription(string $text)` | `private` | Strips control characters (except newlines/tabs) and truncates descriptions exceeding 5000 characters. Prevents prompt injection at the input level. |
| `buildPrompt(array $descriptions)` | `private` | Constructs the Gemini prompt. Sanitizes all descriptions, encodes to JSON, and wraps with injection-boundary markers (`--- BEGIN/END PDM DESCRIPTIONS ---`). |
| `callGeminiApi(string $prompt, string $apiKey)` | `private` | Sends HTTP POST to Google Generative AI API. Implements retry logic with exponential backoff (3 attempts, 500ms base delay). Retries on 5xx and 429 errors. Handles `ConnectionException` for network timeouts. |
| `parseResponse(array $response, array $descriptions)` | `private` | Extracts text from Gemini response, strips markdown code fences if present, decodes JSON, validates error shape (`text`, `flags`, `suggestions`), deduplicates errors, and maps results back to PDM numbers using normalized key matching. |

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_RETRIES` | `3` | Maximum API call attempts per chunk |
| `BASE_DELAY_MS` | `500` | Base delay for exponential backoff (ms) |
| `BATCH_SIZE` | `25` | PDMs per Gemini API call |

---

### 2. `app/Jobs/ProcessAiValidationJob.php`

Laravel queue job that processes all description chunks in the background.

| Property / Method | Description |
|-------------------|-------------|
| `$timeout = 900` | 15-minute job timeout (8 chunks × ~120s max each) |
| `$tries = 1` | No job-level retries — `GeminiValidationService` already retries each chunk internally |
| `handle(GeminiValidationService $service)` | Marks task as `processing`, loops through chunks of 25 via `$service->processChunk()`, updates `completed_batches` and `results` in DB after each chunk, caches full result on completion, marks task `complete` |
| `failed(\Throwable $e)` | Marks task `failed` with a user-friendly warning message |

---

### 3. `app/Models/AiValidationTask.php`

Eloquent model for tracking async job progress.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(36)` | UUID primary key |
| `status` | `varchar(20)` | `pending` \| `processing` \| `complete` \| `failed` |
| `total_batches` | `integer` | Number of 25-PDM chunks |
| `completed_batches` | `integer` | Chunks processed so far |
| `results` | `json` | Accumulated results array (partial until complete) |
| `warning` | `text` \| `null` | Set on failure |
| `expires_at` | `timestamp` | 20 minutes from creation — expired tasks are pruned on next `aiValidateStart` call |
| `created_at` | `timestamp` | Auto-set by DB default |

---

### 4. `database/migrations/2026_02_28_000001_create_ai_validation_tasks_table.php`

Creates the `ai_validation_tasks` table with a status CHECK constraint: `('pending','processing','complete','failed')`.

---

### 5. `database/migrations/2026_02_28_150818_create_jobs_table.php`

Laravel's built-in queue jobs table (generated by `php artisan queue:table`). Stores serialized job payloads for the database queue driver.

---

### 6. `app/Http/Controllers/QualityControlController.php`

HTTP controller that handles all AI API endpoints.

| Method | Route | Description |
|--------|-------|-------------|
| `aiValidateStart(Request $request)` | `POST /api/qc/ai-validate-start` | Validates input (max 200 PDMs), checks config, filters empty descriptions, checks cache (returns immediately if hit), prunes expired tasks, creates `AiValidationTask`, dispatches `ProcessAiValidationJob`, returns `{ jobId, totalBatches }` |
| `aiValidateStatus(string $taskId)` | `GET /api/qc/ai-validate-status/{taskId}` | Finds task by UUID, returns current `{ status, completedBatches, totalBatches, results, warning }` |
| `aiValidate(Request $request, GeminiValidationService $geminiService)` | `POST /api/qc/ai-validate` | Legacy synchronous endpoint. Validates input, calls `validateDescriptions()`, returns full results. |

---

### 7. `routes/api.php`

| Route | Method | Middleware | Controller Method |
|-------|--------|------------|-------------------|
| `/api/qc/ai-validate-start` | `POST` | `auth:sanctum`, `throttle:ai-validate` | `aiValidateStart` |
| `/api/qc/ai-validate-status/{taskId}` | `GET` | `auth:sanctum` | `aiValidateStatus` |
| `/api/qc/ai-validate` | `POST` | `auth:sanctum`, `throttle:ai-validate` | `aiValidate` (legacy) |

---

### 8. `app/Providers/AppServiceProvider.php`

Registers the rate limiter for the AI endpoints.

| Function | Description |
|----------|-------------|
| `boot()` | Registers the `ai-validate` rate limiter: 10 requests per minute per authenticated user (falls back to IP). Applied to both `/ai-validate-start` and the legacy `/ai-validate`. |

---

### 9. `config/qualitycontrol.php`

Configuration values under the `gemini` key.

| Config Key | Env Variable | Default | Description |
|------------|-------------|---------|-------------|
| `gemini.api_key` | `GEMINI_API_KEY` | `''` | Google AI Studio API key |
| `gemini.model` | `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model identifier |
| `gemini.enabled` | `GEMINI_ENABLED` | `true` | Master backend toggle |
| `gemini.verify_ssl` | `GEMINI_VERIFY_SSL` | `true` | SSL certificate verification |

---

## Frontend Files & Functions

### 1. `public/features/qualityControl/qcReport/qcAiValidation.js`

Main frontend module. Fully event-driven, injects AI results into PDM cards progressively as batches complete.

| Function | Exported | Description |
|----------|----------|-------------|
| `isAiEnabled()` | No | Reads `aiValidationEnabled` from localStorage. Returns `false` if not set — **disabled by default**. |
| `setAiEnabled(enabled)` | No | Persists the toggle state to localStorage as a string. |
| `clearAiValidation()` | No | Sets `activeJobId = null` (cancels any active poll loop), then removes all AI-injected DOM elements from every PDM card. |
| `showLoadingIndicators(pdmNums)` | No | Creates and appends a spinner + "AI reviewing description…" indicator inside each PDM card's `.inner-content`. |
| `renderAiErrors(pdmNum, errors)` | No | Injects an error list into a specific PDM card. Clears any existing AI blocks before rendering. If `errors` is empty, shows "AI Review — No issues found". Uses `textContent` for XSS safety. |
| `showWarningInCards(pdmNums, message)` | No | Removes loading indicators and shows a warning message inside each specified PDM card. |
| `updateToggleState()` | No | Syncs the toggle checkbox and label text with the current localStorage value. Runs on init. |
| `runAiValidation()` | No | Main handler. Collects PDM descriptions, calls `authManager.aiValidateStart()`. On cache hit: renders immediately. On cache miss: sets `activeJobId` and starts `pollAiValidationStatus()`. |
| `pollAiValidationStatus(jobId, allPdmNums, renderedSet, pollCount)` | No | Polls `authManager.aiValidateStatus()` every 2.5s. Bails if `jobId !== activeJobId` (stale loop). Renders newly completed PDM cards on each poll. Stops on `complete`/`failed`/timeout/pending-timeout. |
| `initializeAiValidation()` | **Yes** | Exported initializer. Sets up the toggle checkbox listener and registers `reportGenerated` / `reportCleared` event handlers. Called once during app setup from `qcReport.js`. |

| Constant / Variable | Value | Description |
|---------------------|-------|-------------|
| `AI_SECTION_CLASS` | `ai-validation-section` | CSS class for error section container |
| `AI_LOADING_CLASS` | `ai-loading-indicator` | CSS class for loading spinner |
| `AI_WARNING_CLASS` | `ai-validation-warning` | CSS class for warning message |
| `AI_NO_ISSUES_CLASS` | `ai-no-issues` | CSS class for "no issues" message |
| `STORAGE_KEY` | `aiValidationEnabled` | localStorage key for toggle preference |
| `MAX_POLLS` | `360` | Maximum poll count (360 × 2.5s = 15 minutes) |
| `PENDING_TIMEOUT_POLLS` | `24` | Polls before "worker offline" warning (24 × 2.5s = 60s) |
| `activeJobId` | `null` \| `string` | Module-level sentinel — tracks the current poll loop's job ID |

**Events Listened:**
- `reportGenerated` — triggers `runAiValidation()`
- `reportCleared` — triggers `clearAiValidation()` (which also cancels polling)

---

### 2. `public/features/qualityControl/qcReport/qcAiValidation.css`

Stylesheet for all AI validation UI components.

| CSS Class | Description |
|-----------|-------------|
| `.ai-feedback-block` | Shared container used by both `.ai-validation-section` and `.ai-no-issues` — white card with `#e5e7eb` border and 8px border-radius |
| `.ai-validation-section` | Error results container (extends `.ai-feedback-block`) |
| `.ai-header` | Bold header with robot icon inside error section |
| `.ai-header-note` | Inline note in the header: muted grey, smaller font |
| `.ai-error-list` / `.ai-error-list li` | List of AI-detected errors — each error in its own card (`#f9fafb` bg, `#e5e7eb` border) |
| `.ai-error-suggestions` | Suggestion sub-line below each error — dashed top border, muted grey |
| `.ai-loading-indicator` | Flex container with spinner and loading text |
| `.ai-spinner` | Animated spinning circle (teal `#2c5f6f`, CSS `@keyframes ai-spin`) |
| `.ai-validation-warning` | Amber warning block (`#fffbeb` bg, amber left border) |
| `.ai-no-issues` | "No issues found" container (extends `.ai-feedback-block`) with teal robot icon |
| `.ai-toggle-switch` | Custom toggle switch (hides native checkbox) |
| `.ai-toggle-slider` | Slider track with animated knob — teal when checked (`#008080`) |
| `.ai-toggle-label` | Label text next to toggle ("Enable/Disable AI Review") |

---

### 3. `public/core/auth/AuthManager.js`

Auth manager with all AI API call methods.

| Function | Description |
|----------|-------------|
| `aiValidateStart(data)` | `POST /api/qc/ai-validate-start` with CSRF token and JSON body. Returns parsed JSON (either `{ cached: true, results }` or `{ cached: false, jobId, totalBatches }`). |
| `aiValidateStatus(taskId)` | `GET /api/qc/ai-validate-status/{taskId}`. Returns `{ status, completedBatches, totalBatches, results, warning }`. No CSRF needed (GET request). |
| `aiValidatePdmDescriptions(data)` | *(legacy)* `POST /api/qc/ai-validate`. No longer called by the frontend. |

---

### 4. `public/features/qualityControl/qcReport/qcReportState.js`

Shared state module. Provides `pdmGroups` data consumed by the AI module.

| Property | Description |
|----------|-------------|
| `qcReportState.pdmGroups` | Object keyed by PDM number, each containing `pdmText` (the description to validate) |
| `qcReportState.isReportGenerated` | Boolean flag checked by toggle handler to decide if AI validation should re-run |

---

### 5. `public/features/qualityControl/qcReport/qcReport.js`

Imports and calls `initializeAiValidation()`.

```js
import { initializeAiValidation } from './qcAiValidation.js';
```

---

### 6. `public/views/qcReport.html`

Contains the AI toggle switch UI in the report header. The checkbox has **no `checked` attribute** — it starts unchecked (disabled) by default. `updateToggleState()` applies the persisted preference from localStorage on load.

```html
<label class="ai-toggle-switch" title="Toggle AI Review">
  <input type="checkbox" id="aiToggleCheckbox">
  <span class="ai-toggle-slider"></span>
</label>
<span class="ai-toggle-label">Enable AI Review</span>
```

---

### 7. `public/index.html`

Links the AI validation stylesheet.

```html
<link rel="stylesheet" href="features/qualityControl/qcReport/qcAiValidation.css?v=0.2" />
```

---

## Test Files & Coverage

### 1. `tests/Unit/Domain/QualityControl/GeminiValidationServiceTest.php`

PHPUnit unit tests — **16 test cases**.

| Test | Category | Covers |
|------|----------|--------|
| `test_returns_disabled_when_api_key_is_empty` | Config | Missing API key returns `enabled: false` |
| `test_returns_disabled_when_feature_is_off` | Config | `GEMINI_ENABLED=false` returns `enabled: false` |
| `test_returns_empty_results_when_all_descriptions_are_blank` | Input | Empty/whitespace descriptions filtered, no API call |
| `test_successful_validation_returns_parsed_errors` | Happy Path | Errors parsed and mapped to correct PDM numbers |
| `test_successful_validation_with_no_errors_returns_empty_results` | Happy Path | Clean descriptions return empty results |
| `test_strips_markdown_code_fences_from_response` | Parsing | Markdown code fences stripped before JSON decode |
| `test_handles_unparseable_json_response_gracefully` | Parsing | Invalid JSON logged as warning, returns empty results |
| `test_filters_non_string_values_from_error_arrays` | Parsing | Non-string values (int, null) removed from error arrays |
| `test_api_client_error_returns_warning` | Error Handling | 4xx errors return user-friendly warning |
| `test_api_key_is_redacted_in_log_messages` | Security | API key replaced with `[REDACTED]` in logs |
| `test_generic_warning_message_returned_to_frontend` | Security | No raw error details sent to frontend |
| `test_retries_on_server_error_then_succeeds` | Retry | 500 on first attempt, success on second |
| `test_retries_on_429_rate_limit` | Retry | 429 on first attempt, success on second |
| `test_does_not_retry_on_client_error_4xx` | Retry | 404 fails immediately, no retry log |
| `test_fails_after_max_retries_exhausted` | Retry | 3x 500 returns warning, no crash |
| `test_caches_successful_results` | Caching | Same input twice = 1 HTTP request |
| `test_different_descriptions_are_not_cached_together` | Caching | Different input = separate HTTP requests |
| `test_filters_empty_descriptions` | Sanitization | Blank descriptions removed before API call |

---

### 2. `tests/Feature/AiValidateEndpointTest.php`

PHPUnit feature tests — **5 test cases**.

| Test | Category | Covers |
|------|----------|--------|
| `test_unauthenticated_request_returns_401` | Auth | Sanctum guard rejects unauthenticated requests |
| `test_valid_request_returns_ai_results` | Integration | Full happy path: auth -> controller -> service -> response |
| `test_invalid_input_format_returns_error` | Validation | Non-array `pdmDescriptions` returns error |
| `test_batch_size_limit_enforced` | Validation | >100 PDMs rejected with warning |
| `test_rate_limiting_applies` | Rate Limit | 11th request in a minute returns 429 |

---

### 3. `tests/js/qcAiValidation.test.js`

Jest frontend tests — **11 test cases**.

| Test | Category | Covers |
|------|----------|--------|
| Toggle defaults to disabled | Toggle State | `localStorage` returns null = **disabled** |
| Stores enabled state | Toggle State | `localStorage.setItem('aiValidationEnabled', 'true')` |
| Stores disabled state | Toggle State | `localStorage.setItem('aiValidationEnabled', 'false')` |
| Loading indicator can be added | DOM - Loading | Spinner element created in `.inner-content` |
| Loading indicator can be removed | DOM - Loading | `.ai-loading-indicator` removed from card |
| Renders AI error list | DOM - Errors | Error `<li>` elements injected into PDM card |
| Renders no-issues message | DOM - Errors | Empty errors array shows "No issues found" |
| XSS safety via textContent | DOM - Security | Malicious `<script>` rendered as text, not executed |
| Renders warning message | DOM - Warnings | Warning div injected into PDM card |
| Cleanup removes AI elements | DOM - Cleanup | All `.ai-*` classes removed, non-AI preserved |
| Toggle label updates on change | DOM - Toggle | Label switches between "Enable/Disable AI Review" |

**Run backend tests:**
```bash
php artisan test
# or
./vendor/bin/phpunit
```

**Run frontend tests:**
```bash
npm install --save-dev jest jest-environment-jsdom
npx jest tests/js/qcAiValidation.test.js
```

---

## Disabling the Feature

There are three ways to disable AI validation:

| Method                               | Scope     | Effect                                    |
|--------------------------------------|-----------|-------------------------------------------|
| Toggle "Enable AI Review" OFF        | Per user  | No API calls, preference saved in browser |
| Remove `GEMINI_API_KEY` from `.env`  | All users | Backend returns `enabled: false`          |
| Set `GEMINI_ENABLED=false` in `.env` | All users | Backend returns `enabled: false`          |

> The toggle is **OFF by default**. No action is needed to keep it disabled — users must opt in.

---

## Production Checklist

Everything required to get the AI validation feature working on a production server.

---

### 1. Environment Variables (`.env`)

```env
GEMINI_API_KEY=your-api-key-here   # Required — feature silently disables if empty
GEMINI_MODEL=gemini-2.5-flash      # Default, change only if needed
GEMINI_ENABLED=true                # Master backend switch
GEMINI_VERIFY_SSL=true             # Must be true in production
QUEUE_CONNECTION=database          # Required for async processing
```

---

### 2. Run Migrations

```bash
php artisan queue:table   # creates the jobs table
php artisan migrate --force
```

This creates `jobs` and `ai_validation_tasks` tables in addition to all other app tables.

---

### 3. Queue Worker (Supervisor)

The queue worker **must be running** on the server. Without it, AI review requests will queue up and stay in `pending` state — the frontend will show a warning after 60 seconds.

```bash
sudo apt install -y supervisor

sudo tee /etc/supervisor/conf.d/qctool-worker.conf > /dev/null << 'EOF'
[program:qctool-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/qctool/artisan queue:work --sleep=3 --tries=1 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/qctool/storage/logs/worker.log
EOF

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start qctool-worker:*
```

After code updates, restart the worker to pick up new code:
```bash
sudo supervisorctl restart qctool-worker:*
```

---

### 4. Server Outbound Network

The server must be able to make HTTPS requests to Google's API:

```
https://generativelanguage.googleapis.com
```

- **Port 443 outbound must be open** in your firewall / security group
- `GEMINI_VERIFY_SSL=true` requires the server to have a valid CA bundle (standard on most Linux servers)

---

### 5. Server & PHP Timeouts

The queue worker runs outside the Nginx HTTP cycle — it is **not** subject to Nginx/PHP-FPM timeouts. The job itself has a 15-minute timeout (`$timeout = 900` on `ProcessAiValidationJob`). No Nginx timeout changes are needed for the async feature.

The legacy `/api/qc/ai-validate` endpoint (sync) does require:

| Layer | Setting | Why |
|-------|---------|-----|
| PHP `php.ini` | `max_execution_time = 130` | PHP hard limit |
| Nginx | `fastcgi_read_timeout 130` | Proxy timeout |

---

### 6. Google AI Studio — API Key & Quotas

- Get key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Free tier**: 15 requests/min, 1,500 requests/day — sufficient for internal tool use
- **Paid tier**: needed if you have heavy usage (many users, many reports per day)
- Use a **service/team Google account**, not a personal one, so the key persists if someone leaves
- Rotate the key if it is ever exposed in logs or version control

---

### 7. Laravel Cache (required by Rate Limiter)

The `throttle:ai-validate` rate limiter requires a working Laravel cache driver.

```env
CACHE_STORE=file    # Works out of the box — ensure storage/framework/cache is writable
```

Ensure `storage/` and `bootstrap/cache/` are writable by the web server:

```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

---

### 8. Required PHP Extensions

| Extension | Used by |
|-----------|---------|
| `ext-curl` | Guzzle HTTP client |
| `ext-json` | `json_encode` / `json_decode` in service and controller |
| `ext-mbstring` | `mb_strlen` / `mb_substr` in `sanitizeDescription()` |

---

### 9. Monitor Laravel Logs

All Gemini failures are logged as `Log::warning(...)` in `GeminiValidationService.php`. Watch:

```
storage/logs/laravel.log
storage/logs/worker.log   # queue worker output
```

| Log message | Likely cause |
|-------------|-------------|
| `Gemini AI validation failed` | Invalid API key, quota exceeded, or outbound network blocked |
| `AI validation chunk returned warning` | A specific batch returned a warning — other batches still processed |
| `AI validation batch failed` | A batch threw an exception — skipped, processing continues |
| `Gemini returned non-string response payload` | Unexpected Gemini response structure |
| `Gemini returned empty response text` | Empty response from API |
| `Gemini returned unparseable response` | JSON decode failed (Gemini returned non-JSON) |
| `Gemini response did not map to requested PDM keys` | AI returned keys in an unexpected format |
| `ProcessAiValidationJob failed` | Entire job crashed (DB down, etc.) — task marked failed |

---

### 10. Rate Limit Awareness

- Configured in `AppServiceProvider.php`: **10 requests per minute per authenticated user** (falls back to IP)
- Applies to both `/ai-validate-start` and the legacy `/ai-validate`
- The status polling endpoint (`/ai-validate-status/{taskId}`) is **not rate-limited**
- If a user hits the limit they receive a 429 — the frontend shows "AI review unavailable"

---

### 11. Quick Go / No-Go Check After Deployment

```bash
# Verify API key and outbound connectivity
curl -s -o /dev/null -w "%{http_code}" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
# Expected: 200

# Verify queue worker is running
sudo supervisorctl status qctool-worker:*
# Expected: RUNNING
```

| Response code | Meaning |
|---------------|---------|
| `200` | Ready — API key valid and network open |
| `000` | Outbound network is blocked (firewall / proxy) |
| `400` | API key issue or malformed request |
| `403` | Key does not have permission for this model |
| `429` | Quota exceeded on the API key |

---

## Cost & Performance

- **One API call per 25 PDMs** — descriptions are split into batches of 25, each sent as a separate Gemini request
- **Response caching** — identical reports served from cache for 15 minutes (zero API cost, no job dispatched)
- **Non-blocking** — the report renders immediately; AI results appear progressively in the background
- **Progressive rendering** — PDM cards display results as each batch of 25 completes, no need to wait for all batches
- **Gemini 2.5 Flash** is used by default (fast, low-cost model)
- **Rate limited** — 10 requests per minute per user on the start endpoint prevents abuse
- **Typical response time**: 5–30 seconds per 25-PDM batch depending on description length
- **200 PDMs**: 8 batches run sequentially in the background worker (~4–8 minutes total, results appear progressively)
- The free tier of Google AI Studio allows up to 15 requests per minute

---

## Complete File Summary

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `app/Domain/QualityControl/GeminiValidationService.php` | Backend | Core AI service (prompt, API, parse, retry, cache, batch chunk) |
| 2 | `app/Jobs/ProcessAiValidationJob.php` | Backend | Queue job — processes all chunks, updates DB progress |
| 3 | `app/Models/AiValidationTask.php` | Backend | Eloquent model for task progress tracking |
| 4 | `app/Http/Controllers/QualityControlController.php` | Backend | API endpoints: start, status, legacy sync |
| 5 | `app/Providers/AppServiceProvider.php` | Backend | Rate limiter registration |
| 6 | `routes/api.php` | Backend | Route definitions with throttle middleware |
| 7 | `config/qualitycontrol.php` | Config | Gemini settings (key, model, enabled, SSL) |
| 8 | `.env` / `.env.example` | Config | Environment variables |
| 9 | `database/migrations/2026_02_28_000001_create_ai_validation_tasks_table.php` | Migration | `ai_validation_tasks` table |
| 10 | `database/migrations/2026_02_28_150818_create_jobs_table.php` | Migration | Laravel `jobs` table (database queue driver) |
| 11 | `public/features/qualityControl/qcReport/qcAiValidation.js` | Frontend | AI validation module (async polling, progressive rendering, disabled by default) |
| 12 | `public/features/qualityControl/qcReport/qcAiValidation.css` | Frontend | AI validation styles (white card design, teal accents) |
| 13 | `public/core/auth/AuthManager.js` | Frontend | API call methods (`aiValidateStart`, `aiValidateStatus`) |
| 14 | `public/features/qualityControl/qcReport/qcReportState.js` | Frontend | Shared state (pdmGroups data source) |
| 15 | `public/features/qualityControl/qcReport/qcReport.js` | Frontend | Imports and initializes AI module |
| 16 | `public/views/qcReport.html` | Frontend | Toggle switch UI in report header (starts unchecked) |
| 17 | `public/index.html` | Frontend | CSS stylesheet link |
| 18 | `tests/Unit/Domain/QualityControl/GeminiValidationServiceTest.php` | Test | 16 PHPUnit unit tests |
| 19 | `tests/Feature/AiValidateEndpointTest.php` | Test | 5 PHPUnit feature tests |
| 20 | `tests/js/qcAiValidation.test.js` | Test | 11 Jest frontend tests |

**Totals: 10 backend files | 7 frontend files | 3 test files | 32 test cases**
