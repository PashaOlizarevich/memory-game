# Проверка игровой логики до подключения интерфейса

Пункт 18 [плана реализации](./ImplementationPlan.md) выполнен для существующих модулей `src/game/` по игровым контрактам [Architecture](./Architecture.md) и сценариям [ТЗ](./TermsOfReference.md). Проверена логика через нативные ES modules и встроенный тестовый инструмент Node.js v24.14.1; зависимости не устанавливались.

## Фактические проверки

Команды выполнены из корня `memory-game` в PowerShell:

```powershell
node --version
node --test tests/*.test.mjs
$checkFiles = @(rg --files src/game tests -g '*.js' -g '*.mjs')
foreach ($checkFile in $checkFiles) {
    node --check $checkFile
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $checkFile" }
}
git diff --check
```

Результат: версия `v24.14.1`, **20 тестов прошли**, ошибок, пропусков и отмен нет. Синтаксис всех четырёх игровых JS-модулей и трёх тестовых MJS-файлов проверен без ошибок; `git diff --check` прошёл.

## Сценарии и подтверждение

Ниже указаны существующие тесты, повторно выполненные при этой проверке. Дублирующие тесты не добавлены; ошибок, требующих изменения игровой логики, не обнаружено.

| Сценарий | Проверенный результат | Тесты |
| --- | --- | --- |
| Начало партии | 16 уникальных закрытых карточек, восемь пар по два экземпляра; выбор, счётчики и время завершения сброшены; перемешивание повторно использует источник случайности | [engine.test.mjs](../tests/engine.test.mjs): `creation is silent; restart starts fresh rounds and copies input pair IDs` |
| Первая и вторая карточки | Первая открывается без хода; второй допустимый выбор добавляет ровно один ход при совпадении и несовпадении | [state-finished.test.mjs](../tests/state-finished.test.mjs): `only the eighth matched pair finishes a round with the supplied timestamp`, `a mismatch adds a move without finishing, and its move remains in the final result`; [engine.test.mjs](../tests/engine.test.mjs): `ignored choices do not notify; matching and completion use state rules and now` |
| Совпадение | Пара получает `matched`, число найденных пар увеличивается на один; выбор очищается; найденные карточки остаются открытыми | [state-finished.test.mjs](../tests/state-finished.test.mjs): `only the eighth matched pair finishes a round with the supplied timestamp`; [engine.test.mjs](../tests/engine.test.mjs): `each mismatch has one 1000 ms timer; callback and rapid choices cannot extend it` |
| Недоступный выбор | Повторная карточка, найденная пара, неизвестный ID и любой выбор при ожидании или победе игнорируются; состояние и уведомления не меняются | Все пять тестов [state-ignored-selection.test.mjs](../tests/state-ignored-selection.test.mjs); [engine.test.mjs](../tests/engine.test.mjs): `ignored choices do not notify; matching and completion use state rules and now`, `each mismatch has one 1000 ms timer; callback and rapid choices cannot extend it` |
| Несовпадение и таймер | Две карточки открыты, выбор блокируется сразу, создаётся один таймер на 1000 мс; быстрые клики не сдвигают срок. На 999 мс пара ещё открыта, на 1000 мс закрывается один раз; выбор очищается, найденные пары и счётчики сохраняются | [engine.test.mjs](../tests/engine.test.mjs): `each mismatch has one 1000 ms timer; callback and rapid choices cannot extend it` |
| Завершение | Только восьмая найденная пара переводит в `finished`; итог — 8 ходов без ошибки либо 9 после одного несовпадения; `completedAt` фиксируется один раз, включая значение 0; дальнейшие действия не меняют результат | Все три теста [state-finished.test.mjs](../tests/state-finished.test.mjs); [engine.test.mjs](../tests/engine.test.mjs): `every notification reflects current state and isolates mutations inside its callback`, `ignored choices do not notify; matching and completion use state rules and now` |
| Чистые переходы и снимки | Входное состояние не меняется; изменение снимка или уведомления не влияет на движок; сохранённые снимки не меняются после последующих действий | Замороженные входные состояния в [state-finished.test.mjs](../tests/state-finished.test.mjs) и [state-ignored-selection.test.mjs](../tests/state-ignored-selection.test.mjs); три теста изоляции и истории снимков в [engine.test.mjs](../tests/engine.test.mjs) |
| Перезапуск | После первой карточки, найденной пары, победы и во время ожидания создаётся новая партия с новым `roundId`, новыми ID и нулевыми счётчиками; выбор доступен сразу. Текущий таймер отменяется, новое несовпадение получает отдельный срок | [engine.test.mjs](../tests/engine.test.mjs): `creation is silent; restart starts fresh rounds and copies input pair IDs`, `restart resets matched progress and a completed result and allows immediate selection`, `restart cancels the pending timer and new mismatch keeps its own deadline` |
| Устаревшие callbacks | Принудительный вызов отменённого callback после перезапуска не меняет новую партию или её таймер; повторный вызов уже выполненного callback безопасен | [engine.test.mjs](../tests/engine.test.mjs): `even an invoked stale callback cannot affect a new round or clear its timer` |
| Уничтожение и действия из уведомления | `destroy()` отменяет текущий таймер один раз и запрещает дальнейшие действия; уничтожение до старта безопасно. Перезапуск и уничтожение внутри уведомления о несовпадении отменяют зарегистрированный таймер | [engine.test.mjs](../tests/engine.test.mjs): `destroy is terminal and cancels timers, including destroy before starting`, `restart inside a mismatch notification cancels the registered timer`, `destroy inside a mismatch notification cancels the registered timer` |

## Границы результата

Проверены игровые переходы и жизненный цикл движка **до подключения UI**. Интервалы проверены управляемыми таймерами Node.js, а отменённые callbacks дополнительно вызваны принудительно. Это не измерение реального времени исполнения в браузере: задержки event loop и ограничение таймеров фоновой вкладки не проверялись.

DOM, клики в браузере, клавиатура, фокус, оформление, модальные окна, рейтинг, `localStorage` и деплой не проверены: соответствующие функции ещё предстоит реализовать и подключить. Прохождение этих тестов не означает полную приёмку приложения по ТЗ.
