/* engine.js — renders window.DECK into #app.
   Stage machine (Next/Previous), controls, deep links, print & debug modes. */
(function () {
  "use strict";

  var DECK = window.DECK;
  var STAGE_W = 1920, STAGE_H = 1080;

  /* ---------------- flags ---------------- */
  var QS = new URLSearchParams(window.location.search);
  var PRINT = QS.get("print") === "1";
  var NOANSWERS = QS.get("noanswers") === "1";
  var DEBUG = QS.get("debug") === "1";
  var coreMode = QS.get("core") === "1";

  /* ---------------- tiny helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F]/;
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* mini-markup: **bold** *italic* `code` \n — everything else escaped.
     \` renders a literal backtick. */
  function markup(text) {
    if (text == null) return "";
    var src = String(text).replace(/\\`/g, "\uE000");
    var parts = src.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
    var out = parts.map(function (p) {
      if (/^`[^`]+`$/.test(p)) return '<code class="inline">' + esc(p.slice(1, -1)) + "</code>";
      if (/^\*\*[^*]+\*\*$/.test(p)) return "<strong>" + esc(p.slice(2, -2)) + "</strong>";
      if (/^\*[^*\n]+\*$/.test(p)) return "<em>" + esc(p.slice(1, -1)) + "</em>";
      var t = esc(p).replace(/\n/g, "<br>");
      if (HAS_ARABIC.test(p)) t = '<bdi dir="auto">' + t + "</bdi>";
      return t;
    });
    return out.join("").replace(/\uE000/g, "`");
  }
  function linesOf(code) {
    if (Array.isArray(code)) return code;
    if (code == null) return [];
    return String(code).split("\n");
  }
  function isNum(v) { return typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v); }
  function fmtMin(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }
  function store(key, val) {
    try {
      if (val === undefined) {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* private mode / disabled storage — deck still works */ }
    return null;
  }

  /* ---------------- schemas (built-in ShopDB + deck extras) ---------------- */
  var SCHEMAS = {
    shop: {
      title: "ShopDB",
      tables: [
        { name: "customers", cols: [
          { n: "customer_id", mark: "PK" }, { n: "name" }, { n: "email" },
          { n: "city" }, { n: "phone" }, { n: "created_at" }] },
        { name: "products", cols: [
          { n: "product_id", mark: "PK" }, { n: "name" }, { n: "category" },
          { n: "price" }, { n: "stock" }] },
        { name: "orders", cols: [
          { n: "order_id", mark: "PK" }, { n: "customer_id", mark: "FK", to: "customers" },
          { n: "order_date" }, { n: "status" }] },
        { name: "order_items", cols: [
          { n: "order_id", mark: "PK", to: "orders" }, { n: "product_id", mark: "PK", to: "products" },
          { n: "qty" }, { n: "unit_price" }] }
      ]
    }
  };
  if (DECK.schemas) Object.keys(DECK.schemas).forEach(function (k) { SCHEMAS[k] = DECK.schemas[k]; });

  function schemaChip(name) {
    var s = SCHEMAS[name];
    if (!s) return "";
    var rows = s.tables.map(function (t) {
      var cols = t.cols.map(function (c) {
        var mark = "";
        if (c.mark === "PK") mark = ' <span class="pk">PK</span>';
        else if (c.mark === "FK") mark = ' <span class="fk">FK&rarr;' + esc(c.to || "?") + "</span>";
        else if (c.mark === "PK/FK") mark = ' <span class="pk">PK</span><span class="fk"> FK&rarr;' + esc(c.to || "?") + "</span>";
        return esc(c.n) + mark;
      }).join(", ");
      return "<tr><td class='tbl-name'>" + esc(t.name) + "</td><td class='cols'>" + cols + "</td></tr>";
    }).join("");
    return '<div class="schema-chip"><div class="chip-title">' +
      esc(s.title || name) + "</div><table>" + rows + "</table></div>";
  }

  /* ---------------- code & result blocks ---------------- */
  function codeHTML(lines, lang, opts) {
    opts = opts || {};
    var hot = opts.hot;
    var cls = "code" + (lang ? " lang-" + esc(lang) : "") + (hot ? " steps" : "");
    var html = lines.map(function (ln, i) {
      var h = window.Syntax ? window.Syntax.highlight(ln, lang) : esc(ln);
      var hotCls = hot ? (hot.indexOf(i + 1) >= 0 ? " hot" : "") : "";
      return '<span class="cl' + hotCls + '">' + (h || "&nbsp;") + "</span>";
    }).join("");
    var label = opts.langLabel === false ? "" :
      '<span class="code-lang">' + esc(lang || "text") + "</span>";
    return '<pre class="' + cls + '" tabindex="0">' + label + html + "</pre>";
  }

  function resultHTML(res) {
    if (!res) return "";
    var head = res.head || [], rows = res.rows || [];
    var body = rows.length
      ? rows.map(function (r) {
          return "<tr>" + r.map(function (v) {
            if (v == null) return '<td><span class="null-cell">NULL</span></td>';
            var s = String(v);
            return '<td' + (isNum(s) ? ' class="num"' : "") + (HAS_ARABIC.test(s) ? ' dir="auto"' : "") + ">" + esc(s) + "</td>";
          }).join("") + "</tr>";
        }).join("")
      : '<tr><td colspan="' + Math.max(head.length, 1) + '">no rows</td></tr>';
    return '<div class="result-wrap"><div class="result-label">Result</div>' +
      '<table class="result' + (rows.length ? "" : " empty") + '"><thead><tr>' +
      head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function tableHTML(slide) {
    var head = slide.head || [], rows = slide.rows || [];
    return '<table class="grid"><thead><tr>' +
      head.map(function (h) { return "<th>" + markup(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + r.map(function (c) {
          var cls = [];
          var s = String(c == null ? "" : c);
          if (isNum(s)) cls.push("num");
          var dir = HAS_ARABIC.test(s) ? ' dir="auto"' : "";
          return '<td' + (cls.length ? ' class="' + cls.join(" ") + '"' : "") + dir + ">" + markup(s) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table>" +
      (slide.caption ? '<div class="table-caption">' + markup(slide.caption) + "</div>" : "");
  }

  function bulletsHTML(items, revealed) {
    return '<ul class="bullets">' + (items || []).map(function (it, i) {
      var text = typeof it === "string" ? it : it.text;
      var sub = typeof it === "object" && it.sub ? it.sub : null;
      var hidden = revealed != null && i > revealed ? " step-hidden" : " step-shown";
      var subHTML = sub ? '<div class="sub">' + sub.map(function (s) {
        return "<span>" + markup(s) + "</span>";
      }).join("") + "</div>" : "";
      return "<li class=\"" + hidden + "\">" + markup(text) + subHTML + "</li>";
    }).join("") + "</ul>";
  }

  /* ---------------- stage counts ---------------- */
  function stageCount(s) {
    if (s.type === "quiz" || s.type === "challenge") return 2;
    if (s.type === "timeline") return Math.max(1, (s.steps || []).length);
    if (s.type === "compare") return s.revealRows ? Math.max(1, (s.rows || []).length) : 1;
    if (s.stepwise && s.items) return Math.max(1, s.items.length);
    if (s.steps) return Math.max(1, s.steps.length);
    return 1;
  }
  function unionLines(steps, upto) {
    var out = [];
    for (var i = 0; i <= upto && i < steps.length; i++) {
      (steps[i].lines || []).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); });
    }
    return out.sort(function (a, b) { return a - b; });
  }

  /* ---------------- slide renderers ---------------- */
  var KIND_LABEL = {
    "write": "WRITE", "predict": "PREDICT", "spot-the-bug": "SPOT THE BUG",
    "fix": "FIX", "choose": "DECIDE", "order": "PUT IN ORDER", "design": "DESIGN"
  };

  function renderSlide(slide, stage, opts) {
    opts = opts || {};
    var sec = sectionOf(slide);
    var root = el("div", "slide type-" + slide.type +
      (slide.type === "challenge" ? (stage === 0 ? " stage-q" : " stage-a") : ""));
    var kicker = slide.kicker || (sec ? sec.title : "");
    if (slide.type !== "title" && kicker) {
      root.appendChild(el("div", "kicker", esc(kicker) +
        (slide.tier === "extended" ? ' <span class="tier-mark">extended</span>' : "")));
    }
    var body = el("div", "slide-body");
    body.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0;";
    root.appendChild(body);
    fillSlide(body, slide, stage, opts, root);
    return root;
  }

  function fillSlide(body, s, stage, opts, root) {
    switch (s.type) {
      case "title": {
        root.classList.add("title-slide");
        body.appendChild(el("h1", null, markup(s.title)));
        if (s.subtitle) body.appendChild(el("div", "subtitle", markup(s.subtitle)));
        if (s.meta) {
          body.appendChild(el("div", "meta-row",
            s.meta.map(function (m) { return "<span>" + markup(m) + "</span>"; }).join("")));
        }
        break;
      }
      case "section": {
        root.classList.add("section-slide");
        body.appendChild(el("div", "section-rule"));
        body.appendChild(el("h2", null, markup(s.title)));
        if (s.blurb) body.appendChild(el("div", "blurb", markup(s.blurb)));
        break;
      }
      case "bullets":
      case "recap":
      case "homework": {
        if (s.type !== "homework" || s.title) body.appendChild(el("h2", null, markup(s.title)));
        body.innerHTML += bulletsHTML(s.items, s.stepwise ? stage : null);
        if (s.type === "homework" && s.due) body.appendChild(el("div", "due-chip", "Due: " + markup(s.due)));
        break;
      }
      case "code": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        var hot = s.steps ? unionLines(s.steps, stage) : null;
        body.appendChild(el("div", null, codeHTML(linesOf(s.code), s.lang, { hot: hot })));
        var note = s.steps && s.steps[stage] ? s.steps[stage].note : s.caption;
        if (note) body.appendChild(el("div", "caption-chip", markup(note)));
        if (s.result && (!s.steps || stage === stageCount(s) - 1)) {
          body.insertAdjacentHTML("beforeend", resultHTML(s.result));
        }
        break;
      }
      case "split": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        var split = el("div", "split");
        var left = el("div", "left panel");
        if (s.left && s.left.title) left.appendChild(el("h3", null, markup(s.left.title)));
        if (s.left && s.left.bullets) left.innerHTML += bulletsHTML(s.left.bullets, s.stepwise ? stage : null);
        if (s.left && s.left.text) left.appendChild(el("div", "answer-text", markup(s.left.text)));
        if (s.left && s.left.code) left.insertAdjacentHTML("beforeend",
          codeHTML(linesOf(s.left.code), s.left.lang || s.lang));
        var right = el("div", "right");
        if (s.right && s.right.code) {
          right.innerHTML = codeHTML(linesOf(s.right.code), s.right.lang || s.lang);
        } else if (s.right && s.right.svg) {
          right.innerHTML = '<div class="diagram">' + s.right.svg + "</div>";
        } else if (s.right && s.right.html) {
          right.innerHTML = s.right.html;
        }
        split.appendChild(left); split.appendChild(right);
        body.appendChild(split);
        break;
      }
      case "table": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        body.insertAdjacentHTML("beforeend", tableHTML(s));
        break;
      }
      case "compare": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        var cols = s.columns || [];
        var rows = s.rows || [];
        var html = '<table class="compare"><thead><tr><th></th>' +
          cols.map(function (c) {
            return '<th class="' + (c.primary ? "primary" : "") + '">' +
              '<span class="tag ' + esc(c.key === "mssql" ? "mssql" : c.key === "pg" ? "pg" : c.key === "my" ? "my" : c.key) + '">' +
              esc(c.label) + "</span></th>";
          }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r, i) {
          var vis = !s.revealRows || i <= stage;
          html += '<tr class="' + (vis ? "row-shown" : "row-hidden") + '"><th class="rowlabel">' +
            markup(r.label) + "</th>" +
            cols.map(function (c) {
              var cell = (r.cells || {})[c.key];
              return '<td class="' + (c.primary ? "primary " : "") + 'cell-code">' +
                (cell == null ? '<span class="null-cell">—</span>' : markup(cell)) + "</td>";
            }).join("") + "</tr>";
        });
        html += "</tbody></table>";
        if (s.caption) html += '<div class="table-caption">' + markup(s.caption) + "</div>";
        body.insertAdjacentHTML("beforeend", html);
        break;
      }
      case "diagram": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        body.appendChild(el("div", "diagram", s.svg || ""));
        break;
      }
      case "timeline": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        body.insertAdjacentHTML("beforeend", timelineHTML(s, stage));
        break;
      }
      case "demo": {
        if (s.title) body.appendChild(el("h2", null, markup(s.title)));
        body.insertAdjacentHTML("beforeend",
          '<div class="demo-switch">' + iconSvg("terminal") +
          "Switch to: " + esc(s.switchTo || "your client") + "</div>");
        body.insertAdjacentHTML("beforeend",
          '<ul class="checklist">' + (s.steps || []).map(function (t, i) {
            var vis = !s.stepwise || i <= stage;
            return '<li class="' + (vis ? "step-shown" : "step-hidden") + '">' +
              '<span class="box"></span><span>' + markup(t) + "</span></li>";
          }).join("") + "</ul>");
        break;
      }
      case "quiz": {
        body.appendChild(el("div", "quiz-q", markup(s.question)));
        var opts = s.options || [];
        var correct = s.correct;
        var correctIdx = Array.isArray(correct) ? correct : [correct];
        body.insertAdjacentHTML("beforeend",
          '<ul class="quiz-options' + (stage === 1 ? " quiz-answer" : "") + '">' +
          opts.map(function (o, i) {
            var cls = "";
            if (stage === 1) cls = correctIdx.indexOf(i) >= 0 ? "correct" : "wrong";
            return '<li class="' + cls + '"><span class="opt-key">' +
              String.fromCharCode(65 + i) + '</span><span>' + markup(o) + "</span></li>";
          }).join("") + "</ul>");
        if (stage === 1 && s.explain) {
          body.appendChild(el("div", "explain-box", markup(s.explain)));
        }
        break;
      }
      case "challenge": {
        renderChallenge(body, s, stage, opts);
        break;
      }
      case "end": {
        root.classList.add("end-slide");
        body.appendChild(el("h2", null, markup(s.title || "That's it for today")));
        if (s.next) body.appendChild(el("div", "end-next", "Next: " + markup(s.next)));
        break;
      }
      default: {
        body.appendChild(el("h2", null, esc(s.title || s.type)));
      }
    }
  }

  function renderChallenge(body, s, stage, opts) {
    var acc = el("div", "ch-accent");
    body.parentNode.insertBefore(acc, body);
    var q = el("div", "ch-q-wrap");
    var head = el("div", "ch-head");
    if (stage === 0) {
      head.innerHTML = '<span class="ch-badge">YOUR TURN</span>' +
        '<span class="ch-kind">' + esc(KIND_LABEL[s.kind] || "CHALLENGE") + "</span>" +
        '<span class="pulse-dot" aria-hidden="true"></span>';
    } else {
      head.innerHTML = '<span class="ch-badge">ANSWER</span>' +
        '<span class="ch-kind">' + esc(KIND_LABEL[s.kind] || "CHALLENGE") + "</span>";
    }
    q.appendChild(head);
    q.appendChild(el("div", "ch-title", markup(s.title || "")));
    q.appendChild(el("div", "ch-prompt", markup(s.prompt || "")));
    body.appendChild(q);

    if (stage === 0) {
      var ctx = s.context || {};
      var ctxWrap = el("div", "ch-context");
      var hasCtx = false;
      if (ctx.schema) { ctxWrap.insertAdjacentHTML("beforeend", schemaChip(ctx.schema)); hasCtx = true; }
      if (ctx.code) {
        ctxWrap.insertAdjacentHTML("beforeend", codeHTML(linesOf(ctx.code), ctx.lang || "sql"));
        hasCtx = true;
      }
      if (ctx.timeline) {
        ctxWrap.innerHTML = timelineHTML({ lanes: ctx.timeline.lanes, steps: ctx.timeline.steps, title: "" }, ctx.timeline.steps.length - 1);
        hasCtx = true;
      }
      if (hasCtx) body.appendChild(ctxWrap);

      if (s.kind === "choose" && s.options) {
        body.appendChild(el("ul", "quiz-options",
          s.options.map(function (o, i) {
            return '<li><span class="opt-key">' + String.fromCharCode(65 + i) +
              '</span><span>' + markup(o) + "</span></li>";
          }).join("")));
      }
      if (s.kind === "order" && s.items) {
        body.appendChild(el("ul", "quiz-options",
          s.items.map(function (o, i) {
            return '<li><span class="opt-key">' + (i + 1) +
              '</span><span>' + markup(o) + "</span></li>";
          }).join("")));
      }

      var meta = el("div", "ch-meta");
      if (s.thinkMinutes) {
        meta.appendChild(el("span", "think", "≈ " + s.thinkMinutes + " min"));
        var tbtn = el("button", "timer", "Timer: " + s.thinkMinutes + ":00");
        tbtn.setAttribute("aria-label", "Start thinking timer");
        tbtn.dataset.role = "timer";
        meta.appendChild(tbtn);
      }
      if (s.hints && s.hints.length) {
        var hbtn = el("button", "hint-btn", "Hint (H)");
        hbtn.dataset.role = "hint";
        hbtn.setAttribute("aria-label", "Reveal next hint");
        meta.appendChild(hbtn);
      }
      body.appendChild(meta);

      if (s.hints && s.hints.length) {
        var wrap = el("div", "hints");
        wrap.dataset.role = "hints";
        body.appendChild(wrap);
        if (opts.hintCount) revealHints(wrap, s, opts.hintCount);
      }
      return;
    }

    /* ---- stage 1: answer ---- */
    var a = s.answer || {};
    var panel = el("div", "answer-panel");
    var cols = el("div", "answer-cols");
    var left = el("div", "answer-col");
    var right = el("div", "answer-col");

    if (a.code) {
      left.insertAdjacentHTML("beforeend", codeHTML(linesOf(a.code), a.lang || "sql",
        a.highlightLines ? { hot: a.highlightLines } : {}));
    }
    if (a.text) left.appendChild(el("div", "answer-text", markup(a.text)));
    if (a.result) left.insertAdjacentHTML("beforeend", resultHTML(a.result));
    if (a.table) {
      left.insertAdjacentHTML("beforeend",
        '<table class="result"><thead><tr>' +
        a.table.head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        a.table.rows.map(function (r) {
          return "<tr>" + r.map(function (c) {
            return "<td" + (HAS_ARABIC.test(String(c)) ? ' dir="auto"' : "") + ">" + markup(String(c)) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table>");
    }
    if (s.kind === "choose" && s.options) {
      var correct = Array.isArray(a.correct) ? a.correct : [a.correct];
      left.insertAdjacentHTML("beforeend",
        '<ul class="answer-options">' + s.options.map(function (o, i) {
          return '<li class="' + (correct.indexOf(i) >= 0 ? "correct" : "") + '">' +
            '<span class="opt-key">' + String.fromCharCode(65 + i) + "</span>" +
            "<span>" + markup(o) + "</span></li>";
        }).join("") + "</ul>");
      if (a.text) left.appendChild(el("div", "answer-text", markup(a.text)));
    }
    if (s.kind === "order" && a.items) {
      left.insertAdjacentHTML("beforeend",
        '<ol class="order-list">' + a.items.map(function (o) {
          return "<li>" + markup(o) + "</li>";
        }).join("") + "</ol>");
    }

    if (a.explain && a.explain.length) {
      right.insertAdjacentHTML("beforeend",
        '<ul class="explain-list">' + a.explain.map(function (e) {
          return "<li>" + markup(e) + "</li>";
        }).join("") + "</ul>");
    }
    if (a.pitfalls) {
      right.appendChild(el("div", "pitfalls", "<b>Watch out:</b> " + markup(a.pitfalls)));
    }
    if (a.alt && a.alt.length) {
      var tabs = el("div", "alt-tabs");
      tabs.setAttribute("role", "tablist");
      var bodies = el("div", null, "");
      a.alt.forEach(function (alt, i) {
        var b = el("button", null, esc(alt.label || "Alt " + (i + 1)));
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", i === 0 ? "true" : "false");
        b.dataset.role = "alt-tab";
        b.dataset.alt = String(i);
        tabs.appendChild(b);
        var bodyDiv = el("div", "alt-body" + (i === 0 ? " active" : ""));
        bodyDiv.dataset.altBody = String(i);
        bodyDiv.innerHTML = codeHTML(linesOf(alt.code), alt.lang || a.lang || "sql");
        bodies.appendChild(bodyDiv);
      });
      right.appendChild(tabs);
      right.appendChild(bodies);
    }

    cols.appendChild(left); cols.appendChild(right);
    panel.appendChild(cols);
    body.appendChild(panel);
  }

  function timelineHTML(s, stage) {
    var lanes = s.lanes || ["A", "B"];
    var steps = s.steps || [];
    var html = '<div class="timeline"><div class="lane-labels">' +
      lanes.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") +
      "</div>";
    steps.forEach(function (st, i) {
      if (i > stage) return;
      var cells = "";
      for (var lane = 0; lane < lanes.length; lane++) {
        if (st.lane === lane) {
          var code = linesOf(st.code);
          var res = st.result != null
            ? '<div class="tl-result' + (st.result === "?" ? " pending" : "") + '">' +
              esc(String(st.result)) + "</div>"
            : "";
          cells += '<div class="tl-cell"><div class="tl-card">' +
            (st.label ? '<div class="ch-kind">' + esc(st.label) + "</div>" : "") +
            codeHTML(code, st.lang || "sql", { langLabel: false }) + res + "</div>" +
            (st.say ? '<div class="tl-say">' + markup(st.say) + "</div>" : "") + "</div>";
        } else {
          cells += '<div class="tl-cell spacer">·</div>';
        }
      }
      html += '<div class="tl-step">' + cells + "</div>";
    });
    return html + "</div>";
  }

  function iconSvg(name) {
    if (name === "terminal") {
      return '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
        '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/>' +
        '<path d="M7 9.5l3.5 2.5L7 14.5"/><path d="M13 15h4"/></svg>';
    }
    return "";
  }

  /* ---------------- deck state ---------------- */
  var allSlides = DECK.slides || [];
  var visible = allSlides.filter(function (s) { return !coreMode || s.tier !== "extended"; });
  if (!visible.length) visible = allSlides;
  var idx = 0, stage = 0;
  var hintBySlide = {};
  var timerBySlide = {};
  var clock = { t0: null, running: false, sectionId: null, sectionAt: 0 };
  var firstNextDone = false;

  function sectionOf(slide) {
    var id = slide && slide.section;
    var list = DECK.sections || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function cur() { return visible[idx]; }
  function maxStage() { return stageCount(cur()) - 1; }

  /* ---------------- DOM shell ---------------- */
  var app = document.getElementById("app");
  app.innerHTML =
    '<div class="app">' +
      '<div class="stage-wrap"><div class="stage" id="stage"></div></div>' +
      '<header class="topbar">' +
        '<div class="section-label" id="section-label"></div>' +
        '<div class="clock" id="clock" hidden><span class="chip" id="clock-elapsed">0:00</span>' +
        '<span class="delta" id="clock-delta"></span></div>' +
      '</header>' +
      '<footer class="footer">' +
        '<div class="progress"><i id="progress-bar"></i></div>' +
        '<div class="footer-row">' +
          '<span><span class="counter" id="counter"></span>' +
          '<span id="tier-badge"></span>' +
          '<button id="core-toggle" aria-pressed="false" title="Hide extended slides (C)">Core only</button></span>' +
          '<span class="brand">' + esc(DECK.brand || ("DB Lab · Session " + (DECK.number != null ? String(DECK.number).padStart(2, "0") : ""))) + '</span>' +
        '</div>' +
      '</footer>' +
      '<nav class="nav" aria-label="Slide navigation">' +
        '<button id="btn-prev" aria-label="Previous slide">&larr; Prev</button>' +
        '<button id="btn-next" class="next" aria-label="Next slide">Next &rarr;</button>' +
      '</nav>' +
      '<div class="overlay" id="overview" hidden></div>' +
      '<div class="notes-panel" id="notes" hidden></div>' +
      '<div class="help-panel" id="help" hidden></div>' +
      '<div class="blank-screen" id="blank" hidden></div>' +
      '<div class="sr-only" id="live" aria-live="polite"></div>' +
    '</div>';

  var stageEl = document.getElementById("stage");
  var liveEl = document.getElementById("live");

  /* ---------------- rendering ---------------- */
  function render(opts) {
    opts = opts || {};
    var s = cur();
    stage = Math.min(stage, stageCount(s) - 1);
    stageEl.innerHTML = "";
    var rootEl = stageEl.appendChild(renderSlide(s, stage, { hintCount: hintBySlide[idx] || 0 }));
    var fit = fitSlide(rootEl);
    if (DEBUG && fit < 0.85) {
      console.warn("[debug] fit " + fit.toFixed(2) + " on slide " + (idx + 1) +
        " (" + (s.id || s.type) + ") — content is small, consider splitting this slide");
    }
    paintTimer();
    updateChrome();
    if (DEBUG) runDebug();
    if (!opts.silent) {
      liveEl.textContent = "Slide " + (idx + 1) + " of " + visible.length;
      if ((s.type === "challenge" || s.type === "quiz") && stage === 1) {
        liveEl.textContent += ". Answer revealed.";
      }
    }
    savePos();
  }

  function updateChrome() {
    var s = cur();
    var sec = sectionOf(s);
    var label = document.getElementById("section-label");
    if (sec) {
      label.innerHTML = "<b>" + esc(sec.title) + "</b> · " +
        fmtMin(sec.start) + "–" + fmtMin(sec.start + sec.minutes);
    } else label.textContent = "";
    document.getElementById("counter").textContent = (idx + 1) + " / " + visible.length;
    document.getElementById("tier-badge").innerHTML =
      s.tier === "extended" ? '<span class="badge-tier">EXTENDED</span>' : "";
    document.getElementById("progress-bar").style.width =
      Math.round(((idx + 1) / visible.length) * 100) + "%";
    var ct = document.getElementById("core-toggle");
    ct.setAttribute("aria-pressed", coreMode ? "true" : "false");
    ct.textContent = coreMode ? "Core only ✓" : "Core only";
    updateHash();
    updateClock();
  }

  function fitStage() {
    var k = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stageEl.style.transform = "scale(" + k + ")";
  }

  /* fit overflowing slide content into the 1920x1080 stage (returns the factor) */
  function fitSlide(root) {
    var body = root.querySelector(".slide-body");
    if (!body) return 1;
    var cw = body.clientWidth, ch = body.clientHeight;
    var sw = body.scrollWidth, sh = body.scrollHeight;
    if (!cw || !ch || !sw || !sh) return 1; /* no layout (jsdom) */
    var f = Math.min(1, ch / sh, cw / sw);
    if (f > 0.99) return 1; /* <=1% overflow is noise (borders etc.) */
    if (f < 0.5) f = 0.5;
    var dx = (cw * (1 - f)) / 2;
    var dy = (ch * (1 - f)) / 2;
    body.style.transformOrigin = "top left";
    body.style.transform =
      "translate(" + dx + "px, " + dy + "px) scale(" + f + ")";
    if (DEBUG) {
      var b = document.createElement("div");
      b.className = "fit-badge";
      b.textContent = "fit " + Math.round(f * 100) + "%";
      root.appendChild(b);
    }
    return f;
  }

  function runDebug() {
    var over = stageEl.querySelectorAll(".slide *, .slide");
    var count = 0;
    for (var i = 0; i < over.length; i++) {
      var n = over[i];
      if (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) {
        if (n.classList && n.classList.contains("slide")) continue;
        n.classList.add("debug-overflow");
        count++;
        console.warn("[debug] overflow:", (cur().id || cur().type), "stage " + stage,
          n.className || n.tagName, n.scrollWidth + "x" + n.scrollHeight,
          "vs", n.clientWidth + "x" + n.clientHeight);
      }
    }
    if (count) console.warn("[debug] " + count + " overflowing element(s) on slide " + (idx + 1));
    else console.info("[debug] slide " + (idx + 1) + " stage " + stage + " fits.");
  }

  /* ---------------- navigation ---------------- */
  function go(target, st, opts) {
    opts = opts || {};
    target = Math.max(0, Math.min(target, visible.length - 1));
    var changed = target !== idx;
    idx = target;
    var prevStage = stage;
    stage = st == null ? 0 : Math.max(0, Math.min(st, stageCount(cur()) - 1));
    if (!opts.keepHints && changed) { /* hints reset with the slide */ }
    render();
    if (changed && !opts.silent) {
      // nothing extra — announcement handled in render
    }
    if (stage !== prevStage && (cur().type === "challenge" || cur().type === "quiz")) {
      /* announced in render */
    }
  }

  function next() {
    startClockOnFirstNext();
    if (stage < maxStage()) { stage++; render(); return; }
    if (idx < visible.length - 1) { idx++; stage = 0; render(); return; }
    render({ silent: false });
  }
  function prev() {
    if (stage > 0) { stage--; render(); return; }
    if (idx > 0) { idx--; stage = maxStage(); render(); return; }
    render({ silent: false });
  }

  /* ---------------- hash ---------------- */
  var suppressHash = false;
  function updateHash() {
    var h = "#/" + (idx + 1) + (stage ? "/" + stage : "");
    if (window.location.hash !== h) {
      suppressHash = true;
      window.location.replace(
        window.location.pathname + window.location.search + h);
      setTimeout(function () { suppressHash = false; }, 0);
    }
  }
  function readHash() {
    var m = /^#\/(\d+)(?:\/(\d+))?$/.exec(window.location.hash || "");
    if (!m) return false;
    var i = parseInt(m[1], 10) - 1;
    var st = m[2] ? parseInt(m[2], 10) : 0;
    if (i < 0 || i >= visible.length) return false;
    idx = i; stage = Math.max(0, Math.min(st, stageCount(cur()) - 1));
    return true;
  }
  window.addEventListener("hashchange", function () {
    if (suppressHash || PRINT) return;
    if (readHash()) render();
  });

  /* ---------------- persistence ---------------- */
  function savePos() {
    store("dblab.pos." + (DECK.id || "deck"), { i: idx, s: stage });
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    store("dblab.theme", t);
  }
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  }

  /* ---------------- lesson clock ---------------- */
  function startClockOnFirstNext() {
    if (!firstNextDone && DECK.clockOnFirstNext) {
      firstNextDone = true;
      startClock();
    }
    firstNextDone = true;
  }
  function startClock() {
    clock.running = !clock.running;
    if (clock.running && !clock.t0) clock.t0 = Date.now();
    document.getElementById("clock").hidden = false;
    updateClock();
  }
  function updateClock() {
    if (!clock.running) return;
    var elapsedMin = (Date.now() - clock.t0) / 60000;
    var e = document.getElementById("clock-elapsed");
    var d = document.getElementById("clock-delta");
    var totalSec = Math.floor(elapsedMin * 60);
    e.textContent = Math.floor(totalSec / 60) + ":" + String(totalSec % 60).padStart(2, "0");
    var sec = sectionOf(cur());
    if (!sec) { d.textContent = ""; return; }
    if (clock.sectionId !== sec.id) {
      clock.sectionId = sec.id;
      clock.sectionAt = elapsedMin;
    }
    var entryLate = clock.sectionAt - sec.start;                 // entered section late
    var overrun = elapsedMin - (sec.start + sec.minutes);        // still here after planned end
    var offset = Math.max(entryLate, overrun);                   // minutes behind (negative = ahead)
    d.className = "delta " + (Math.abs(offset) <= 1 ? "ok" : offset > 0 ? "late" : "early");
    d.textContent = Math.abs(offset) <= 1 ? "on time"
      : offset > 0 ? "+" + Math.round(offset) + " min behind"
      : "\u2212" + Math.round(-offset) + " min ahead";
  }
  setInterval(function () { if (clock.running) updateClock(); }, 5000);

  /* ---------------- hints & timer (per slide) ---------------- */
  function currentHints() { return (cur().hints || []); }
  function revealNextHint() {
    if (cur().type !== "challenge" || stage !== 0) return;
    var hints = currentHints();
    if (!hints.length) return;
    var n = hintBySlide[idx] || 0;
    if (n >= hints.length) return;
    hintBySlide[idx] = n + 1;
    render({ silent: true });
    liveEl.textContent = "Hint " + hintBySlide[idx] + " of " + hints.length;
  }
  function revealHints(wrap, s, count) {
    var hints = s.hints || [];
    for (var i = 0; i < count && i < hints.length; i++) {
      wrap.appendChild(el("div", "hint",
        '<span class="hint-n">HINT ' + (i + 1) + "/" + hints.length + "</span>" +
        markup(hints[i])));
    }
    var btn = document.querySelector('[data-role="hint"]');
    if (btn && count >= hints.length) btn.textContent = "No more hints";
    else if (btn) btn.textContent = "Hint " + (count + 1) + "/" + hints.length;
  }
  function toggleTimer() {
    var s = cur();
    if (s.type !== "challenge" || stage !== 0 || !s.thinkMinutes) return;
    var t = timerBySlide[idx];
    if (t && t.running) {
      clearInterval(t.iv); t.running = false;
      return;
    }
    if (t && t.left <= 0) { t.left = s.thinkMinutes * 60; }
    if (!t) t = timerBySlide[idx] = { left: s.thinkMinutes * 60, running: false };
    t.running = true;
    paintTimer();
    t.iv = setInterval(function () {
      t.left--;
      if (t.left <= 0) { t.left = 0; t.running = false; clearInterval(t.iv); }
      paintTimer();
    }, 1000);
  }
  function paintTimer() {
    var t = timerBySlide[idx];
    var btn = document.querySelector('[data-role="timer"]');
    if (!t || !btn) return;
    var m = Math.floor(t.left / 60), s = t.left % 60;
    btn.textContent = "Timer: " + m + ":" + String(s).padStart(2, "0");
    btn.classList.toggle("running", t.running && t.left > 0);
    btn.classList.toggle("done", t.left === 0);
    if (t.left === 0) btn.textContent = "Time!";
  }
  function stopTimer() {
    var t = timerBySlide[idx];
    if (t && t.iv) { clearInterval(t.iv); t.running = false; }
  }

  /* ---------------- overlays ---------------- */
  var overviewEl = document.getElementById("overview");
  var notesEl = document.getElementById("notes");
  var helpEl = document.getElementById("help");
  var blankEl = document.getElementById("blank");

  function buildOverview() {
    var html = '<h2>Overview <span class="close-hint">— press O or Esc to close</span></h2>';
    var bySection = [];
    var map = {};
    visible.forEach(function (s, i) {
      var id = s.section || "_";
      if (!map[id]) { map[id] = []; bySection.push({ id: id, items: map[id] }); }
      map[id].push({ s: s, i: i });
    });
    bySection.forEach(function (g) {
      var sec = null;
      (DECK.sections || []).forEach(function (x) { if (x.id === g.id) sec = x; });
      html += '<div class="ov-group"><h3>' + esc(sec ? sec.title : g.id) + "</h3><div class=\"ov-items\">";
      g.items.forEach(function (item) {
        var s = item.s;
        var thumb = renderSlide(s, 0, { hintCount: 0 });
        html += '<button class="ov-thumb' + (item.i === idx ? " current" : "") +
          '" data-jump="' + item.i + '" aria-label="Slide ' + (item.i + 1) + ": " +
          esc(s.title || s.type).replace(/"/g, "") + '">' +
          '<span class="ov-num">' + (item.i + 1) + "</span>" +
          '<span class="stage-mini"></span></button>';
        // attach rendered slide after insertion (see below)
        item.pending = thumb;
      });
      html += "</div></div>";
    });
    overviewEl.innerHTML = html;
    // inject thumbnails
    var buttons = overviewEl.querySelectorAll(".ov-thumb");
    var k = 0;
    bySection.forEach(function (g) {
      g.items.forEach(function (item) {
        if (buttons[k]) buttons[k].querySelector(".stage-mini").appendChild(item.pending);
        k++;
      });
    });
    overviewEl.hidden = false;
    var first = overviewEl.querySelector(".ov-thumb.current") || overviewEl.querySelector(".ov-thumb");
    if (first) first.focus();
  }
  function closeOverviews() {
    overviewEl.hidden = true;
    notesEl.hidden = true;
    helpEl.hidden = true;
    blankEl.hidden = true;
  }
  function toggleOverview() {
    if (!overviewEl.hidden) { closeOverviews(); stageEl.focus(); return; }
    closeOverviews();
    buildOverview();
  }
  function toggleNotes() {
    if (!notesEl.hidden) { notesEl.hidden = true; return; }
    closeOverviews();
    notesEl.innerHTML = "<h2>Presenter notes</h2>" + markup(cur().notes || "(no notes for this slide)");
    notesEl.hidden = false;
  }
  function toggleHelp() {
    if (!helpEl.hidden) { helpEl.hidden = true; return; }
    closeOverviews();
    helpEl.innerHTML = "<h2>Shortcuts</h2><table><tbody>" +
      row("Next", "→ · Space · PageDown · Enter · click Next") +
      row("Previous", "← · PageUp · Backspace · click Prev") +
      row("First / last slide", "Home / End") +
      row("Go to slide", "G") +
      row("Overview", "O or Esc") +
      row("Fullscreen", "F") +
      row("Theme", "T") +
      row("Presenter notes", "N") +
      row("Blank screen", "B or .") +
      row("Hint (on a challenge)", "H") +
      row("Thinking timer", "Shift+T or the Timer button") +
      row("Lesson clock", "S") +
      row("Core-only mode", "C") +
      row("This help", "?") +
      "</tbody></table>";
    helpEl.hidden = false;
    function row(k, v) { return "<tr><td><kbd>" + esc(k) + "</kbd></td><td>" + esc(v) + "</td></tr>"; }
  }
  function toggleBlank() { blankEl.hidden = !blankEl.hidden; }

  overviewEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-jump]");
    if (!b) return;
    closeOverviews();
    go(parseInt(b.dataset.jump, 10), 0);
  });

  /* ---------------- click handlers ---------------- */
  document.getElementById("btn-next").addEventListener("click", next);
  document.getElementById("btn-prev").addEventListener("click", prev);
  document.getElementById("core-toggle").addEventListener("click", function () { toggleCore(); });
  blankEl.addEventListener("click", function () { blankEl.hidden = true; });

  app.addEventListener("click", function (e) {
    var role = e.target.closest("[data-role]");
    if (!role) return;
    if (role.dataset.role === "hint") revealNextHint();
    else if (role.dataset.role === "timer") toggleTimer();
    else if (role.dataset.role === "alt-tab") {
      var idxAlt = role.dataset.alt;
      var panel = role.closest(".answer-panel");
      panel.querySelectorAll("[data-role='alt-tab']").forEach(function (b) {
        b.setAttribute("aria-selected", b.dataset.alt === idxAlt ? "true" : "false");
      });
      panel.querySelectorAll("[data-alt-body]").forEach(function (b) {
        b.classList.toggle("active", b.dataset.altBody === idxAlt);
      });
    }
  });

  /* ---------------- keyboard ---------------- */
  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    var k = e.key;
    /* let a focused button handle its own Enter/Space activation */
    if ((k === "Enter" || k === " ") && e.target && e.target.closest &&
        e.target.closest("button")) return;
    if (k === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); toggleHelp(); return; }
    if (k === "Escape") {
      if (!blankEl.hidden || !overviewEl.hidden || !notesEl.hidden || !helpEl.hidden) {
        e.preventDefault(); closeOverviews();
      }
      return;
    }
    if (!blankEl.hidden && (k === "b" || k === "B" || k === ".")) { e.preventDefault(); toggleBlank(); return; }
    switch (k) {
      case "ArrowRight": case " ": case "PageDown": case "Enter":
        e.preventDefault(); if (PRINT) return; next(); break;
      case "ArrowLeft": case "PageUp": case "Backspace":
        e.preventDefault(); if (PRINT) return; prev(); break;
      case "Home": e.preventDefault(); go(0, 0); break;
      case "End": e.preventDefault(); go(visible.length - 1, stageCount(cur()) - 1); break;
      case "o": case "O": e.preventDefault(); toggleOverview(); break;
      case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
      case "t": case "T":
        e.preventDefault();
        if (e.shiftKey && cur().type === "challenge") toggleTimer(); else toggleTheme();
        break;
      case "n": case "N": e.preventDefault(); toggleNotes(); break;
      case "b": case "B": case ".": e.preventDefault(); toggleBlank(); break;
      case "s": case "S": e.preventDefault(); startClock(); break;
      case "c": case "C": e.preventDefault(); toggleCore(); break;
      case "g": case "G": e.preventDefault(); gotoPrompt(); break;
      case "h": case "H": e.preventDefault(); revealNextHint(); break;
    }
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { /* fullscreen may be blocked (file://, policy) */ }
  }
  function gotoPrompt() {
    var v = window.prompt("Go to slide (1–" + visible.length + "):");
    if (!v) return;
    var n = parseInt(v, 10);
    if (!isNaN(n)) go(n - 1, 0);
  }
  function toggleCore() {
    var anchor = cur();
    var anchorAll = allSlides.indexOf(anchor);
    coreMode = !coreMode;
    visible = allSlides.filter(function (s) { return !coreMode || s.tier !== "extended"; });
    if (!visible.length) visible = allSlides;
    var i = visible.indexOf(anchor);
    if (i < 0) {
      i = 0;
      for (var j = 0; j < anchorAll && j < allSlides.length; j++) {
        if (visible.indexOf(allSlides[j]) >= 0) i++;
      }
      i = Math.min(i, visible.length - 1);
    }
    idx = i;
    stage = Math.min(stage, stageCount(cur()) - 1);
    render();
  }

  /* ---------------- touch ---------------- */
  var touchX = null;
  document.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (touchX == null || PRINT) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) { dx < 0 ? next() : prev(); }
  }, { passive: true });

  /* ---------------- print mode ---------------- */
  function renderPrint() {
    document.body.classList.add("print-mode");
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "visible";
    document.documentElement.dataset.theme = "light";
    app.innerHTML = "";
    var frag = document.createDocumentFragment();
    visible.forEach(function (s) {
      var pg = el("div", "print-page");
      var st = el("div", "stage");
      var stg = (s.type === "challenge" || s.type === "quiz")
        ? (NOANSWERS ? 0 : 1)
        : stageCount(s) - 1;
      st.appendChild(renderSlide(s, stg, { hintCount: 0, print: true }));
      pg.appendChild(st);
      frag.appendChild(pg);
    });
    app.appendChild(frag);
    var pages = app.querySelectorAll(".print-page .slide");
    for (var pi = 0; pi < pages.length; pi++) fitSlide(pages[pi]);
    if (DEBUG) {
      setTimeout(function () {
        document.querySelectorAll(".print-page *").forEach(function (n) {
          if (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) {
            n.classList.add("debug-overflow");
            console.warn("[debug] print overflow:", n.className, n.scrollHeight, ">", n.clientHeight);
          }
        });
      }, 50);
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    var savedTheme = store("dblab.theme");
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";

    if (!window.Syntax) {
      console.warn("syntax.js missing — code blocks render unhighlighted.");
      window.Syntax = { highlight: function (t) { return esc(t); } };
    }

    if (PRINT) { renderPrint(); return; }

    if (!readHash()) {
      var pos = store("dblab.pos." + (DECK.id || "deck"));
      if (pos && typeof pos.i === "number" && pos.i < visible.length) {
        idx = pos.i;
        stage = Math.min(pos.s || 0, stageCount(cur()) - 1);
      }
    }
    fitStage();
    window.addEventListener("resize", fitStage);
    render({ silent: true });
    liveEl.textContent = "Slide " + (idx + 1) + " of " + visible.length;
  }

  boot();
})();
