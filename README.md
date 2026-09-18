# LESSON NOTE [BASIC 3] 2026

A lightweight static lesson-note platform hosted with GitHub Pages.

## Source

The lesson data is extracted from **LESSON NOTE [BASIC 3 ] 2026.docx**.

The importer preserves the lessons that actually exist in the source. If a subject skips a week in the document, the website does not invent content for that missing week.

## Current content

- 12 subjects
- 90 weekly lesson entries
- Week and subject selector
- Full lesson content viewer
- Mobile-friendly interface

### Subjects

- CRK
- Civic Education
- Computer (ICT)
- Mathematics
- English Language
- History
- Security Education
- C.C.A. (Cultural and Creative Arts) / Fine Arts
- Home Economics
- Basic Science
- Social Studies
- Agriculture

## How it works

1. Choose an academic week.
2. The Subject menu automatically shows only subjects that have content for that week.
3. Choose the subject.
4. Click **View Lesson**.
5. The complete lesson note for that subject/week appears on the page.

## GitHub Pages

A Pages deployment workflow is included under:

`.github/workflows/pages.yml`

If Pages has not previously been enabled for this repository, open:

**Repository Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**

After that, pushes to `main` automatically deploy the site.

## Updating the lesson notes

When the source document changes, regenerate `lessons.js` from the new source document so the website reflects the updated lesson notes.
