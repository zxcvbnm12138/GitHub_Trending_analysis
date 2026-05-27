import { getReport } from "../../store.js";
import { requireUser } from "../../../utils/user-auth.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractHtmlDocument(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const lower = text.toLowerCase();
  const doctypeIndex = lower.indexOf("<!doctype html");
  const htmlIndex = lower.indexOf("<html");
  const start =
    doctypeIndex >= 0
      ? doctypeIndex
      : htmlIndex >= 0
        ? htmlIndex
        : -1;
  if (start < 0) return null;
  const end = lower.lastIndexOf("</html>");
  return text.slice(start, end >= start ? end + "</html>".length : undefined).trim();
}

function mdToHtml(md) {
  if (!md) return "";
  let html = escapeHtml(md);
  // bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic *text*
  html = html.replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // hyphen list lines
  const lines = html.split("\n");
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    const num = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) {
      if (!inList) {
        out.push('<ul class="hyphen-list">');
        inList = true;
      }
      out.push(`<li><span class="hy">-</span>${m[1]}</li>`);
    } else if (num) {
      if (!inList) {
        out.push('<ul class="hyphen-list">');
        inList = true;
      }
      out.push(`<li><span class="hy">-</span>${num[1]}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (line.trim() === "") {
        out.push("<br/>");
      } else if (!/^<h[1-3]>/.test(line)) {
        out.push(`<p>${line}</p>`);
      } else {
        out.push(line);
      }
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

export async function GET(request, { params }) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const id = parseInt(params.id, 10);
  if (!id) return new Response("Invalid id", { status: 400 });

  const row = await getReport(guard.user.id, id);
  if (!row) return new Response("Not found", { status: 404 });

  const data = row.raw_data || {};
  const htmlPpt = extractHtmlDocument(
    typeof data.html_ppt === "string" && data.html_ppt.trim()
      ? data.html_ppt
      : null,
  );
  const dateStr = new Date(row.created_at).toISOString().slice(0, 10);

  if (htmlPpt) {
    return new Response(htmlPpt, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="github-trending-${dateStr}.html"`,
      },
    });
  }

  const slides =
    Array.isArray(data.slides) && data.slides.length > 0
      ? data.slides
      : [
          {
            title: "Report",
            content_markdown: row.summary || "No content available.",
        },
      ];

  const langLabel = row.language_filter || "All languages";

  const slidesHtml = slides
    .map(
      (s, i) => `
      <section class="slide${i === 0 ? " active" : ""}" data-index="${i}">
        <div class="slide-inner">
          <div class="slide-meta">${escapeHtml(langLabel)} · ${escapeHtml(dateStr)}</div>
          <h1 class="slide-title">${escapeHtml(s.title || `Slide ${i + 1}`)}</h1>
          <div class="slide-body">${mdToHtml(s.content_markdown || "")}</div>
        </div>
        <div class="slide-footer">
          <span class="counter">${i + 1} / ${slides.length}</span>
        </div>
      </section>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GitHub Trending Report — ${escapeHtml(dateStr)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:'Inter',-apple-system,sans-serif;background:#F9FAFB;color:#111827;-webkit-font-smoothing:antialiased}
  .stage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px}
  .deck{width:100%;max-width:1100px}
  .slide{display:none;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;aspect-ratio:16/9;padding:64px;position:relative;flex-direction:column;justify-content:space-between}
  .slide.active{display:flex}
  .slide-meta{font-size:12px;font-weight:500;color:#6B7280;letter-spacing:0.02em;text-transform:uppercase}
  .slide-title{font-size:40px;font-weight:600;letter-spacing:-0.02em;margin:16px 0 24px;color:#111827;line-height:1.15}
  .slide-body{font-size:18px;line-height:1.6;color:#374151;flex:1;overflow:auto}
  .slide-body p{margin:8px 0}
  .slide-body h1,.slide-body h2,.slide-body h3{color:#111827;font-weight:600;margin:16px 0 8px}
  .slide-body strong{color:#111827;font-weight:600}
  .hyphen-list{list-style:none;padding:0;margin:8px 0}
  .hyphen-list li{padding:4px 0;color:#374151;font-size:16px;display:flex;gap:8px}
  .hyphen-list .hy{color:#9CA3AF}
  .slide-footer{display:flex;justify-content:space-between;align-items:center;margin-top:24px;border-top:1px solid #E5E7EB;padding-top:16px}
  .counter{font-size:12px;font-weight:500;color:#6B7280}
  .controls{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:999px;padding:6px 8px}
  .ctrl{border:1px solid #E5E7EB;background:#FFFFFF;color:#111827;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}
  .ctrl:hover{background:#F9FAFB}
  .ctrl.primary{background:#2563EB;color:#FFFFFF;border-color:#2563EB}
  .ctrl.primary:hover{background:#1D4ED8}
  .progress{position:fixed;top:0;left:0;right:0;height:2px;background:#E5E7EB}
  .progress-bar{height:100%;background:#2563EB;width:0%;transition:width 200ms ease}
  .count{font-size:13px;font-weight:500;color:#6B7280;padding:0 8px}
  @media (max-width:720px){.slide{padding:32px;aspect-ratio:auto;min-height:80vh}.slide-title{font-size:28px}}
</style>
</head>
<body>
<div class="progress"><div class="progress-bar" id="pbar"></div></div>
<div class="stage"><div class="deck" id="deck">${slidesHtml}</div></div>
<div class="controls">
  <button class="ctrl" id="prev">← Prev</button>
  <span class="count" id="count">1 / ${slides.length}</span>
  <button class="ctrl primary" id="next">Next →</button>
  <button class="ctrl" id="fs">Fullscreen</button>
</div>
<script>
  (function(){
    var slides = document.querySelectorAll('.slide');
    var idx = 0;
    var pbar = document.getElementById('pbar');
    var count = document.getElementById('count');
    function show(i){
      idx = Math.max(0, Math.min(slides.length-1, i));
      slides.forEach(function(s,k){ s.classList.toggle('active', k===idx); });
      count.textContent = (idx+1)+' / '+slides.length;
      pbar.style.width = ((idx+1)/slides.length*100)+'%';
    }
    document.getElementById('prev').addEventListener('click', function(){ show(idx-1); });
    document.getElementById('next').addEventListener('click', function(){ show(idx+1); });
    document.getElementById('fs').addEventListener('click', function(){
      if(!document.fullscreenElement){ document.documentElement.requestFullscreen(); }
      else { document.exitFullscreen(); }
    });
    document.addEventListener('keydown', function(e){
      if(e.key==='ArrowRight' || e.key===' ') show(idx+1);
      else if(e.key==='ArrowLeft') show(idx-1);
      else if(e.key==='Home') show(0);
      else if(e.key==='End') show(slides.length-1);
    });
    show(0);
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="github-trending-${dateStr}.html"`,
    },
  });
}
