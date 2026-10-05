/**
 * Live Lesson Note API
 *
 * One Google Doc is used per academic term.
 * Class tabs (for example "Basic 3") contain child subject tabs.
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
      const className = String(e.parameter.class || e.parameter.className || "").trim();

      if (!className) {
        throw new Error("class is required");
      }

      payload = getManifest_(className);
    } else if (action === "curriculum") {
      const className = String(e.parameter.class || e.parameter.className || "").trim();

      if (!className) {
        throw new Error("class is required");
      }

      payload = getCurriculum_(className);
    } else if (action === "lesson") {
      const className = String(e.parameter.class || e.parameter.className || "").trim();
      const subject = String(e.parameter.subject || "").trim();
      const week = String(e.parameter.week || "").trim();

      if (!className || !subject || !week) {
        throw new Error("class, subject and week are required");
      }

      payload = getLesson_(className, subject, week);
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

function getManifest_(className) {
  const cache = CacheService.getScriptCache();
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);
  const modifiedAt = file.getLastUpdated().toISOString();
  const classKey = normalizeName_(className);
  const cacheKey = "manifest-v6:" + modifiedAt + ":" + classKey;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = DocumentApp.openById(CONFIG.DOCUMENT_ID);
  const subjectTabs = getClassSubjectTabs_(doc, className);

  let subjects;

  if (subjectTabs.length) {
    subjects = subjectTabs.map(function(entry) {
      const body = entry.tab.asDocumentTab().getBody();
      const weeks = findWeeksInBody_(body);

      return {
        subject: entry.subject,
        tabId: entry.tab.getId(),
        weeks: weeks
      };
    }).filter(function(subject) {
      return subject.weeks.length > 0;
    });
  } else {
    // The current First Term master document is a flat Google Doc rather than
    // a parent class tab with child subject tabs. Read the Basic 3 First Term
    // sections directly from the document body.
    subjects = getFlatClassSubjectSections_(doc, className).map(function(entry) {
      return {
        subject: entry.subject,
        tabId: "",
        weeks: findWeeksInBodyRange_(entry.body, entry.startIndex, entry.endIndex)
      };
    }).filter(function(subject) {
      return subject.weeks.length > 0;
    });
  }

  const payload = {
    ok: true,
    title: doc.getName(),
    source: "google-doc",
    className: className,
    curriculumTabId: (findTabByTitle_(doc.getTabs(), className) || { getId: function() { return ""; } }).getId(),
    modifiedAt: modifiedAt,
    subjects: subjects
  };

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;
}

function getCurriculum_(className) {
  const cache = CacheService.getScriptCache();
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);
  const modifiedAt = file.getLastUpdated().toISOString();
  const cacheKey = "curriculum-v1:" + modifiedAt + ":" + normalizeName_(className);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = DocumentApp.openById(CONFIG.DOCUMENT_ID);
  const classTab = findTabByTitle_(doc.getTabs(), className);

  if (classTab) {
    const body = classTab.asDocumentTab().getBody();
    const payload = {
      ok: true,
      title: doc.getName(),
      source: "google-doc",
      className: classTab.getTitle().trim(),
      tabId: classTab.getId(),
      modifiedAt: modifiedAt,
      html: renderBodyRange_(body, 0, body.getNumChildren())
    };

    cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
    return payload;
  }

  const body = getPrimaryDocumentBody_(doc);
  const wantedTitle = normalizeName_(className + " First Term Curriculum");
  let curriculumStart = -1;
  let curriculumEnd = body.getNumChildren();

  for (let i = 0; i < body.getNumChildren(); i++) {
    const text = String(elementText_(body.getChild(i)) || "").replace(/\s+/g, " ").trim();
    if (normalizeName_(text) === wantedTitle) {
      curriculumStart = i + 1;
      continue;
    }

    if (curriculumStart !== -1 && /\bFirst Term Curriculum\b/i.test(text)) {
      curriculumEnd = i;
      break;
    }
  }

  if (curriculumStart === -1) {
    throw new Error("Class curriculum not found: " + className);
  }

  const payload = {
    ok: true,
    title: doc.getName(),
    source: "google-doc",
    className: className,
    tabId: "",
    modifiedAt: modifiedAt,
    html: renderBodyRange_(body, curriculumStart, curriculumEnd)
  };

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;
}

function getLesson_(className, subjectName, weekLabel) {
  const weekNumber = numberFromWeek_(weekLabel);
  if (!weekNumber) throw new Error("Invalid week: " + weekLabel);

  const cache = CacheService.getScriptCache();
  const file = DriveApp.getFileById(CONFIG.DOCUMENT_ID);
  const modifiedAt = file.getLastUpdated().toISOString();
  const cacheKey = [
    "lesson-v6",
    modifiedAt,
    normalizeName_(className),
    normalizeName_(subjectName),
    weekNumber
  ].join(":");
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = DocumentApp.openById(CONFIG.DOCUMENT_ID);
  const subjectTabs = getClassSubjectTabs_(doc, className);
  const tabEntry = subjectTabs.find(function(item) {
    return normalizeName_(item.subject) === normalizeName_(subjectName);
  });

  let body;
  let sectionStartIndex = 0;
  let sectionEndIndex;
  let subjectLabel = subjectName;

  if (tabEntry) {
    body = tabEntry.tab.asDocumentTab().getBody();
    sectionEndIndex = body.getNumChildren();
    subjectLabel = tabEntry.subject;
  } else {
    const flatSections = getFlatClassSubjectSections_(doc, className);
    const flatEntry = flatSections.find(function(item) {
      return normalizeName_(item.subject) === normalizeName_(subjectName);
    });

    if (!flatEntry) {
      throw new Error("Subject not found for " + className + ": " + subjectName);
    }

    body = flatEntry.body;
    sectionStartIndex = flatEntry.startIndex;
    sectionEndIndex = flatEntry.endIndex;
    subjectLabel = flatEntry.subject;
  }

  let startIndex = -1;
  let endIndex = sectionEndIndex;
  let headingInfo = null;

  for (let i = sectionStartIndex; i < sectionEndIndex; i++) {
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
    throw new Error(
      "Week " + weekNumber + " was not found in " + className + " / " + subjectName
    );
  }

  const payload = {
    ok: true,
    className: className,
    subject: subjectLabel,
    week: "Week " + weekNumber,
    dates: headingInfo ? headingInfo.dates : "",
    topic: headingInfo ? headingInfo.topic : "",
    html: renderBodyRange_(body, startIndex, endIndex),
    modifiedAt: modifiedAt
  };

  cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
  return payload;
}

function getClassSubjectTabs_(doc, className) {
  const classTab = findTabByTitle_(doc.getTabs(), className);

  if (classTab) {
    // The class tab itself is the curriculum/overview page.
    // Only its DIRECT child tabs are lesson subjects.
    return classTab.getChildTabs().map(function(tab) {
      return {
        tab: tab,
        subject: tab.getTitle().trim()
      };
    }).filter(function(entry) {
      return findWeeksInBody_(entry.tab.asDocumentTab().getBody()).length > 0;
    });
  }

  // Compatibility for flat tabs such as "Basic 3 - Mathematics".
  const prefixed = [];
  getAllTabs_(doc).forEach(function(tab) {
    const subject = subjectFromPrefixedTab_(tab.getTitle(), className);
    if (!subject) return;

    const weeks = findWeeksInBody_(tab.asDocumentTab().getBody());
    if (!weeks.length) return;

    prefixed.push({ tab: tab, subject: subject });
  });

  return prefixed;
}

function getPrimaryDocumentBody_(doc) {
  const tabs = doc.getTabs ? doc.getTabs() : [];
  if (tabs && tabs.length) {
    return tabs[0].asDocumentTab().getBody();
  }

  return doc.getBody();
}

function getFlatClassSubjectSections_(doc, className) {
  const body = getPrimaryDocumentBody_(doc);
  const rows = [];

  for (let i = 0; i < body.getNumChildren(); i++) {
    rows.push({
      index: i,
      text: String(elementText_(body.getChild(i)) || "").replace(/\s+/g, " ").trim()
    });
  }

  const wantedClass = normalizeName_(className);
  const wantedTerm = normalizeName_("First Term");
  const sections = [];

  // Format A: explicit metadata used by the original First Term master document.
  const markers = [];

  for (let i = 0; i < rows.length - 1; i++) {
    const classMatch = rows[i].text.match(/^Class:\s*(.+)$/i);
    const termMatch = rows[i + 1].text.match(/^Term:\s*(.+)$/i);

    if (!classMatch || !termMatch) continue;

    let subjectIndex = i - 1;
    while (subjectIndex >= 0 && !rows[subjectIndex].text) subjectIndex--;

    if (subjectIndex < 0) continue;

    let firstWeekIndex = -1;
    for (let j = i + 2; j < rows.length; j++) {
      if (parseWeekHeading_(rows[j].text)) {
        firstWeekIndex = j;
        break;
      }

      if (rows[j].text.match(/^Class:\s*/i)) break;
    }

    markers.push({
      pos: i,
      className: classMatch[1].trim().replace(/\s*\([^)]*\)\s*$/, ""),
      term: termMatch[1].trim(),
      subject: rows[subjectIndex].text,
      subjectIndex: subjectIndex,
      startIndex: firstWeekIndex
    });
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];

    if (
      normalizeName_(marker.className) !== wantedClass ||
      normalizeName_(marker.term) !== wantedTerm ||
      marker.startIndex === -1
    ) {
      continue;
    }

    const nextMarker = markers[i + 1];
    let endIndex = nextMarker ? nextMarker.subjectIndex : rows.length;

    const nextCurriculum = findNextCurriculumBoundary_(rows, marker.pos);
    endIndex = Math.min(endIndex, nextCurriculum);

    sections.push({
      body: body,
      subject: marker.subject,
      startIndex: marker.startIndex,
      endIndex: endIndex
    });
  }

  // Format B: a class document/section headed like:
  // BASIC 1 • FIRST TERM • WEEKS 1–10 • 2026
  // followed by numbered subjects such as:
  // 1. English Language
  // Week 1 • September 14–18, 2026
  if (!sections.length) {
    const classHeaders = [];

    for (let i = 0; i < rows.length; i++) {
      const text = rows[i].text;
      if (!text || !/\bFIRST\s+TERM\b/i.test(text)) continue;

      const classMatch = text.match(/\b(NURSERY\s+\d+|BASIC\s+\d+)\b/i);
      if (!classMatch) continue;

      classHeaders.push({
        index: i,
        className: classMatch[1].trim(),
        term: "First Term"
      });
    }

    let matchingHeader = classHeaders.find(function(header) {
      return normalizeName_(header.className) === wantedClass &&
        normalizeName_(header.term) === wantedTerm;
    });

    // A standalone Basic 1 document may use its class name in the title
    // rather than a repeated class header inside the body.
    if (!matchingHeader && normalizeName_(doc.getName()).indexOf(wantedClass) !== -1) {
      matchingHeader = {
        index: -1,
        className: className,
        term: "First Term"
      };
    }

    if (matchingHeader) {
      const startBoundary = matchingHeader.index >= 0 ? matchingHeader.index + 1 : 0;
      const headerPosition = classHeaders.findIndex(function(header) {
        return header.index === matchingHeader.index;
      });
      let nextClassHeader = rows.length;
      if (headerPosition >= 0) {
        for (let h = headerPosition + 1; h < classHeaders.length; h++) {
          // The source document repeats the same class header on page breaks.
          // Only a different class header marks the end of this class section.
          if (normalizeName_(classHeaders[h].className) !== wantedClass) {
            nextClassHeader = classHeaders[h].index;
            break;
          }
        }
      }
      const endBoundary = matchingHeader.index >= 0 ? nextClassHeader : rows.length;

      const subjectMarkers = [];

      for (let i = startBoundary; i < endBoundary; i++) {
        const subjectMatch = rows[i].text.match(/^\d+\.\s+(.+)$/);
        if (!subjectMatch) continue;

        let nextNonEmpty = i + 1;
        while (nextNonEmpty < endBoundary && !rows[nextNonEmpty].text) nextNonEmpty++;

        if (nextNonEmpty >= endBoundary || !parseWeekHeading_(rows[nextNonEmpty].text)) continue;

        subjectMarkers.push({
          subject: subjectMatch[1].trim(),
          subjectIndex: i,
          startIndex: nextNonEmpty
        });
      }

      for (let i = 0; i < subjectMarkers.length; i++) {
        const marker = subjectMarkers[i];
        const nextSubject = subjectMarkers[i + 1];
        const endIndex = nextSubject ? nextSubject.subjectIndex : endBoundary;

        sections.push({
          body: body,
          subject: marker.subject,
          startIndex: marker.startIndex,
          endIndex: endIndex
        });
      }
    }
  }

  // The older First Term master document has CRK before its first explicit
  // Class/Term metadata block. Preserve that compatibility path.
  if (normalizeName_(className) === normalizeName_("Basic 3") &&
      wantedTerm === normalizeName_("First Term")) {
    const firstMatch = markers.find(function(marker) {
      return normalizeName_(marker.className) === wantedClass &&
        normalizeName_(marker.term) === wantedTerm;
    });

    if (firstMatch && !sections.some(function(entry) {
      return normalizeName_(entry.subject) === normalizeName_("CRK");
    })) {
      let crkIndex = -1;
      for (let i = 0; i < firstMatch.subjectIndex; i++) {
        if (normalizeName_(rows[i].text) === "crk") {
          crkIndex = i;
        }
      }

      if (crkIndex !== -1) {
        let startIndex = -1;
        for (let i = crkIndex + 1; i < firstMatch.subjectIndex; i++) {
          if (parseWeekHeading_(rows[i].text)) {
            startIndex = i;
            break;
          }
        }

        if (startIndex !== -1) {
          sections.unshift({
            body: body,
            subject: "CRK",
            startIndex: startIndex,
            endIndex: firstMatch.subjectIndex
          });
        }
      }
    }
  }

  return sections;
}

