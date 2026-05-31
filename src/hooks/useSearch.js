/**
 * useSearch — загружает ТН ВЭД данные и предоставляет быстрый поиск
 *
 * Алгоритм:
 * 1. Проверяем meta.json — версию базы
 * 2. Если версия в localStorage совпадает — используем кэшированный индекс
 * 3. Иначе — скачиваем tnved.json и строим MiniSearch-индекс
 * 4. Сохраняем индекс в localStorage (сжатый JSON)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import MiniSearch from "minisearch";

const META_URL  = "./data/meta.json";
const DATA_URL  = "./data/tnved.json";
const LS_KEY    = "tnved_index_v2";
const LS_META   = "tnved_meta_v2";

// MiniSearch настройки
const MINISEARCH_OPTIONS = {
  fields:         ["code", "name"],      // поля для поиска
  storeFields:    ["code", "name", "unit", "duty", "level", "parent_code"],
  idField:        "code",
  searchOptions: {
    boost:        { code: 2 },           // совпадение по коду важнее
    fuzzy:        0.2,                   // нечёткий поиск (20% допуск)
    prefix:       true,                  // поиск по началу слова
    combineWith:  "AND",
  },
};

export function useSearch() {
  const [status,   setStatus]   = useState("idle");     // idle | loading | ready | error
  const [progress, setProgress] = useState("");
  const [results,  setResults]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [meta,     setMeta]     = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const msRef   = useRef(null);    // MiniSearch instance
  const allData = useRef([]);      // все записи (для отображения без поиска)

  // ── Загрузка и инициализация ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      setProgress("Проверка версии базы…");

      try {
        // 1. Получаем meta.json
        const metaResp = await fetch(META_URL + "?t=" + Date.now());
        const metaData = metaResp.ok ? await metaResp.json() : null;

        if (!cancelled) setMeta(metaData);

        const cachedMeta    = localStorage.getItem(LS_META);
        const cachedVersion = cachedMeta ? JSON.parse(cachedMeta).version : null;
        const freshVersion  = metaData?.version;

        // 2. Пробуем загрузить из localStorage
        if (freshVersion && cachedVersion === freshVersion) {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            setProgress("Загрузка из кэша…");
            try {
              const { index, records } = JSON.parse(raw);
              const ms = new MiniSearch(MINISEARCH_OPTIONS);
              MiniSearch.loadJSON(JSON.stringify(index), MINISEARCH_OPTIONS);
              // loadJSON возвращает новый инстанс
              const ms2 = MiniSearch.loadJSON(JSON.stringify(index), MINISEARCH_OPTIONS);
              if (!cancelled) {
                msRef.current   = ms2;
                allData.current = records;
                setTotal(records.length);
                setStatus("ready");
                setProgress("");
              }
              return;
            } catch {
              // Кэш повреждён — пересобираем
            }
          }
        }

        // 3. Скачиваем свежие данные
        setProgress("Загрузка базы ТН ВЭД…");
        const dataResp = await fetch(DATA_URL);
        if (!dataResp.ok) throw new Error(`HTTP ${dataResp.status}`);

        setProgress("Построение поискового индекса…");
        const records = await dataResp.json();

        const ms = new MiniSearch(MINISEARCH_OPTIONS);
        ms.addAll(records);

        if (!cancelled) {
          msRef.current   = ms;
          allData.current = records;
          setTotal(records.length);

          // Сохраняем в localStorage
          try {
            localStorage.setItem(LS_KEY,  JSON.stringify({
              index:   JSON.parse(ms.toJSON()),
              records,
            }));
            localStorage.setItem(LS_META, JSON.stringify({ version: freshVersion }));
          } catch (e) {
            // localStorage может быть переполнен — не критично
            console.warn("Не удалось кэшировать индекс:", e);
          }

          setStatus("ready");
          setProgress("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Ошибка инициализации:", err);
          setStatus("error");
          setProgress(err.message);
        }
      }
    }

    init();

    // Слушаем событие обновления SW
    const onSwUpdate = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", onSwUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("sw-update-available", onSwUpdate);
    };
  }, []);

  // ── Поиск ─────────────────────────────────────────────────────────────

  const search = useCallback((query, limit = 50) => {
    const ms = msRef.current;
    if (!ms) return;

    const q = query.trim();
    if (!q) {
      // Пустой запрос — показываем первые N записей
      setResults(allData.current.slice(0, limit));
      return;
    }

    // Цифровой запрос — ищем только по коду (prefix)
    const isNumeric = /^\d+$/.test(q);
    const hits = ms.search(q, {
      fields:       isNumeric ? ["code"] : undefined,
      boost:        isNumeric ? { code: 10 } : { code: 2 },
      prefix:       true,
      fuzzy:        isNumeric ? false : 0.2,
      combineWith:  "AND",
    });

    setResults(hits.slice(0, limit));
  }, []);

  // ── Применить обновление SW ───────────────────────────────────────────

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }, []);

  return {
    status,
    progress,
    results,
    total,
    meta,
    search,
    updateAvailable,
    applyUpdate,
  };
}
