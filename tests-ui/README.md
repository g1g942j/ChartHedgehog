# ChartHedgehog UI Tests

Selenium UI тесты для ChartHedgehog (Next.js + Spring Boot).

## Требования

- Node.js 20+
- Google Chrome + ChromeDriver (той же версии)
- Запущенный бэкенд: `http://localhost:8080`
- Запущенный фронтенд: `http://localhost:3000`
- Существующий тестовый пользователь в БД

## Установка

```bash
cd tests-ui
npm install
```

## Переменные окружения

| Переменная       | По умолчанию          | Описание                     |
|------------------|-----------------------|------------------------------|
| `TEST_USERNAME`  | `admin`               | Логин тестового пользователя |
| `TEST_PASSWORD`  | `admin123`            | Пароль тестового пользователя|
| `APP_URL`        | `http://localhost:3000` | URL фронтенда              |

## Запуск

```bash
# Все тесты
TEST_USERNAME=admin TEST_PASSWORD=admin123 npm test

# В headless режиме (для CI)
SELENIUM_HEADLESS=1 TEST_USERNAME=admin TEST_PASSWORD=admin123 npm test
```

## Структура

```
tests-ui/
├── driver-factory.ts       # Создание WebDriver (Chrome)
├── base-url.ts             # URL и credentials из env
├── waits.ts                # Хелперы ожидания элементов
├── auth-helper.ts          # Логин для тестов требующих авторизацию
├── pages/
│   ├── login.page.ts       # Страница входа
│   ├── register.page.ts    # Страница регистрации
│   ├── diagrams.page.ts    # Список диаграмм
│   ├── diagram-detail.page.ts  # Детальная страница диаграммы
│   ├── participants.page.ts    # Участники диаграммы
│   ├── profile.page.ts     # Профиль пользователя
│   └── navbar.page.ts      # Навигационная панель
└── specs/
    ├── ch-login.spec.ts           # Тесты входа
    ├── ch-register.spec.ts        # Тесты регистрации
    ├── ch-navbar.spec.ts          # Тесты навбара
    ├── ch-diagrams.spec.ts        # Тесты списка диаграмм
    ├── ch-diagram-settings.spec.ts # Тесты настроек диаграммы
    ├── ch-participants.spec.ts    # Тесты участников
    └── ch-profile.spec.ts         # Тесты профиля
```
