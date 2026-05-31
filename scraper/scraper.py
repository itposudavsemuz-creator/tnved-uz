"""
ТН ВЭД РУз — парсер данных с tarif.customs.uz
Стратегия: сначала пробуем прямые HTTP-запросы к JSON/JSP endpoint-ам,
при неудаче — парсим HTML-таблицы постранично.
Результат: public/data/tnved.json + public/data/meta.json
"""

import json
import time
import re
import sys
import os
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

# ── Настройки ──────────────────────────────────────────────────────────────

BASE_URL = "https://tarif.customs.uz"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": BASE_URL + "/",
}

# Известные endpoint-ы таблицы ТН ВЭД на сайте
TABLE_ENDPOINTS = [
    "/spravochnik/viewDatatable.jsp",
    "/ru/directory/tnved",
]

# DataTables AJAX endpoint (если сайт использует jQuery DataTables)
AJAX_ENDPOINT = "/spravochnik/getData.jsp"

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
REQUEST_DELAY = 1.5   # сек между запросами — уважаем сервер
MAX_RETRIES   = 3
SESSION_TIMEOUT = 30

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tnved-scraper")


# ── HTTP-сессия ────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def safe_get(session: requests.Session, url: str, **kwargs) -> requests.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.get(url, timeout=SESSION_TIMEOUT, **kwargs)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            log.warning("Попытка %d/%d: %s — %s", attempt, MAX_RETRIES, url, e)
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY * attempt)
    return None


def safe_post(session: requests.Session, url: str, **kwargs) -> requests.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.post(url, timeout=SESSION_TIMEOUT, **kwargs)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            log.warning("Попытка %d/%d: POST %s — %s", attempt, MAX_RETRIES, url, e)
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY * attempt)
    return None


# ── Стратегия 1: DataTables AJAX ──────────────────────────────────────────

def try_datatables_ajax(session: requests.Session) -> list[dict] | None:
    """
    Многие JSP-сайты используют jQuery DataTables с serverSide=true.
    Пробуем напрямую запросить данные через стандартный AJAX-endpoint.
    """
    log.info("Стратегия 1: DataTables AJAX (%s)", AJAX_ENDPOINT)

    # Сначала — GET главной страницы, чтобы получить cookies и CSRF-токен
    main_url = BASE_URL + TABLE_ENDPOINTS[0] + "?lang=ru_Ru"
    r = safe_get(session, main_url)
    if r is None:
        log.warning("Не удалось загрузить главную страницу таблицы")
        return None

    # Ищем в JS переменную с настройками DataTables (sAjaxSource / ajax / url)
    ajax_url = None
    matches = re.findall(
        r'["\']?(sAjaxSource|ajax)["\']?\s*:\s*["\']([^"\']+)["\']',
        r.text,
    )
    if matches:
        ajax_url = BASE_URL + matches[0][1] if matches[0][1].startswith("/") else matches[0][1]
        log.info("Найден AJAX URL: %s", ajax_url)
    else:
        ajax_url = BASE_URL + AJAX_ENDPOINT

    records = []
    start = 0
    page_size = 1000

    while True:
        params = {
            "sEcho": start // page_size + 1,
            "iDisplayStart": start,
            "iDisplayLength": page_size,
            "lang": "ru_Ru",
        }
        resp = safe_get(session, ajax_url, params=params)
        if resp is None:
            break

        try:
            data = resp.json()
        except ValueError:
            log.warning("Ответ не JSON — DataTables AJAX недоступен")
            return None

        rows = (
            data.get("aaData")
            or data.get("data")
            or data.get("rows")
            or []
        )
        if not rows:
            break

        total = data.get("iTotalRecords") or data.get("recordsTotal") or 0
        log.info("  страница start=%d: получено %d строк (всего: %d)", start, len(rows), total)

        for row in rows:
            record = parse_datatables_row(row)
            if record:
                records.append(record)

        start += page_size
        if total and start >= int(total):
            break
        if len(rows) < page_size:
            break

        time.sleep(REQUEST_DELAY)

    return records if records else None


def parse_datatables_row(row) -> dict | None:
    """Нормализует строку DataTables (массив или словарь)."""
    if isinstance(row, list):
        # Типичная структура: [код, наименование, ед_изм, ставка_пошлины, ...]
        if len(row) < 2:
            return None
        code = clean_text(str(row[0]))
        name = clean_text(str(row[1]))
        unit = clean_text(str(row[2])) if len(row) > 2 else ""
        duty = clean_text(str(row[3])) if len(row) > 3 else ""
    elif isinstance(row, dict):
        code = clean_text(
            row.get("code") or row.get("CODE") or row.get("tnved") or ""
        )
        name = clean_text(
            row.get("name") or row.get("NAME") or row.get("description") or ""
        )
        unit = clean_text(row.get("unit") or row.get("UNIT") or "")
        duty = clean_text(row.get("duty") or row.get("DUTY") or row.get("rate") or "")
    else:
        return None

    if not code or not name:
        return None

    return {
        "code": code,
        "name": name,
        "unit": unit,
        "duty": duty,
        "level": len(code.rstrip("0")) if code else 0,
    }


