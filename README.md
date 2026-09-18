# Lesson Note Platform

A lightweight, generic lesson-note platform built for GitHub Pages.

## Current version

This version does **not** depend on a specific class, school, year, or subject.

Users can save:

- Class / level
- Week
- Subject
- Optional lesson title
- Google Docs link

The saved records are stored in the browser with `localStorage`.

## How it works

1. Open **Manage Lessons**.
2. Enter the class, week, subject, and Google Docs link.
3. Click **Save Lesson**.
4. Open **Browse Lessons**.
5. Choose the class, week, and subject.
6. Click **View Lesson**.
7. The Google Doc is displayed inside the page.

## Google Docs sharing

The document must be accessible to the people who will view it.

For this lightweight version, a common option is:

**Share -> General access -> Anyone with the link -> Viewer**

Normal Google Docs links and published Google Docs links are supported.

## localStorage limitation

The saved lesson list belongs to the current browser/device.

For example, a lesson saved on one teacher's laptop does not automatically appear on another teacher's phone.

A future version can replace localStorage with Supabase or another shared backend without changing the GitHub Pages frontend concept.

## GitHub Pages

The included Pages workflow is located at:

`.github/workflows/pages.yml`

If needed, enable it from:

**Repository Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**
