# Правила агента: Memory Game

## Область и статус

Работай только в `memory-game`; инструкции соседнего Coffee House не относятся к проекту. Отвечай на русском языке. Сейчас существуют основа HTML/JS/CSS и документация; игра, изображения и рейтинг ещё не реализованы. Реализацию выполняй, когда она запрошена, без расширения задачи по собственной инициативе.

Стек: HTML, CSS, vanilla JavaScript с нативными ES modules. Внешних зависимостей, сборщика, package.json, lock-файлов, настроенных линтера и тестового инструмента нет. localStorage предусмотрен для будущего рейтинга. Перед изменениями проверь реальные файлы, конфигурацию и Git-статус/ветку, если Git доступен.

## Источники

[Официальный таск](https://github.com/rolling-scopes-school/tasks/blob/master/tasks/memory-game/README.md) задаёт функциональные требования, ограничения и сдачу; они имеют приоритет. [ТЗ](docs/TermsOfReference.md) описывает сценарии/приёмку, [DESIGN](docs/DESIGN.md) — оформление Star Wars/доступность, [Architecture](docs/Architecture.md) — принятые контракты, [TechnologyStack](docs/TechnologyStack.md) — фактические технологии, [README](README.md) — запуск.

Ранние формулировки «ещё не выбрано» в ТЗ/стеке не отменяют последующих решений Architecture: Фишер — Йейтс, собственная модальная оболочка, ключ memory-game.leaderboard.v1. При реальном конфликте сообщи о нём и согласуй затронутые документы в границах задачи.

## Маршрутизация

Общие правила ниже — Markdown-документы для чтения агентом, а не исполняемые политики Codex. Читай только относящиеся к работе инструкции.

| Работа | Правила | Локальный skill |
| --- | --- | --- |
| Стек, структура | [project-and-stack](.codex/rules/project-and-stack.md) | По конкретной задаче |
| Состояние, таймер, рейтинг | [game-and-storage](.codex/rules/game-and-storage.md) | [memory-game-logic](.agents/skills/memory-game-logic/SKILL.md) |
| DOM, CSS, окна | [ui-and-design](.codex/rules/ui-and-design.md) | [memory-game-ui](.agents/skills/memory-game-ui/SKILL.md) |
| Проверки и сдача | [testing-and-delivery](.codex/rules/testing-and-delivery.md) | [memory-game-validation](.agents/skills/memory-game-validation/SKILL.md) |

Skills размещены в проектном .agents/skills/. Если каталог навыков сессии ещё не обновился, явно прочитай нужный SKILL.md по ссылке; не утверждай, что новые навыки уже автоматически загружены.

## Обязательные ограничения и полномочия

В исходном body только script. Весь UI создаётся document.createElement, текст через textContent. Запрещены запись innerHTML/outerHTML (включая пустую строку), insertAdjacentHTML, document.write/writeln, разбор HTML-строк через DOMParser/Range.createContextualFragment, alert/confirm/prompt, сторонние UI/DOM/игровые библиотеки.

Не затрагивай соседние проекты и изменения пользователя. Установка зависимостей, удаление, git init/commit/push/merge/rebase, PR и публикация требуют явного разрешения пользователя; полученное разрешение действует в рамках согласованной задачи. Обычные необходимые правки по уже запрошенной работе повторного согласования не требуют. Не меняй глобальные skills/настройки. Не выводи и не сохраняй .env, токены, ключи, пароли и cookies.

Терминал — Windows PowerShell: совместимые команды, rg для поиска, кавычки для путей с пробелами. Перед итогом проверь изменения и доступные проверки. Назови файлы, результаты, ограничения и рекомендованный коммит; не выполняй его без разрешения. Не выдавай планируемое поведение или непроведённые проверки за готовые.
