/**
 * Live Lesson Note API
 *
 * Source document: LESSON NOTE [BASIC 3 ] 2026
 * Each Google Docs tab is treated as a subject.
 * Each paragraph beginning with "WEEK <number>" is treated as a lesson boundary.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * The GitHub Pages frontend calls this API using read-only JSONP.
 */

const CONFIG = {
  DOCUMENT_ID: "1wTZBj9h_ymnx1TZIIxA2nSOgbAU3MP50Btox2QsW_20",
  CACHE_SECONDS: 30
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "manifest").toLowerCase();

  try {
    let payload;

    if (action === "version") {
      payload = getVersion_();
    } else if (action === "manifest") {
      payload = getManifest_();
    } else if (action === "lesson") {
      const subject = String(e.parameter.subject || "").trim();
      const week = String(e.parameter.week || "").trim();

      if (!subject || !week) {
        throw new Error("subject and week are required");
      }

      payload = getLesson_(subject, week);
    } else if (action === "health") {
      payload = {
        ok: true,
        documentId: CONFIG.DOCUMENT_ID,
        message: "Lesson Note API is running."
      };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return output_(e, payload);
  } catch (error) {
    return output_(e, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function getVersion_() {
  // Intentionally tiny and uncached. The frontend calls this only occasionally,
  // and it lets us detect document changes without parsing the Google Doc.
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);

  return {
    ok: true,
    source: "google-doc",
    documentId: CONFIG.DOCUMENT_ID,
    title: file.getName(),
    modifiedAt: file.getLastUpdated().toISOString()
  };
}

function getManifest_() {
  const cache = CacheService.getScriptCache();
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);
  const modifiedAt = file.getLastUpdated().toISOString();
  const cacheKey = "manifest-v4:" + modifiedAt;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = DocumentApp.openById(CONFIG.DOCUMENT_ID);
  const tabs = getAllTabs_(doc);

  const subjects = tabs.map(function(tab) {
    const title = tab.getTitle().trim();
    const body = tab.asDocumentTab().getBody();
    const weeks = [];

    for (let i = 0; i < body.getNumChildren(); i++) {
      const child = body.getChild(i);
      const heading = parseWeekHeading_(elementText_(child));

      if (heading) {
        weeks.push({
          week: "Week " + heading.number,
          number: heading.number,
          dates: heading.dates,
          topic: heading.topic
        });
      }
    }

    return {
      subject: title,
      tabId: tab.getId(),
      weeks: weeks
    };
  }).filter(function(subject) {
    return subject.weeks.length > 0;
  });

  const payload = {
    ok: true,
    title: doc.getName(),
    source: "google-doc",
    modifiedAt: modifiedAt,
    subjects: subjects
  };

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;
}

function getLesson_(subjectName, weekLabel) {
  const weekNumber = numberFromWeek_(weekLabel);
  if (!weekNumber) throw new Error("Invalid week: " + weekLabel);

  const cache = CacheService.getScriptCache();
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);
  const modifiedAt = file.getLastUpdated().toISOString();
  const cacheKey = "lesson-v4:" + modifiedAt + ":" + subjectName.toLowerCase() + ":" + weekNumber;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = DocumentApp.openById(CONFIG.DOCUMENT_ID);
  const tabs = getAllTabs_(doc);
  const tab = tabs.find(function(item) {
    return item.getTitle().trim().toLowerCase() === subjectName.trim().toLowerCase();
  });

  if (!tab) throw new Error("Subject not found: " + subjectName);

  const body = tab.asDocumentTab().getBody();
  let startIndex = -1;
  let endIndex = body.getNumChildren();
  let headingInfo = null;

  for (let i = 0; i < body.getNumChildren(); i++) {
    const info = parseWeekHeading_(elementText_(body.getChild(i)));
    if (!info) continue;

    if (startIndex === -1 && info.number === weekNumber) {
      startIndex = i + 1;
      headingInfo = info;
      continue;
    }

    if (startIndex !== -1) {
      endIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    throw new Error("Week " + weekNumber + " was not found in " + subjectName);
  }

  const renderedHtml = renderBodyRange_(body, startIndex, endIndex);

  const payload = {
    ok: true,
    subject: tab.getTitle().trim(),
    week: "Week " + weekNumber,
    dates: headingInfo ? headingInfo.dates : "",
    topic: headingInfo ? headingInfo.topic : "",
    html: renderedHtml,
    modifiedAt: modifiedAt
  };

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;
}

function getAllTabs_(doc) {
  const result = [];

  function walk(tab) {
    result.push(tab);
    tab.getChildTabs().forEach(walk);
  }

  doc.getTabs().forEach(walk);
  return result;
}

function parseWeekHeading_(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = text.match(/^WEEK\s+(\d+)\s*(?:\(([^)]*)\))?\s*(?::\s*(.*))?$/i);

  if (!match) return null;

  return {
    number: Number(match[1]),
    dates: (match[2] || "").trim(),
    topic: (match[3] || "").trim()
  };
}