# ── Стратегия 2: HTML-парсинг таблицы ─────────────────────────────────────

def try_html_table(session: requests.Session) -> list[dict] | None:
    """
    Загружаем HTML-страницы с таблицей ТН ВЭД и парсим <table> тегами.
    Поддерживает пагинацию через параметры start/page.
    """
    log.info("Стратегия 2: парсинг HTML-таблицы")

    records = []
    page = 0
    page_size = 500

    for endpoint in TABLE_ENDPOINTS:
        url = BASE_URL + endpoint
        log.info("  пробуем endpoint: %s", url)

        # Первый запрос — смотрим структуру
        r = safe_get(session, url, params={"lang": "ru_Ru"})
        if r is None:
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.find("table")
        if not table:
            log.info("  таблица не найдена, пробуем следующий endpoint")
            continue

        log.info("  таблица найдена, начинаем постраничный сбор")

        while True:
            rows = parse_html_table(soup)
            if not rows:
                break

            records.extend(rows)
            log.info("  страница %d: +%d строк (итого %d)", page, len(rows), len(records))

            # Ищем ссылку "Следующая страница"
            next_url = find_next_page(soup, url)
            if not next_url:
                # Пробуем параметр start= как fallback
                page += 1
                next_url_candidate = url + f"?lang=ru_Ru&iDisplayStart={page * page_size}&iDisplayLength={page_size}"
                r2 = safe_get(session, next_url_candidate)
                if r2 is None:
                    break
                soup2 = BeautifulSoup(r2.text, "html.parser")
                new_rows = parse_html_table(soup2)
                if not new_rows or new_rows == rows:
                    break
                soup = soup2
            else:
                time.sleep(REQUEST_DELAY)
                r = safe_get(session, next_url)
                if r is None:
                    break
                soup = BeautifulSoup(r.text, "html.parser")

        if records:
            return records

    return None


def parse_html_table(soup: BeautifulSoup) -> list[dict]:
    records = []
    table = soup.find("table")
    if not table:
        return records

    # Определяем индексы столбцов по заголовку
    headers = []
    thead = table.find("thead")
    if thead:
        headers = [clean_text(th.get_text()) for th in thead.find_all("th")]

    col_code = find_col_index(headers, ["код", "code", "tn", "тн вэд"])
    col_name = find_col_index(headers, ["наименование", "описание", "name", "description", "товар"])
    col_unit = find_col_index(headers, ["ед", "единица", "unit"])
    col_duty = find_col_index(headers, ["пошлина", "ставка", "duty", "rate", "тариф"])

    # Если заголовков нет — угадываем по позиции (типичный порядок для ТН ВЭД)
    if col_code is None:
        col_code = 0
    if col_name is None:
        col_name = 1

    tbody = table.find("tbody") or table
    for tr in tbody.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue

        def cell(idx):
            if idx is None or idx >= len(cells):
                return ""
            return clean_text(cells[idx].get_text())

        code = cell(col_code)
        name = cell(col_name)

        if not code or not re.match(r"^\d{2,10}", code):
            continue

        records.append({
            "code": re.sub(r"\s+", "", code),   # убираем пробелы внутри кода
            "name": name,
            "unit": cell(col_unit),
            "duty": cell(col_duty),
            "level": len(re.sub(r"\s+", "", code).rstrip("0")),
        })

    return records


def find_col_index(headers: list[str], keywords: list[str]) -> int | None:
    for i, h in enumerate(headers):
        h_lower = h.lower()
        if any(kw in h_lower for kw in keywords):
            return i
    return None


def find_next_page(soup: BeautifulSoup, base_url: str) -> str | None:
    # Ищем ссылки с текстом "Следующая", "Next", "»", или rel="next"
    for a in soup.find_all("a"):
        text = a.get_text(strip=True).lower()
        rel  = a.get("rel", [])
        if any(t in text for t in ["следующ", "next", "›", "»"]) or "next" in rel:
            href = a.get("href")
            if href:
                return href if href.startswith("http") else BASE_URL + href
    return None


# ── Стратегия 3: Seed из открытых источников + fallback-данные ────────────

