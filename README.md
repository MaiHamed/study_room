# Studyroom

A local-first study platform. Open `index.html` in a modern browser to use it. Your subjects, questions, exams, review history, flashcards, and settings are saved in that browser's local storage. Use **Settings → Export backup** to save a portable JSON backup.

## Project structure

- `index.html` — app entry point
- `css/styles.css` — CSS entry point; loads modules in the original cascade order
- `css/global/` — base styles and theme rules
- `css/layouts/` — app shell, sidebar, and top bar
- `css/components/` — reusable controls, forms, cards, dialogs, and study UI
- `css/pages/` — dashboard, subject/topic, Smart Import, and exam view styles
- `css/utilities/` — responsive rules and motion
- `js/app.js` — small application entry point and exam timer startup
- `js/core/` — persisted app state and shared helpers
- `js/components/` — layout shell, dialogs, and reusable select controls
- `js/pages/` — page rendering for dashboard, subjects, questions, exams, study tools, statistics, and settings
- `js/features/` — exam workflows, question forms/import parsing, and theme configuration
- `js/services/` — local backup export and restore
- `js/app/` — application rendering, actions, and event wiring
- `.history/` — editor history snapshots

## Included workflows

- Create subjects with topic lists, and manage MCQ and True/False questions.
- Generate a 20-question exam with 10 MCQs and 10 True/False questions, spread across available topics.
- Save attempts and review answers against the question text, options, and correct answer as they were at attempt time.
- Track recurring misses, infer question difficulty from answer history, and mark questions mastered after three consecutive correct answers.
- Study flashcards with Again/Hard/Good/Easy scheduling, or start Smart revision to combine weak questions with Again/Hard cards.
- Review exam history, retry an entire exam or just incorrect answers, inspect statistics, switch themes, and export/restore backups.
- Paste and parse question sets in Smart Import, review warnings and answers, reorder/edit questions, then import all or selected items. The parser is local pattern recognition; it does not use an AI service or guess missing answers.

No build step or external service is required. The scripts in `index.html` are intentionally loaded in dependency order so the app continues to work when opened directly in a browser. The optional typefaces load from Google Fonts when network access is available; system fonts are used otherwise.
