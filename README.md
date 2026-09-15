# Копилка 300 000 ₽

Совместная копилка-календарь с Telegram Mini App.

## Переменные окружения (Vercel)

- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather
- `WEBAPP_URL` — https://ваш-проект.vercel.app

## KV Storage

Подключите Vercel KV в разделе Storage → ваш проект.

## Webhook

После деплоя откройте:
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://ваш-проект.vercel.app/api/telegram-webhook