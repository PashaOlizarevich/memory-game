---
name: memory-game-ui
description: Создать или исправить DOM, CSS, карточки и общие модальные окна Memory Game в стиле Star Wars с адаптивностью и доступностью. Применять для ui, styles и ресурсов; не для самостоятельного изменения правил игры или хранения рейтинга.
---

# Интерфейс Memory Game

Прочитай [AGENTS](../../../AGENTS.md), [UI-правила](../../../.codex/rules/ui-and-design.md), нужные разделы [DESIGN](../../../docs/DESIGN.md) и UI-контракты [Architecture](../../../docs/Architecture.md). Не подменяй текущий дизайн новым процессом генерации макетов.

## Workflow

1. Проверь код/границы задачи. Vanilla JS/CSS, токены/тексты DESIGN: космос, светящиеся акценты, единая рубашка и различимые образы. Генерация изображений необязательна; не добавляй библиотеки/режимы.
2. Весь DOM document.createElement, текст textContent, окна принимают узлы. Body только script. Запрещены запись innerHTML/outerHTML, insertAdjacentHTML, document.write/writeln, DOMParser/Range.createContextualFragment для HTML, alert/confirm/prompt, UI/DOM/игровые библиотеки.
3. Render отображает snapshot и передаёт callbacks. CSS/анимации не управляют правилами. Обновляй существующие карточки/счётчики, пересоздавай колоду при новом roundId; modal не пересоздаётся таймером.
4. Button/focus/Enter/Space; скрытые образ/fallback не видны и не озвучиваются. Открытое имя отражает образ/статус без дублирования img. Aria-live не раскрывает образы. Grid 4 × 4 от 320 px; проверки 320/375/768/1440, reduced motion/изображения.
5. Одна собственная modal-оболочка: role dialog/aria-modal/labelledby, background inert, сохранение/возврат overflow, focus/Tab внутри. Закрытие кнопкой/Escape/target === overlay, не содержимым. Focus к триггеру, резерв/автоматическая победа — «Новая игра» хедера. Не копи обработчики.
6. Рейтинг сохраняет выбор/таймер; обновление поля не меняет его focus/содержимое. Mismatch блокирует карточки, не header вне modal. Новая игра вызывает общий close/restart; UI не записывает победу. При persistence memory сообщение DESIGN, без повторного сохранения из UI.
7. Проверь затронутые браузерные сценарии и ./public/assets/images/cards/ пути. При недоступном браузере назови ограничение; просмотр кода не подтверждает focus/адаптивность.

Для интеграции прочитай [game-and-storage](../../../.codex/rules/game-and-storage.md); изменение engine/store требует их контрактов, а не переноса логики в UI.
