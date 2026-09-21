# Google Apps Script live bridge

LessonHub uses **one Google Doc per academic term**.

## Required Google Docs tab structure

Each class is a parent tab. The class parent tab can contain the curriculum/overview for that class. Its direct child tabs are the lesson subjects.

Example:

```text
First Term Google Doc
├── Nursery 1
│   ├── English
│   ├── Mathematics
│   └── CRK
├── Nursery 2
│   ├── English
│   └── Mathematics
├── Basic 1
│   └── ...
├── Basic 2
│   └── ...
├── Basic 3
│   ├── CRK
│   ├── English
│   └── Mathematics
├── Basic 4
│   └── ...
└── Basic 5
    └── ...
```

The **class parent tab itself is not treated as a subject**. It is reserved for the main curriculum/overview.

Inside each subject child tab, lessons are separated by WEEK headings such as:

```text
WEEK 1 (September 8 – 12, 2026): Topic title
```

The API receives the selected class from LessonHub:

```text
?action=manifest&class=Basic%203
```

The class parent tab is exposed as the **Main Curriculum** page:

```text
?action=curriculum&class=Basic%203
```

The curriculum endpoint renders the entire parent class tab, including tables, headings, lists and inline formatting. Direct child tabs remain the lesson subjects.

Individual lessons are requested with:

```text
?action=lesson&class=Basic%203&subject=CRK&week=Week%202
```

This prevents one class from seeing another class's lesson notes.

## Deployment

For each term document:

1. Open the Google Doc.
2. Choose **Extensions -> Apps Script**.
3. Replace `Code.gs` with the latest `apps-script/Code.gs` from this repository.
4. Confirm `CONFIG.DOCUMENT_ID` is the ID of that term's Google Doc.
5. Choose **Deploy -> Manage deployments**.
6. Edit the existing Web App deployment.
7. Select **New version**.
8. Keep **Execute as: Me**.
9. Keep **Who has access: Anyone**.
10. Deploy.

Updating the existing deployment keeps the same `/exec` URL.

## Version checks

LessonHub uses the lightweight endpoint:

```text
?action=version
```

to check whether the term document has changed without parsing all lessons.

## Offline use

LessonHub caches lessons by:

```text
term + class + week + subject
```

so cached lessons for Basic 3 cannot appear under Basic 1, Basic 4, or another class.

## Privacy

The web app is read-only, but when deployed to **Anyone**, lesson content returned by the endpoint is effectively accessible to anyone who knows the endpoint. Do not place sensitive/private material in these lesson documents.
