# ТН ВЭД РУз — Справочник

Быстрый офлайн-справочник Товарной номенклатуры внешнеэкономической деятельности  
Республики Узбекистан. Поиск по коду и наименованию — прямо в браузере, без лагов.

## Возможности

- **Мгновенный поиск** — по коду (например, `8471`) и по наименованию (`хлопок`)
- **Нечёткий поиск** — находит даже при опечатках
- **Офлайн-режим** — данные кэшируются в браузере после первого посещения
- **PWA** — устанавливается как приложение на телефон/компьютер
- **Самообновление** — GitHub Actions автоматически обновляет базу каждую субботу

---

## Быстрый старт (локально)

```bash
# 1. Клонируем репозиторий
git clone https://github.com/ВАШ_ЛОГИН/tnved-uz.git
cd tnved-uz

# 2. Устанавливаем зависимости Node.js
npm install

# 3. Устанавливаем Python-зависимости
pip install -r scraper/requirements.txt

# 4. Запускаем парсер (первый раз — получаем данные)
python scraper/scraper.py

# 5. Запускаем dev-сервер
npm run dev
# → http://localhost:5173
```

---

## Деплой на GitHub Pages

### Шаг 1 — Создайте репозиторий на GitHub

Назовите его `tnved-uz` (или любое другое имя).

### Шаг 2 — Настройте GitHub Pages

1. Перейдите в `Settings → Pages`
2. Source: **GitHub Actions**
3. Сохраните

### Шаг 3 — Загрузите код

```bash
git init
git remote add origin https://github.com/ВАШ_ЛОГИН/tnved-uz.git
git add .
git commit -m "init: ТН ВЭД справочник"
git push -u origin main
```

### Шаг 4 — Первый запуск

Перейдите в `Actions → Update ТН ВЭД data & Deploy → Run workflow`.

После завершения сайт будет доступен по адресу:  
`https://ВАШ_ЛОГИН.github.io/tnved-uz/`

---

## Структура проекта

```
tnved-uz/
├── scraper/
│   ├── scraper.py          # Парсер данных с customs.uz
│   └── requirements.txt
├── src/
│   ├── hooks/
│   │   └── useSearch.js    # Загрузка данных + MiniSearch
│   ├── components/
│   │   ├── SearchBar.jsx
│   │   ├── ResultRow.jsx
│   │   └── DetailModal.jsx
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── data/
│   │   ├── tnved.json      # База данных (генерируется парсером)
│   │   └── meta.json       # Метаданные версии
│   ├── sw.js               # Service Worker (офлайн + кэш)
│   └── manifest.json       # PWA манифест
├── .github/
│   └── workflows/
│       └── update-and-deploy.yml
├── index.html
├── vite.config.js
└── package.json
```

---

## Стратегии парсинга

Парсер пробует три стратегии по очереди (`--strategy auto`):

| Стратегия | Описание |
|-----------|----------|
| `ajax`    | DataTables AJAX endpoint (быстро, ~1 мин) |
| `html`    | Парсинг HTML-таблиц постранично |
| `seed`    | Встроенные данные (97 групп 1-го уровня) |

Для ручного запуска конкретной стратегии:
```bash
python scraper/scraper.py --strategy html
```

---

## Добавление данных вручную

Если парсер получил только верхний уровень — можно дополнить базу вручную.  
Создайте файл `public/data/tnved_extra.json` в формате:

```json
[
  {
    "code": "847130",
    "name": "Машины вычислительные портативные массой не более 10 кг",
    "unit": "шт",
    "duty": "0%",
    "level": 6
  }
]
```

Парсер автоматически объединит его с основной базой при следующем запуске  
(добавьте `merge_extra()` в `scraper.py` при необходимости).

---

## Лицензия

MIT. Данные предоставлены Государственным таможенным комитетом РУз.
