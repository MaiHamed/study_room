# Studyroom

Studyroom is a local-first study app built with plain HTML, CSS, and JavaScript. It has no server, API, authentication provider, package manager, or database. Study data, profile details, and theme preferences are stored in the current browser's local storage. Use **Settings → Export backup** to create a portable backup.

## Architecture

```text
frontend/
├── public/
│   └── index.html           Static application entry point
└── src/
    ├── css/                 Global tokens, layouts, components, pages, utilities
    └── js/
        ├── app/             Rendering, action dispatch, and event bindings
        ├── components/      Shared layout, dialogs, and controls
        ├── core/             Browser state and shared helpers
        ├── features/         Questions, exams, study, themes, and import workflows
        ├── pages/            Page-specific rendering
        └── services/         Local backup import/export

.history/                    Editor snapshots; not loaded by the app
README.md
```

The files are loaded in dependency order from `frontend/public/index.html` as classic scripts. This keeps the project dependency-free and supports opening the entry point directly in a browser. The script files share the app's runtime scope; keep their load order intact when adding modules.

## Run the app

Open `frontend/public/index.html` in a modern browser. No install or build step is required. Optional typefaces and Lucide/MathJax assets load from CDNs when a network connection is available.

## Data and configuration

- The browser stores the app data under `studyroom.v1` in local storage.
- Backups are created and restored from **Settings**.
- There are no backend or database credentials, environment variables, migrations, API endpoints, or authentication flows in this project.
- A backend/database layer should be added only alongside a concrete server and persistence requirement; the current app does not simulate one.

## Verification

Check JavaScript syntax with Node.js:

```sh
find frontend/src/js -type f -name '*.js' -exec node --check {} \;
```

There is no configured automated test or build runner. Browser-based workflow checks should be run from `frontend/public/index.html` after changes to page behavior.

## Existing workflows

- Create subjects with topic lists, and manage MCQ and True/False questions.
- Generate exams, take them, mark questions for review, and inspect submitted results.
- Track recurring misses and study flashcards with spaced review.
- Use Smart Import to parse question text locally and inspect uncertain fields before import.
- Customize themes and light/dark appearance; preferences persist in local storage.
