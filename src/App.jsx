import { useState, useEffect, useCallback, useRef } from "react";
import { useSearch } from "./hooks/useSearch";
import { SearchBar } from "./components/SearchBar";
import { ResultRow } from "./components/ResultRow";
import { DetailModal } from "./components/DetailModal";

const RESULTS_PER_PAGE = 50;

export default function App() {
  const { status, progress, results, total, meta, search, updateAvailable, applyUpdate } = useSearch();

  const [query,         setQuery]         = useState("");
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [visibleCount,  setVisibleCount]  = useState(RESULTS_PER_PAGE);
  const loaderRef = useRef(null);

  // Убираем splash-экран когда данные готовы
  useEffect(() => {
    if (status === "ready" || status === "error") {
      const el = document.getElementById("splash");
      if (el) {
        el.classList.add("hidden");
        setTimeout(() => el.remove(), 400);
      }
    }
  }, [status]);

  // Поиск при изменении запроса
  useEffect(() => {
    setVisibleCount(RESULTS_PER_PAGE);
    search(query, RESULTS_PER_PAGE * 4); // берём с запасом для пагинации
  }, [query, search]);

  // Бесконечная прокрутка через IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < results.length) {
          setVisibleCount((v) => v + RESULTS_PER_PAGE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, results.length]);

  // Hover-эффект для строк (через CSS-переменную)
  const handleRowEnter = useCallback((e) => {
    e.currentTarget.style.background = "#1a2744";
  }, []);
  const handleRowLeave = useCallback((e) => {
    e.currentTarget.style.background = "";
  }, []);

  const visibleResults = results.slice(0, visibleCount);

  return (
    <div style={styles.app}>
      {/* Баннер обновления */}
      {updateAvailable && (
        <div style={styles.updateBanner}>
          <span>Доступна новая версия базы данных</span>
          <button onClick={applyUpdate} style={styles.updateBtn}>
            Обновить сейчас
          </button>
        </div>
      )}

      {/* Шапка */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoMain}>ТН ВЭД</span>
            <span style={styles.logoSub}>Республика Узбекистан</span>
          </div>
          {meta && (
            <div style={styles.metaInfo}>
              <span style={styles.metaBadge}>
                {meta.record_count?.toLocaleString("ru")} позиций
              </span>
              <span style={styles.metaDate}>
                {new Date(meta.updated_at).toLocaleDateString("ru", {
                  day:   "numeric",
                  month: "short",
                  year:  "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Строка поиска */}
        <div style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChange={setQuery}
            disabled={status !== "ready"}
            total={total}
          />
        </div>

        {/* Статус */}
        {status === "loading" && (
          <div style={styles.statusBar}>
            <div style={styles.spinner} />
            <span>{progress}</span>
          </div>
        )}
        {status === "error" && (
          <div style={{ ...styles.statusBar, color: "#f87171" }}>
            ⚠ Ошибка загрузки: {progress}
          </div>
        )}
      </header>

      {/* Контент */}
      <main style={styles.main}>
        {status === "ready" && (
          <>
            {/* Счётчик результатов */}
            {query && (
              <div style={styles.resultCount}>
                Найдено: <strong>{results.length.toLocaleString("ru")}</strong>
                {results.length >= 200 && (
                  <span style={{ color: "#64748b" }}>
                    {" "}(показаны первые {visibleCount})
                  </span>
                )}
              </div>
            )}

            {/* Список результатов */}
            {visibleResults.length > 0 ? (
              <div style={styles.resultList}>
                {visibleResults.map((item) => (
                  <div
                    key={item.code}
                    onMouseEnter={handleRowEnter}
                    onMouseLeave={handleRowLeave}
                  >
                    <ResultRow
                      item={item}
                      query={query}
                      onClick={setSelectedItem}
                    />
                  </div>
                ))}
                {/* Сентинел для IntersectionObserver */}
                {visibleCount < results.length && (
                  <div ref={loaderRef} style={styles.loader}>
                    Загрузка ещё…
                  </div>
                )}
              </div>
            ) : (
              query && (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>🔍</div>
                  <div>Ничего не найдено по запросу «{query}»</div>
                  <div style={styles.emptyHint}>
                    Попробуйте ввести начало кода (например, «8471») или часть наименования
                  </div>
                </div>
              )
            )}

            {/* Подсказки при пустом поиске */}
            {!query && (
              <div style={styles.hints}>
                <div style={styles.hintsTitle}>Примеры запросов</div>
                <div style={styles.hintChips}>
                  {[
                    "8471",
                    "хлопок",
                    "автомобили",
                    "0101",
                    "нефть",
                    "телефон",
                    "кофе",
                    "84",
                  ].map((hint) => (
                    <button
                      key={hint}
                      style={styles.hintChip}
                      onClick={() => setQuery(hint)}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Подвал */}
      <footer style={styles.footer}>
        <span>Данные: </span>
        <a
          href="https://tarif.customs.uz"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          tarif.customs.uz
        </a>
        <span style={styles.footerSep}>·</span>
        <span>Нажмите на строку для детальной информации</span>
        <span style={styles.footerSep}>·</span>
        <kbd style={styles.footerKbd}>/</kbd> для поиска
      </footer>

      {/* Модальное окно */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ── Стили ──────────────────────────────────────────────────────────────────

const styles = {
  app: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "#0f172a",
    color: "#e2e8f0",
  },
  updateBanner: {
    background: "#1d4ed8",
    color: "#fff",
    padding: "10px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    fontSize: "0.875rem",
  },
  updateBtn: {
    background: "#fff",
    color: "#1d4ed8",
    border: "none",
    borderRadius: "6px",
    padding: "6px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  header: {
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    padding: "20px 24px 0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  logo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  logoMain: {
    fontSize: "1.75rem",
    fontWeight: 800,
    color: "#3b82f6",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  logoSub: {
    fontSize: "0.75rem",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metaInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
  },
  metaBadge: {
    background: "#1e3a5f",
    color: "#93c5fd",
    border: "1px solid #2d5a9e",
    borderRadius: "6px",
    padding: "3px 10px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  metaDate: {
    fontSize: "0.75rem",
    color: "#64748b",
  },
  searchWrap: {
    marginBottom: "12px",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 0 12px",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #1e3a5f",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  main: {
    flex: 1,
    maxWidth: "1024px",
    width: "100%",
    margin: "0 auto",
    padding: "0 0 80px",
  },
  resultCount: {
    padding: "12px 20px",
    fontSize: "0.85rem",
    color: "#94a3b8",
    borderBottom: "1px solid #1e293b",
  },
  resultList: {
    borderRadius: "0",
  },
  loader: {
    padding: "20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "0.85rem",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "60px 20px",
    color: "#64748b",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "2.5rem",
  },
  emptyHint: {
    fontSize: "0.85rem",
    color: "#475569",
  },
  hints: {
    padding: "32px 20px",
  },
  hintsTitle: {
    fontSize: "0.8rem",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
  },
  hintChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  hintChip: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "7px 16px",
    color: "#94a3b8",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.1s",
    fontFamily: "inherit",
  },
  footer: {
    borderTop: "1px solid #1e293b",
    padding: "12px 20px",
    fontSize: "0.8rem",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
  },
  footerLink: {
    color: "#60a5fa",
    textDecoration: "none",
  },
  footerSep: {
    color: "#334155",
  },
  footerKbd: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "3px",
    padding: "1px 5px",
    fontSize: "0.7rem",
  },
};
