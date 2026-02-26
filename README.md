# Nook — Frontend

Клиентская часть мессенджера Nook. Discord-образный интерфейс для общения в реальном времени.

## Стек

- **React 19** + **TypeScript**
- **Vite** — сборка и dev-сервер
- **Tailwind CSS v4** — стилизация
- **shadcn/ui** — UI-компоненты
- **Zustand** — глобальное состояние
- **React Router DOM v7** — маршрутизация
- **react-hook-form** + **zod** — формы и валидация
- **react-i18next** — интернационализация

## Команды

```bash
bun dev       # Dev-сервер с HMR
bun build     # Проверка типов + продакшн сборка
bun lint      # ESLint
bun preview   # Превью продакшн сборки локально
```

## Структура

```
src/
├── api/              # HTTP-клиент и domain-обёртки (auth, users, rooms...)
├── components/
│   ├── auth/         # Компоненты форм авторизации
│   ├── chat/         # Компоненты чата (аудио, видео, сообщения)
│   └── ui/           # Базовые UI-компоненты (shadcn + кастомные)
├── i18n/
│   ├── index.ts      # Конфиг i18next
│   └── locales/      # Переводы (ru.json, en.json)
├── lib/              # Утилиты (hwid, firebase, notifications)
├── pages/
│   ├── auth/         # Login, Register, Setup
│   └── app/          # AppLayout, Chat, Home, Settings
├── store/            # Zustand-сторы (auth, ws, call, rooms, toasts)
└── types/            # Общие TypeScript-типы
```

## Маршрутизация

Двухуровневая система guards:

1. **SetupGuard** — проверяет инициализацию сервера (`GET /api/v1/setup`). Если сервер не настроен — редирект на `/setup`.
2. **AuthGuard** — валидирует JWT через `GET /api/v1/users/me`. При 401 — редирект на `/login`.

```
/              → редирект на /app
/setup         → первоначальная настройка (создание admin-аккаунта)
/login         → авторизация
/register      → регистрация
/app           → главная (защищённая)
/app/dm/:roomId → личные сообщения
```

## API

Все запросы идут на `/api/v1`. Клиент (`src/api/client.ts`) автоматически:
- Прикрепляет `Authorization: Bearer <token>` из `localStorage`
- При 401 выполняет refresh через `POST /api/v1/auth/refresh` и повторяет запрос

## Локализация

Переводы лежат в `src/i18n/locales/`. Текущий язык по умолчанию — `ru`. Добавление нового языка: создать файл `en.json` рядом и добавить его в `src/i18n/index.ts`.

## Дизайн-система

Tailwind v4 с кастомными токенами в `src/index.css`:

| Утилита            | Значение                  |
|--------------------|---------------------------|
| `bg-bg`            | `#0D0F12` — фон страницы  |
| `bg-secondary`     | `#171A1F` — боковые панели |
| `bg-elevated`      | `#1E2228` — карточки       |
| `bg-primary`       | `#00F5A0` — акцентный зелёный |
| `text-text`        | `#F5F7FA`                 |
| `text-text-secondary` | `#A8B0B8`              |
| `font-pixel`       | Pixelify Sans             |