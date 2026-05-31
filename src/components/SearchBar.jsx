import { useRef, useEffect } from "react";

export function SearchBar({ value, onChange, disabled, total }) {
  const inputRef = useRef(null);

  // Автофокус при готовности
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  // Горячая клавиша "/" — фокус на поиск
  useEffect(() => {
    function onKey(e) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        onChange("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange]);

  return (
    <div style={styles.wrapper}>
      {/* Иконка лупы */}
      <svg style={styles.icon} viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <circle cx="9" cy="9" r="6" strokeWidth="1.8"/>
        <path d="M14 14l3.5 3.5" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={
          disabled
            ? "Загрузка базы данных…"
            : `Поиск по коду или наименованию (${total.toLocaleString("ru")} записей)`
        }
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        style={styles.input}
      />

      {value && (
        <button
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          style={styles.clear}
          aria-label="Очистить"
        >
          ×
        </button>
      )}

      {/* Подсказка "/" */}
      {!value && !disabled && (
        <kbd style={styles.kbd}>/</kbd>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  icon: {
    position: "absolute",
    left: "14px",
    width: "18px",
    height: "18px",
    color: "#64748b",
    pointerEvents: "none",
    flexShrink: 0,
  },
  input: {
    width: "100%",
    padding: "14px 44px 14px 44px",
    fontSize: "1rem",
    lineHeight: 1.5,
    background: "#1e293b",
    border: "1.5px solid #334155",
    borderRadius: "12px",
    color: "#e2e8f0",
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  },
  clear: {
    position: "absolute",
    right: value => value ? "44px" : "12px",
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: "1.25rem",
    cursor: "pointer",
    padding: "4px 8px",
    lineHeight: 1,
  },
  kbd: {
    position: "absolute",
    right: "12px",
    background: "#1e3a5f",
    border: "1px solid #2d5a9e",
    borderRadius: "4px",
    padding: "2px 7px",
    fontSize: "0.75rem",
    color: "#60a5fa",
    fontFamily: "inherit",
    pointerEvents: "none",
  },
};
