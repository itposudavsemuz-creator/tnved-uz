import { useEffect } from "react";

export function DetailModal({ item, onClose }) {
  // Закрытие по Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  const codeFormatted = item.code
    ? item.code.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4").trim()
    : item.code;

  const rows = [
    { label: "Код ТН ВЭД",         value: codeFormatted },
    { label: "Наименование",        value: item.name },
    { label: "Единица измерения",   value: item.unit  || "—" },
    { label: "Ставка пошлины",      value: item.duty  || "—" },
    { label: "Уровень иерархии",    value: item.level },
    { label: "Родительская позиция", value: item.parent_code || "корень" },
  ];

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div style={styles.header}>
          <div>
            <code style={styles.codeTitle}>{codeFormatted}</code>
            <div style={styles.subtitle}>Карточка товарной позиции</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Таблица свойств */}
        <div style={styles.body}>
          {rows.map(({ label, value }) => (
            <div key={label} style={styles.row}>
              <div style={styles.rowLabel}>{label}</div>
              <div style={styles.rowValue}>{value}</div>
            </div>
          ))}
        </div>

        {/* Ссылки */}
        <div style={styles.footer}>
          <a
            href={`https://tarif.customs.uz/ru/directory/tnved?code=${item.code}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Открыть на customs.uz →
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "540px",
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px",
    borderBottom: "1px solid #334155",
    background: "#0f172a",
  },
  codeTitle: {
    display: "block",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#60a5fa",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.1em",
  },
  subtitle: {
    fontSize: "0.8rem",
    color: "#64748b",
    marginTop: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: "1.2rem",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "6px",
  },
  body: {
    padding: "8px 0",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "8px",
    padding: "10px 24px",
    borderBottom: "1px solid #0f172a",
  },
  rowLabel: {
    fontSize: "0.8rem",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontWeight: 600,
    paddingTop: "1px",
  },
  rowValue: {
    fontSize: "0.9rem",
    color: "#e2e8f0",
    lineHeight: 1.5,
  },
  footer: {
    padding: "16px 24px",
    borderTop: "1px solid #334155",
  },
  link: {
    color: "#60a5fa",
    fontSize: "0.875rem",
    textDecoration: "none",
  },
};