function findNextCurriculumBoundary_(rows, startIndex) {
  for (let i = startIndex + 1; i < rows.length; i++) {
    if (/\bFirst Term Curriculum\b/i.test(rows[i].text)) {
      return i;
    }
  }

  return rows.length;
}

function findWeeksInBodyRange_(body, startIndex, endIndex) {
  const weeks = [];

  for (let i = startIndex; i < endIndex; i++) {
    const heading = parseWeekHeading_(elementText_(body.getChild(i)));

    if (heading) {
      weeks.push({
        week: "Week " + heading.number,
        number: heading.number,
        dates: heading.dates,
        topic: heading.topic
      });
    }
  }

  return weeks;
}

function findTabByTitle_(tabs, title) {
  const wanted = normalizeName_(title);

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];

    if (normalizeName_(tab.getTitle()) === wanted) {
      return tab;
    }

    const nested = findTabByTitle_(tab.getChildTabs(), title);
    if (nested) return nested;
  }

  return null;
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

function findWeeksInBody_(body) {
  const weeks = [];

  for (let i = 0; i < body.getNumChildren(); i++) {
    const heading = parseWeekHeading_(elementText_(body.getChild(i)));

    if (heading) {
      weeks.push({
        week: "Week " + heading.number,
        number: heading.number,
        dates: heading.dates,
        topic: heading.topic
      });
    }
  }

  return weeks;
}

function normalizeName_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectFromPrefixedTab_(tabTitle, className) {
  const title = String(tabTitle || "").trim();
  const classText = String(className || "").trim();

  if (!title || !classText) return "";

  const escaped = classText.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = title.match(new RegExp("^" + escaped + "\\s*[-:|/]\\s*(.+)$", "i"));
  return match ? match[1].trim() : "";
}

function parseWeekHeading_(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = text.match(/^WEEK\s+(\d+)\b(.*)$/i);

  if (!match) return null;

  const number = Number(match[1]);
  let remainder = String(match[2] || "").trim();
  let dates = "";
  let topic = "";

  if (remainder) {
    const parenthesized = remainder.match(/^\(([^)]*)\)\s*(?::\s*(.*))?$/);
    if (parenthesized) {
      dates = parenthesized[1].trim();
      topic = (parenthesized[2] || "").trim();
    } else {
      const separated = remainder.match(/^[•·|]\s*(.*)$/);
      if (separated) {
        dates = separated[1].trim();
      } else {
        const colon = remainder.match(/^:\s*(.*)$/);
        if (colon) {
          topic = colon[1].trim();
        }
      }
    }
  }

  return {
    number: number,
    dates: dates,
    topic: topic
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
