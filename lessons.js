/*
  LESSON NOTE [BASIC 3] 2026

  Supported lesson types:
  1. "html"       -> lesson content stored directly in this file
  2. "google-doc" -> lesson displayed from a published Google Doc

  TO USE A GOOGLE DOC:
  Google Doc -> File -> Share -> Publish to web -> Publish

  Then paste the published URL here.

  Example:
  https://docs.google.com/document/d/e/2PACX-XXXXXXXXXXXX/pub?embedded=true
*/

const LESSONS = {
  "Week 1": {
    "English Language": {
      type: "html",
      title: "English Language",
      content: `
        <article class="local-lesson">
          <h1>English Language</h1>
          <p><strong>Class:</strong> Basic 3</p>
          <p><strong>Academic Year:</strong> 2026</p>

          <h2>Week 1</h2>
          <h3>Topic: Sample Lesson</h3>

          <p>
            This is sample content. Replace it with the actual Basic 3 English
            Language lesson note or connect a published Google Doc.
          </p>
        </article>
      `
    },

    "Mathematics": {
      type: "html",
      title: "Mathematics",
      content: `
        <article class="local-lesson">
          <h1>Mathematics</h1>
          <p><strong>Class:</strong> Basic 3</p>
          <p><strong>Academic Year:</strong> 2026</p>

          <h2>Week 1</h2>
          <h3>Topic: Sample Lesson</h3>

          <p>
            This is sample content. Replace it with the actual Mathematics
            lesson note or connect a published Google Doc.
          </p>
        </article>
      `
    }
  },

  "Week 2": {
    "English Language": {
      type: "html",
      title: "English Language",
      content: `
        <article class="local-lesson">
          <h1>English Language</h1>
          <p><strong>Class:</strong> Basic 3</p>
          <p><strong>Academic Year:</strong> 2026</p>
          <h2>Week 2</h2>
          <p>Sample Week 2 content.</p>
        </article>
      `
    }
  }

  /*
  GOOGLE DOC EXAMPLE:

  ,"Week 3": {
    "English Language": {
      type: "google-doc",
      title: "English Language",
      url: "https://docs.google.com/document/d/e/YOUR_PUBLISHED_DOC_ID/pub?embedded=true"
    }
  }
  */
};