function numberFromWeek_(week) {
  const match = String(week || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function elementText_(element) {
  if (!element) return "";

  const type = element.getType();

  if (type === DocumentApp.ElementType.PARAGRAPH) {
    return element.asParagraph().getText();
  }

  if (type === DocumentApp.ElementType.LIST_ITEM) {
    return element.asListItem().getText();
  }

  try {
    return element.getText ? element.getText() : "";
  } catch (error) {
    return "";
  }
}

function renderBodyRange_(body, startIndex, endIndex) {
  const parts = [];
  let openListTag = null;

  function closeList() {
    if (openListTag) {
      parts.push("</" + openListTag + ">");
      openListTag = null;
    }
  }

  for (let i = startIndex; i < endIndex; i++) {
    const child = body.getChild(i);

    if (child.getType() === DocumentApp.ElementType.LIST_ITEM) {
      const item = child.asListItem();
      const tag = listTagForItem_(item);

      if (openListTag !== tag) {
        closeList();
        parts.push('<' + tag + ' class="doc-list">');
        openListTag = tag;
      }

      const level = item.getNestingLevel ? item.getNestingLevel() : 0;
      parts.push(
        '<li data-level="' + level + '" style="margin-left:' + (level * 1.25) + 'rem">' +
        renderInlineChildren_(item) +
        "</li>"
      );
      continue;
    }

    closeList();

    const html = renderElement_(child);
    if (html) parts.push(html);
  }

  closeList();
  return parts.join("\n");
}

function listTagForItem_(item) {
  const glyph = item.getGlyphType();
  const ordered = [
    DocumentApp.GlyphType.NUMBER,
    DocumentApp.GlyphType.LATIN_UPPER,
    DocumentApp.GlyphType.LATIN_LOWER,
    DocumentApp.GlyphType.ROMAN_UPPER,
    DocumentApp.GlyphType.ROMAN_LOWER
  ].indexOf(glyph) !== -1;

  return ordered ? "ol" : "ul";
}

function renderElement_(element) {
  const type = element.getType();

  if (type === DocumentApp.ElementType.PARAGRAPH) {
    return renderParagraph_(element.asParagraph());
  }

  if (type === DocumentApp.ElementType.LIST_ITEM) {
    return renderListItem_(element.asListItem());
  }

  if (type === DocumentApp.ElementType.TABLE) {
    return renderTable_(element.asTable());
  }

  if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
    return "<hr>";
  }

  if (type === DocumentApp.ElementType.PAGE_BREAK) {
    return '<div class="doc-page-break"></div>';
  }

  return "";
}

function renderParagraph_(paragraph) {
  const content = renderInlineChildren_(paragraph);
  if (!stripHtml_(content).trim() && content.indexOf("<img") === -1) return "";

  const heading = paragraph.getHeading();

  if (heading === DocumentApp.ParagraphHeading.HEADING1) {
    return "<h2>" + content + "</h2>";
  }
  if (heading === DocumentApp.ParagraphHeading.HEADING2) {
    return "<h3>" + content + "</h3>";
  }
  if (heading === DocumentApp.ParagraphHeading.HEADING3) {
    return '<h4 class="doc-section">' + content + "</h4>";
  }
  if (heading === DocumentApp.ParagraphHeading.HEADING4 ||
      heading === DocumentApp.ParagraphHeading.HEADING5 ||
      heading === DocumentApp.ParagraphHeading.HEADING6) {
    return '<h5 class="doc-subheading">' + content + "</h5>";
  }

  return "<p>" + content + "</p>";
}

function renderListItem_(item) {
  const content = renderInlineChildren_(item);
  if (!stripHtml_(content).trim() && content.indexOf("<img") === -1) return "";

  const tag = listTagForItem_(item);
  const level = item.getNestingLevel ? item.getNestingLevel() : 0;

  return '<' + tag + ' class="doc-list"><li data-level="' + level +
    '" style="margin-left:' + (level * 1.25) + 'rem">' +
    content + "</li></" + tag + ">";
}

function renderInlineChildren_(container) {
  const parts = [];

  for (let i = 0; i < container.getNumChildren(); i++) {
    const child = container.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.TEXT) {
      parts.push(renderText_(child.asText()));
    } else if (type === DocumentApp.ElementType.INLINE_IMAGE) {
      parts.push(renderImage_(child.asInlineImage()));
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      parts.push("<hr>");
    } else if (type === DocumentApp.ElementType.PAGE_BREAK) {
      parts.push('<span class="doc-page-break"></span>');
    }
  }

  return parts.join("");
}

