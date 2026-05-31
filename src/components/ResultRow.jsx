import { memo } from "react";

const LEVEL_COLORS = {
  2:  { bg: "#1e3a5f", text: "#93c5fd", border: "#2d5a9e" },
  4:  { bg: "#1a3a2f", text: "#6ee7b7", border: "#1a5c44" },
  6:  { bg: "#2d2410", text: "#fcd34d", border: "#6b4c0c" },
  8:  { bg: "#1f1635", text: "#c4b5fd", border: "#4c1d95" },
  10: { bg: "#1f1635", text: "#d8b4fe", border: "#5b21b6" },
};

function getLevelInfo(code) {
  const len = code.length;
  const labels = {
    2: "Раздел",
    4: "Товарная позиция",
    6: "Субпозиция",
    8: "Подсубпозиция",
    10: "Код ТН ВЭД",
  };
  const closest = [2, 4, 6, 8, 10].find((l) => len <= l) || 10;
  return {
    label:  labels[closest] || "Код",
    colors: LEVEL_COLORS[closest] || LEVEL_COLORS[10],
  };
}

function highlight(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    new RegExp(escaped, "i").test(part)
      ? <mark key={i} style={styles.mark}>{part}</mark>
      : part
  );
}

export const ResultRow = memo(function ResultRow({ item, query, onClick }) {
  const { label, colors } = getLevelInfo(item.code);

  return (
    <div
      style={styles.row}
      onClick={() => onClick?.(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(item)}
    >
      <div style={styles.left}>
        <div
          style={{
            ...styles.codeBadge,
            background: colors.bg,
            color: colors.text,
            borderColor: colors.border,
          }}
        >
          {item.code}
        </div>
        <div style={{ ...styles.levelBadge, color: colors.text }}>
          {label}
        </div>
      </div>

      <div style={styles.name}>
        {highlight(item.name, query)}
      </div>

      <div style={styles.meta}>
        {item.unit && (
          <span style={styles.metaTag}>{item.unit}</span>
        )}
        {item.duty && (
          <span style={{ ...styles.metaTag, ...styles.dutyTag }}>
            {item.duty}
          </span>
        )}
      </div>
    </div>
  );
});

const styles = {
  row: {
    display: "grid",
    gridTemplateColumns: "160px 1fr auto",
    alignItems: "start",
    gap: "12px",
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b",
    cursor: "pointer",
    transition: "background 0.1s",
    userSelect: "none",
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
  },
  codeBadge: {
    display: "inline-block",
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: 700,
    fontSize: "0.95rem",
    letterSpacing: "0.05em",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  levelBadge: {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 600,
    opacity: 0.7,
  },
  name: {
    fontSize: "0.9rem",
    color: "#cbd5e1",
    lineHeight: 1.5,
    paddingTop: "2px",
  },
  mark: {
    background: "rgba(250, 204, 21, 0.25)",
    color: "#fde68a",
    borderRadius: "2px",
    padding: "0 2px",
  },
  meta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-end",
    paddingTop: "2px",
  },
  metaTag: {
    fontSize: "0.75rem",
    background: "#1e293b",
    color: "#94a3b8",
    borderRadius: "4px",
    padding: "2px 6px",
    whiteSpace: "nowrap",
    border: "1px solid #334155",
  },
  dutyTag: {
    background: "#1a2e1a",
    color: "#86efac",
    borderColor: "#166534",
  },
};
