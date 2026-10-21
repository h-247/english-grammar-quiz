# English Grammar Quiz

A full-stack, production-quality web application for interactive English grammar learning and testing, built on the **free technology stack for Local Development & ChatGPT Sites**.

Features interactive dual quiz modes (**"Timed Exam"** vs. **"Self-Paced Practice"**), server-authoritative timers, instant per-blank evaluation with grammatical explanations, complete quiz lifecycle management (CRUD, overwrite, and JSON schema 2.0 import), course hierarchy mapping 28 units from Destination B1, search, topic tagging, and unit filtering.

---

## 1. Technology Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS (v4), built with the official **Sites Vinext starter** and preserving its `sites()` build integration.
- **Backend:** TypeScript API route handlers within the same Vinext application, running on the **Cloudflare Workers** edge runtime.
- **Database:** **Cloudflare D1** (SQLite-compatible) + **Drizzle ORM**, with persistent local emulation through Wrangler/Miniflare tooling.
- **File Storage (if needed):** Sites-managed Cloudflare R2 in production and local Miniflare emulation during development.
- **Validation:** **Zod** for server-side schema and request validation.
- **Testing:** **Vitest** for core business logic (grading, normalization, import validation) and **Playwright** for critical browser workflows.
- **Configuration & Hosting:** `.openai/hosting.json` declaring the D1 database binding `DB`.