def load_seed_data() -> list[dict]:
    """
    Если scraping недоступен — возвращаем минимальный набор
    из 97 разделов первого уровня ТН ВЭД СНГ/ЕАЭС (публичные данные).
    Пользователь может дополнить файл public/data/tnved_extra.json
    """
    log.info("Стратегия 3: seed-данные (разделы 1-го уровня)")

    # 21 раздел ТН ВЭД — публичная классификация
    sections = [
        ("01", "Живые животные"),
        ("02", "Мясо и пищевые мясные субпродукты"),
        ("03", "Рыба и ракообразные, моллюски"),
        ("04", "Молочная продукция; яйца птиц; мёд натуральный"),
        ("05", "Продукты животного происхождения, в другом месте не поименованные"),
        ("06", "Живые деревья и другие растения"),
        ("07", "Овощи и некоторые съедобные корнеплоды"),
        ("08", "Съедобные фрукты и орехи"),
        ("09", "Кофе, чай, мате, или парагвайский чай, и пряности"),
        ("10", "Злаки"),
        ("11", "Продукция мукомольно-крупяной промышленности"),
        ("12", "Масличные семена и плоды; прочие семена"),
        ("13", "Шеллак природный неочищенный; смолы"),
        ("14", "Растительные материалы для изготовления плетёных изделий"),
        ("15", "Жиры и масла животного или растительного происхождения"),
        ("16", "Готовые продукты из мяса, рыбы или ракообразных"),
        ("17", "Сахар и кондитерские изделия из сахара"),
        ("18", "Какао и продукты из него"),
        ("19", "Готовые продукты из зерна злаков, муки, крахмала или молока"),
        ("20", "Продукты переработки овощей, фруктов, орехов"),
        ("21", "Разные пищевые продукты"),
        ("22", "Алкогольные и безалкогольные напитки и уксус"),
        ("23", "Остатки и отходы пищевой промышленности; готовые корма"),
        ("24", "Табак и промышленные заменители табака"),
        ("25", "Соль; сера; земли и камень; штукатурные материалы"),
        ("26", "Руды, шлак и зола"),
        ("27", "Топливо минеральное, нефть и продукты их перегонки"),
        ("28", "Продукты неорганической химии; неорганические или органические соединения драгоценных металлов"),
        ("29", "Органические химические соединения"),
        ("30", "Фармацевтическая продукция"),
        ("31", "Удобрения"),
        ("32", "Экстракты дубильные или красильные; танины"),
        ("33", "Эфирные масла и резиноиды; парфюмерные, косметические или туалетные средства"),
        ("34", "Мыло, поверхностно-активные вещества; смазочные препараты"),
        ("35", "Белковые вещества; модифицированные крахмалы; клеи"),
        ("36", "Взрывчатые вещества; пиротехнические изделия"),
        ("37", "Фото- и кинотовары"),
        ("38", "Продукты химической промышленности"),
        ("39", "Пластмассы и изделия из них"),
        ("40", "Каучук, резина и изделия из них"),
        ("41", "Необработанные шкуры (кроме натурального меха)"),
        ("42", "Изделия из кожи; шорно-седельные изделия и упряжь"),
        ("43", "Натуральный и искусственный мех"),
        ("44", "Древесина и изделия из неё; древесный уголь"),
        ("45", "Пробка и изделия из неё"),
        ("46", "Изделия из соломы, альфы или прочих материалов для плетения"),
        ("47", "Масса из древесины или других целлюлозных волокнистых материалов"),
        ("48", "Бумага и картон; изделия из бумажной массы"),
        ("49", "Печатные книги, газеты, репродукции"),
        ("50", "Шёлк"),
        ("51", "Шерсть, тонкий и грубый волос животных"),
        ("52", "Хлопок"),
        ("53", "Прочие растительные текстильные волокна"),
        ("54", "Химические нити; плоские нити из химических материалов"),
        ("55", "Химические волокна"),
        ("56", "Вата, войлок и нетканые материалы"),
        ("57", "Ковры и прочие текстильные напольные покрытия"),
        ("58", "Специальные тканые материалы; тафтинговые текстильные материалы"),
        ("59", "Текстильные материалы с пропиткой, покрытием или дублированием"),
        ("60", "Трикотажные полотна"),
        ("61", "Предметы одежды и принадлежности к ней трикотажные"),
        ("62", "Предметы одежды и принадлежности, не трикотажные"),
        ("63", "Прочие готовые текстильные изделия"),
        ("64", "Обувь, гетры и аналогичные изделия"),
        ("65", "Головные уборы и их части"),
        ("66", "Зонты, трости, хлысты"),
        ("67", "Обработанные перья и пух; искусственные цветы"),
        ("68", "Изделия из камня, гипса, цемента, асбеста"),
        ("69", "Керамические изделия"),
        ("70", "Стекло и изделия из него"),
        ("71", "Природные и культивированные жемчуг, драгоценные камни"),
        ("72", "Чёрные металлы"),
        ("73", "Изделия из чёрных металлов"),
        ("74", "Медь и изделия из неё"),
        ("75", "Никель и изделия из него"),
        ("76", "Алюминий и изделия из него"),
        ("78", "Свинец и изделия из него"),
        ("79", "Цинк и изделия из него"),
        ("80", "Олово и изделия из него"),
        ("81", "Прочие недрагоценные металлы; металлокерамика"),
        ("82", "Инструменты, приспособления, ножевые изделия"),
        ("83", "Прочие изделия из недрагоценных металлов"),
        ("84", "Ядерные реакторы, котлы, оборудование и механические устройства"),
        ("85", "Электрические машины и оборудование"),
        ("86", "Железнодорожные локомотивы и подвижной состав"),
        ("87", "Средства наземного транспорта, кроме железнодорожного"),
        ("88", "Летательные аппараты, космические аппараты"),
        ("89", "Суда, лодки и плавучие конструкции"),
        ("90", "Инструменты и аппараты оптические, фотографические"),
        ("91", "Часы всех видов и их части"),
        ("92", "Музыкальные инструменты"),
        ("93", "Оружие и боеприпасы"),
        ("94", "Мебель; постельные принадлежности, матрацы"),
        ("95", "Игрушки, игры и спортивный инвентарь"),
        ("96", "Разные готовые изделия"),
        ("97", "Произведения искусства, предметы коллекционирования и антиквариат"),
    ]

    return [
        {
            "code": code,
            "name": name,
            "unit": "",
            "duty": "",
            "level": 2,
        }
        for code, name in sections
    ]