function renderText_(textElement) {
  const text = textElement.getText();
  if (!text) return "";

  const indices = textElement.getTextAttributeIndices();
  if (!indices.length) return escapeHtml_(text);

  const parts = [];

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    if (end <= start) continue;

    const attrs = textElement.getAttributes(start);
    let segment = escapeHtml_(text.substring(start, end));

    const styles = [];
    const color = attrs[DocumentApp.Attribute.FOREGROUND_COLOR];
    const background = attrs[DocumentApp.Attribute.BACKGROUND_COLOR];
    const fontSize = attrs[DocumentApp.Attribute.FONT_SIZE];

    if (color) styles.push("color:" + color);
    if (background) styles.push("background-color:" + background);
    if (fontSize) styles.push("font-size:" + fontSize + "pt");

    if (styles.length) {
      segment = '<span style="' + styles.join(";") + '">' + segment + "</span>";
    }

    if (attrs[DocumentApp.Attribute.UNDERLINE]) segment = "<u>" + segment + "</u>";
    if (attrs[DocumentApp.Attribute.ITALIC]) segment = "<em>" + segment + "</em>";
    if (attrs[DocumentApp.Attribute.BOLD]) segment = "<strong>" + segment + "</strong>";

    const link = textElement.getLinkUrl(start);
    if (link && /^https?:\/\//i.test(link)) {
      segment = '<a href="' + escapeAttr_(link) + '" target="_blank" rel="noopener">' +
        segment + "</a>";
    }

    parts.push(segment);
  }

  return parts.join("");
}

function renderImage_(image) {
  try {
    const blob = image.getBlob();
    const mime = blob.getContentType() || "image/png";
    const base64 = Utilities.base64Encode(blob.getBytes());
    return '<img class="doc-image" alt="" src="data:' + mime + ';base64,' + base64 + '">';
  } catch (error) {
    return "";
  }
}

function renderTable_(table) {
  const rows = [];

  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    const cells = [];

    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      const inner = [];

      for (let i = 0; i < cell.getNumChildren(); i++) {
        const html = renderElement_(cell.getChild(i));
        if (html) inner.push(html);
      }

      cells.push("<td>" + inner.join("") + "</td>");
    }

    rows.push("<tr>" + cells.join("") + "</tr>");
  }

  return '<div class="doc-table-wrap"><table class="doc-table"><tbody>' +
    rows.join("") +
    "</tbody></table></div>";
}

function output_(e, payload) {
  const prefix = String(
    (e && e.parameter && (e.parameter.prefix || e.parameter.callback)) || ""
  ).trim();

  if (prefix) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(prefix)) {
      return ContentService
        .createTextOutput('throw new Error("Invalid callback");')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(prefix + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr_(value) {
  return escapeHtml_(value).replace(/'/g, "&#39;");
}

function stripHtml_(value) {
  return String(value || "").replace(/<[^>]*>/g, "");
}
