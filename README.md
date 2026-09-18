# LESSON NOTE [BASIC 3] 2026

A lightweight GitHub Pages lesson-note viewer for **Basic 3, 2026**.

## Current flow

1. Select a week.
2. Select a subject.
3. Click **View Lesson**.
4. Read the complete lesson note.

## Google Docs

The platform can display a published Google Doc directly.

Publish the Google Doc using:

**File -> Share -> Publish to web**

Then add the published URL in `lessons.js`:

```javascript
"Week 1": {
  "English Language": {
    type: "google-doc",
    title: "English Language",
    url: "YOUR_PUBLISHED_GOOGLE_DOC_URL"
  }
}
```

A published Google Doc is public to anyone who has access to its published URL.

## GitHub Pages

Repository:

`gODtECH-Ctl-Create/Lesson-Note`

To publish:

1. Open repository **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**.
5. Save.