# ── Утилиты ────────────────────────────────────────────────────────────────

def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def build_tree(records: list[dict]) -> list[dict]:
    """
    Добавляет поле parent_code для каждой записи,
    чтобы клиент мог строить иерархическое дерево.
    Логика: код 8471 — потомок 8470, 847 → 84, 84 → корень.
    """
    codes_set = {r["code"] for r in records}

    for rec in records:
        code = rec["code"]
        parent = None
        # Пробуем укорачивать код пока не найдём родителя
        for length in range(len(code) - 1, 1, -1):
            candidate = code[:length]
            if candidate in codes_set:
                parent = candidate
                break
        rec["parent_code"] = parent

    return records


def save_results(records: list[dict], source: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Основной файл данных
    out_path = OUTPUT_DIR / "tnved.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))

    log.info("Сохранено %d записей → %s", len(records), out_path)

    # Метаданные (используются фронтендом для проверки обновлений)
    meta = {
        "version": datetime.now(timezone.utc).strftime("%Y%m%d%H%M"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "source": source,
    }
    meta_path = OUTPUT_DIR / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    log.info("Метаданные → %s", meta_path)


# ── Точка входа ────────────────────────────────────────────────────────────

def main():
    global OUTPUT_DIR
    parser = argparse.ArgumentParser(description="ТН ВЭД РУз — парсер")
    parser.add_argument(
        "--strategy",
        choices=["ajax", "html", "seed", "auto"],
        default="auto",
        help="Стратегия сбора данных (default: auto — перебирает все)",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_DIR),
        help="Путь к папке с результатами",
    )
    args = parser.parse_args()

    OUTPUT_DIR = Path(args.output)

    session = make_session()
    records = None
    source = "unknown"

    strategies = {
        "ajax": (try_datatables_ajax, "customs.uz/ajax"),
        "html": (try_html_table,      "customs.uz/html"),
        "seed": (load_seed_data,      "seed/builtin"),
    }

    if args.strategy == "auto":
        order = ["ajax", "html", "seed"]
    else:
        order = [args.strategy]

    for name in order:
        fn, src_label = strategies[name]
        log.info("═══ Запускаем стратегию: %s ═══", name)
        try:
            if name == "seed":
                result = fn()
            else:
                result = fn(session)
        except Exception as e:
            log.error("Ошибка в стратегии %s: %s", name, e, exc_info=True)
            result = None

        if result:
            records = result
            source  = src_label
            log.info("✓ Стратегия %s успешна: %d записей", name, len(records))
            break
        else:
            log.warning("✗ Стратегия %s не дала результатов", name)

    if not records:
        log.error("Все стратегии исчерпаны. Данные не получены.")
        sys.exit(1)

    # Постобработка
    records = build_tree(records)
    save_results(records, source)

    log.info("Готово! Источник: %s", source)


if __name__ == "__main__":
    main()
