// Lightweight markdown-ish renderer for slide content.
// Supports: **bold**, # headings, hyphen/numbered lists, paragraphs.

function renderInline(text) {
  // Escape HTML
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // bold
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return safe;
}

export default function MarkdownLite({ content = "", className = "" }) {
  if (!content) return null;
  const lines = String(content).split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(
        <ul key={`l-${blocks.length}`} className="my-2 space-y-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm text-gray-600 py-1 flex gap-2">
              <span className="text-gray-400">-</span>
              <span dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const numMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      return;
    }
    if (numMatch) {
      listBuffer.push(numMatch[1]);
      return;
    }
    flushList();
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-3">
          <span
            dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }}
          />
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={i} className="text-lg font-semibold text-gray-900 mt-3">
          <span
            dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }}
          />
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={i} className="text-xl font-semibold text-gray-900 mt-3">
          <span
            dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }}
          />
        </h1>,
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={i} className="h-2" />);
    } else {
      blocks.push(
        <p
          key={i}
          className="text-sm text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />,
      );
    }
  });
  flushList();

  return <div className={className}>{blocks}</div>;
}
