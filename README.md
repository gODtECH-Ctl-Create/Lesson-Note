# LESSON NOTE [BASIC 3] 2026

A lightweight GitHub Pages lesson-note viewer with a **live Google Docs source** and a bundled static fallback.

## Live architecture

```text
Master Google Doc
  -> Google Apps Script Web App
  -> GitHub Pages
  -> Week -> Subject -> View Lesson
```

The master Google Doc already has an ideal structure for this:

- each Google Docs **tab is a subject**
- each lesson begins with a **WEEK <number>** heading
- native Google Docs bold, italic, underline, headings, lists, tables and inline images are rendered by the live API

## One-time setup

The live bridge code is already in:

`apps-script/Code.gs`

Setup instructions are in:

`apps-script/README.md`

After deploying the Apps Script Web App, paste its `/exec` URL into:

`config.js`

Example:

```js
window.LESSON_API_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";
```

Until that URL is configured, the site continues to use the current imported `lessons.js` snapshot.

## Adding new lessons after setup

### Existing subject

Open the subject's Google Docs tab and add a new heading such as:

```text
WEEK 11 (November 23 – 27, 2026): Revision
```

Use the same **Heading 2** style as the existing WEEK headings, then write the lesson content underneath it.

### New subject

Create a new Google Docs tab, use the subject name as the tab title, and add WEEK headings inside it.

The GitHub Pages site reads the updated structure automatically. The Apps Script uses a 30-second cache, so recent changes may take up to about 30 seconds to appear after refresh.

## Static fallback

The existing imported lesson snapshot is intentionally retained. If the live Apps Script endpoint is unavailable, the site falls back to the static lesson data instead of becoming unusable.

## GitHub Pages

The deployment workflow remains at:

`.github/workflows/pages.yml`

If Pages is not already enabled:

**Repository Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**
