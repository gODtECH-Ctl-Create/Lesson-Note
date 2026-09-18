# Google Apps Script live bridge

This folder contains the one-time Google Apps Script backend used by the GitHub Pages lesson-note viewer.

## Why it works well with this document

The master Google Doc already uses:
- one Google Docs **tab per subject**
- **WEEK 1, WEEK 2, ...** headings inside each subject tab
- native Docs formatting for bold, italics, headings, lists and tables

The script reads those tabs and week headings dynamically.

## One-time setup

1. Open the master Google Doc: **LESSON NOTE [BASIC 3 ] 2026**.
2. Choose **Extensions -> Apps Script**.
3. Replace the contents of `Code.gs` with the code from this repository's `apps-script/Code.gs`.
4. Click **Deploy -> New deployment**.
5. Select **Web app**.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone**.
8. Click **Deploy** and authorize the script.
9. Copy the Web App URL ending in `/exec`.
10. Put that URL in `config.js` as `window.LESSON_API_URL`.

## Adding new lesson content

For an existing subject:
- open that subject's tab in the Google Doc
- add a new heading such as:
  `WEEK 11 (November 23 – 27, 2026): Revision`
- use the same **Heading 2** style used by the existing WEEK headings
- add the lesson content underneath it

For a new subject:
- create a new Google Docs tab
- name the tab with the subject name
- add WEEK headings and lesson content inside it

The site refreshes its week/subject list from the Google Doc. The script uses a short 30-second cache, so edits normally appear within about half a minute after the next reload.

## Privacy

The web app is read-only, but if it is deployed to **Anyone**, lesson content returned by the script is effectively public to anyone who knows the endpoint. Do not use this deployment mode for private/sensitive lesson material.