### Cost & Platform Requirements
- **100% Free Local Development:** All local tooling (Node.js, npm, Miniflare, Wrangler, Drizzle ORM, SQLite emulation, Vitest) is completely free and open-source with zero external dependencies (no paid database instances, no Docker, and no Python backend required).
- **ChatGPT Sites Compatibility:** ChatGPT Sites availability, hosting, and storage are subject to your ChatGPT plan and usage limits. (Reference: [https://learn.chatgpt.com/docs/sites](https://learn.chatgpt.com/docs/sites)).

---

## 2. Project Structure

```text
├── .openai/
│   └── hosting.json                         # OpenAI Sites hosting & D1 binding declaration
├── app/                                     # Vinext / Next.js App Router
│   ├── api/                                 # Workers-compatible TypeScript API routes
│   │   ├── attempts/                        # Attempt state, autosave, check, submit, results, history
│   │   ├── courses/                         # Course CRUD, stats, and Google Drive sync
│   │   └── quizzes/                         # Quiz listing, details, import, start attempt
│   ├── history/                             # Past attempt history review
│   ├── quiz/[quizId]/attempt/[attemptId]/   # Live session (Timed Exam & Self-Paced Practice)
│   ├── chatgpt-auth.ts                      # ChatGPT authentication integration helpers
│   ├── globals.css                          # Dark theme (#212121) styling with Tailwind CSS
│   ├── layout.tsx                           # Root layout with ToastProvider
│   └── page.tsx                             # Searchable & filterable Quiz Library
├── components/                              # UI components
│   ├── CountdownTimer.tsx                   # Timed countdown & practice stopwatch
│   ├── CourseHeader.tsx                     # Course progress and stats header
│   ├── ImportModal.tsx                      # Drag-and-drop JSON upload & overwrite modal
│   ├── Navbar.tsx                           # Global navigation header
│   ├── QuestionPalette.tsx                  # Question status navigation grid
│   ├── QuestionRenderer.tsx                 # Inline blanks with instant feedback & explanations
│   ├── QuizCard.tsx                         # Quiz cards with unit, topics, and actions
│   ├── QuizConfigModal.tsx                  # Dual mode & duration configuration
│   ├── SubmitDialog.tsx                     # Submission confirmation dialog
│   └── Toast.tsx                            # Toast notifications
├── db/                                      # Database configuration & schema
│   ├── env.d.ts                             # Cloudflare Workers environment types
│   ├── index.ts                             # Drizzle D1 database instance getter
│   └── schema.ts                            # Relational schema (courses, quizzes, questions, blanks, attempts)
├── drizzle/                                 # Committed version-controlled SQL migrations
│   ├── 0000_dusty_goblin_queen.sql
│   └── meta/
├── lib/                                     # Shared core logic & utilities
│   ├── api.ts                               # Client-side typed API helper (relative '/api' endpoints)
│   ├── attempt-service.ts                   # Attempt lifecycle, timer sync, and grading engine
│   ├── course-manifest.ts                   # Authoritative manifest of 28 grammar units
│   ├── course-service.ts                    # Course sync and initialization logic
│   ├── db-init.ts                           # Automatic schema initialization helper
│   ├── grading.ts                           # NFKC normalization and blank matching
│   ├── hash.ts                              # Deterministic SHA-256 canonical hashing (Web Crypto)
│   ├── importer.ts                          # Schema 2.0.0 JSON importer with duplicate protection
│   ├── sample-unit-01.ts                    # Bundled Unit 1 sample quiz data for immediate play
│   ├── utils.ts                             # Formatting utilities
│   └── validation.ts                        # Zod schemas for import and requests
├── sample-data/                             # Reference JSON quiz data
│   └── grammar_unit_01_grouped_english_fill_in_the_blank.json
├── tests/                                   # Vitest unit test suite & Playwright e2e
│   ├── e2e/quiz-flow.spec.ts                # Critical browser workflows
│   ├── grading.test.ts                      # Normalization & blank evaluation tests
│   ├── importer.test.ts                     # Zod validation & canonical hash tests
│   └── manifest.test.ts                     # Course unit manifest tests
├── drizzle.config.ts                        # Drizzle Kit configuration
├── next.config.ts                           # Next.js configuration
├── package.json                             # Dependencies, scripts, and engines
├── playwright.config.ts                     # Playwright configuration
├── start-local.bat                          # One-click Windows launcher
├── start-local.ps1                          # Dynamic PowerShell local runner
├── tsconfig.json                            # TypeScript configuration with @/* alias
├── vite.config.ts                           # Vite configuration with sites() & vinext()
└── vitest.config.ts                         # Vitest configuration
```

---

## 3. Quick Start & Local Development (Windows)

### Prerequisites
- **Node.js**: `v22.13.0` or higher (Node 22 or 24 recommended).
- **npm**: Comes with Node.js.
- **Git**

### Installation
Clone the repository and install all dependencies:
```bash
git clone <repository-url>
cd "English grammar quiz"
npm install
```

### Option A: One-Click Windows Launcher (Recommended)
Double-click `start-local.bat` or run in PowerShell:
```powershell
.\start-local.ps1
```
This script:
1. Verifies Node.js and dependencies.
2. Checks D1 schema and database status.
3. Automatically scans for a free port (starting at 3000).
4. Boots the unified full-stack server (`vinext dev`) with persistent Miniflare D1 emulation.
5. Automatically opens your default web browser to the application URL.

### Option B: Manual npm Commands
1. **Generate Database Migrations (if modified):**
   ```bash
   npm run db:generate
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Persistent Local Database:**
   Miniflare automatically persists your local D1 SQLite database in `.wrangler/state/v3/d1`. Local data remains isolated on your machine and is never uploaded to production.

---

## 4. Production Build & Preview

To verify that the application compiles cleanly for production:

1. **Build the Application:**
   ```bash
   npm run build
   ```
   This runs `vinext build`, which compiles:
   - Client and Server Component bundles via Vite.
   - All API routes into Cloudflare Workers route handlers.
   - Preserves the `@openai/sites-vite-plugin` integration, outputting metadata and migrations into `dist/.openai/`.

2. **Preview the Production Server:**
   ```bash
   npm start
   ```

---

## 5. Testing & Verification

### Running Vitest Unit Tests
Validates core business logic including NFKC normalization, whitespace collapsing, punctuation rules, case folding, blank grading, Zod schema validation, and unit manifests:
```bash
npm test
```

### Running TypeScript Type Check
Ensures zero type errors across the entire codebase:
```bash
npx tsc --noEmit
```

### Running Playwright End-to-End Tests
Tests critical browser user journeys:
```bash
npm run test:e2e
```

---

## 6. ChatGPT Sites Deployment

1. **Service Binding Configuration (`.openai/hosting.json`):**
   ```json
   {
     "d1": "DB",
     "r2": null
   }
   ```
2. **Build Integration:**
   The repository preserves the official `sites()` plugin from `@openai/sites-vite-plugin` in `vite.config.ts`.
3. **Database Migration on Deployment:**
   SQL migrations are committed in `drizzle/` and packaged into `dist/.openai/drizzle/` during build. When deployed to ChatGPT Sites, the platform provisions the cloud D1 database and executes the committed migrations.
4. **Deploying:**
   Commit your changes to Git and trigger deployment through the ChatGPT Sites plugin workflow.
