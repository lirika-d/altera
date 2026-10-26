# ALTERA — полный архитектурный и кодовый аудит

**Дата первичного аудита:** 2026-10-25  
**Дополнение по каскадному удалению:** 2026-10-26  
**Репозиторий:** `C:\Users\Admin\Downloads\ALTERA`  
**Проверенная ревизия HEAD:** `bd062ed` (`main`, `origin/main`)  
**Важно:** аудит выполнен по текущей рабочей копии, в которой присутствует большое количество незакоммиченных и новых файлов поверх указанного HEAD.

Разделы 2–11 фиксируют исходные наблюдения и рекомендации; при расхождении с последующим кодом приоритет имеют статусные отметки в разделах 1 и 12. Повторный полный аудит каждого модуля не проводился.

## 1. Резюме

ALTERA уже имеет хороший фундамент локального desktop-like веб-приложения: React 19, TypeScript, Dexie/IndexedDB, транзакционный session engine, модель знаний, атомарный импорт, ленивые маршруты и 280 тестов в текущем наборе. Архитектура не выглядит безнадёжной или требующей полного переписывания.

Первоначальный вывод аудита: проект находится в состоянии **«хорошая доменная база, но нестабильный интеграционный/UI-слой»**. Три найденных P0 на границах URL/React/Dexie/editor были исправлены и проверены; значительная часть P1/P2 и рисков интеграционного тестирования остаётся.

### Общая оценка

| Область | Оценка | Комментарий |
|---|---:|---|
| Доменная модель проектов/задач | 7/10 | Простая и понятная, но удаление оставляет часть зависимостей |
| Session engine | 8/10 | Лучший модуль проекта: транзакции, state machine, тесты |
| Knowledge Hub | 5/10 | Render loop устранён, autosave усилен; остаются ограничения восстановления и пробел в автоматических UI/E2E-тестах |
| IndexedDB / целостность | 6/10 | Транзакции используются правильно, но нет полноценной referential integrity |
| React-архитектура | 5/10 | Ленивые страницы — плюс; эффекты, duplicated state и мегакомпоненты — минус |
| TypeScript | 5/10 | Типы моделей есть, но `strict` выключен и import path содержит `any` |
| Производительность | 6/10 | Project-scoped knowledge queries индексированы; глобальный поиск и часть агрегатов всё ещё читают целые таблицы |
| Безопасность | 7/10 | URL и HTML в editor обрабатываются осторожно; импорт данных требует усиления |
| Доступность | 6/10 | Combobox/listbox связи Command Palette исправлены; остаётся расширенная проверка с screen readers/axe |
| Локализация | 4/10 | Движок есть, но много пользовательских строк остаётся захардкожено на английском |
| Тестирование | 7/10 | 280 тестов проходят; CI и полноценные E2E/component тесты всё ещё отсутствуют |
| Production readiness | 5/10 | P0 исправлены; остаются ограничения backup compatibility, строгой типизации и CI |

**Итоговая оценка текущего состояния: 6/10.**  
Эта оценка отражает состояние на момент первичного аудита, а не пересчитанный рейтинг после исправлений.

### Статус исправлений и проверок на 2026-10-26

| Finding | Статус | Подтверждение |
|---|---|---|
| P0-1 — цикл Knowledge Hub | Исправлено | URL — единственный источник выбранной заметки; тесты выбора заметки и Playwright-проверка маршрута/истории браузера. |
| P0-2 — Command Palette | Исправлено | Единый typed route contract, одноразовые URL-intents и проверка реальных переходов/диалогов через Playwright. |
| P0-3 — autosave заметок | Исправлено в пределах клиентских гарантий | Сериализованные записи, синхронизация revision, восстановление черновика; тесты очереди/координатора/восстановления и браузерная проверка сохранения. |
| P1-2 — каскадное удаление | Исправлено по выбранной политике | Snapshot завершённых сессий, detach знаний, транзакционная очистка связей; fake-IndexedDB тесты, backup round-trip и read-only integrity scan. В Settings добавлен запуск сканирования и просмотр результатов; автоматического ремонта нет. |
| P1-3 — целостность entity links | Исправлено | Проверка source/target в транзакции, typed unique index, migration v4→v6, backup validation и read-only integrity scan; отчёт теперь доступен пользователю в Settings. |
| P1-1 — wipe и повторный seed | Исправлено в рабочей копии | Отдельный `metadata.initialized`, `clearAllData()` сохраняет маркер; тест wipe → reopen → пустые таблицы. Подтверждено повторно по коду/тесту. |
| P1-5 — ошибка инициализации скрывалась | Основной риск закрыт, recovery улучшен | `App` различает loading/ready/failed, retry и root Error Boundary уже были добавлены; теперь ошибка предлагает экспорт safe diagnostics без текста ошибок/данных. Отдельная кнопка запуска в пустом режиме не добавлялась: при сбое БД это могло бы скрыть неисправность и создать риск записи в неконсистентное хранилище. |
| P2-3 — Command Palette загружалась в стартовом чанке | Исправлена загрузка | Компонент загружается по первому хоткею, `/` или кнопке; Dexie live query остаётся выключенной до открытия. Проверено по сетевым ресурсам браузера. |
| P2-4 — проектные knowledge queries и session stats сканировали таблицы | Частично исправлено | Dexie v7 добавляет индексы notes/resources.projectId; project-scoped выборки используют их; session stats читают только `completed` через status index, общее количество получают через `count()`. Глобальный поиск и неограниченные глобальные агрегаты всё ещё читают коллекции целиком. |
| P2-1 — TypeScript `strict` был выключен | Исправлено | Включён `strict: true`; проверка полного приложения прошла, существующие явные `any` в i18n заменены на `unknown` и узкую проверку типа. |
| P2-5 — нестабильные hook fallback values | Уже исправлено до этого прохода | В `useKnowledge.ts` используются общие стабильные пустые значения; `useSearchData()` мемоизирует результат и сообщает фактический readiness. |
| P2-9 — неполная combobox/listbox модель | Исправлено в Command Palette | Добавлены `role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, устойчивые option IDs и группы; невидимые команды исключены из keyboard-навигации под фильтром entity. Проверено в Playwright при 390px. |
| P2-10 — нет CI и обязательных quality gates | Исправлено в рабочей копии | Добавлен GitHub Actions workflow для npm ci, тестов, lint и production build на push/pull request. Внешний запуск GitHub Actions зависит от публикации изменений и здесь не утверждается как проверенный. |

Ограничения и невыполненные пункты перечислены ниже. Статусы основаны на текущем дереве и целевых проверках, а не на повторном полном построчном аудите всех модулей.

**Проверки после этого прохода:** текущий полный `npm test` — 280/280; `npm run build` — TypeScript и Vite build прошли (2,125 модулей; initial JS chunk 359.54 kB raw / 113.99 kB gzip, lazy Command Palette chunk 27.56 kB raw / 7.82 kB gzip); `npm run lint` — без ошибок, 12 предупреждений. Playwright: проверены отсутствие Command Palette chunk до вызова, открытие кнопкой/хоткеем, search result, keyboard active descendant, фильтр, project navigation и отсутствие horizontal overflow на viewport 390×844. Browser console: 0 ошибок/предупреждений.

---

## 2. Что было проверено

- Структура приложения, маршрутизация и инициализация.
- React hooks, эффекты, live queries и глобальные события.
- Схема Dexie v1–v3 и операции над всеми таблицами.
- Session engine, таймеры и ограничения переходов.
- Knowledge Hub, notes/resources/tags/attachments/entity links.
- Редактор заметок, autosave и optimistic revision control.
- Backup/export/import, reset и wipe.
- Глобальный поиск и command palette.
- TypeScript, lint configuration, сборочные чанки.
- Локализация и доступность.
- Наличие и распределение тестов.
- Текущий `git status` и эксплуатационная документация.

### Выполненные проверки

- `npm test`: **10 test files, 224/224 tests passed**.
- `npm run lint`: **exit code 0**, ошибок нет, найдено **15 warnings**.
- Ранее на этой же рабочей копии успешно проходили TypeScript и production build.
- Аудит не менял исходный код, БД или бизнес-логику. Единственный добавленный файл — этот отчёт.

---

## 3. Сильные стороны архитектуры

### 3.1 Local-first выбран осознанно

Данные хранятся в IndexedDB через Dexie, приложение не зависит от backend и остаётся пригодным для статического хостинга. Для персонального productivity-приложения это хорошая и экономичная модель.

### 3.2 Session engine реализован качественно

`src/db/sessions.ts` — наиболее зрелая часть кода:

- длительность вычисляется из timestamps, а не записывается каждую секунду;
- переходы `running → paused → running → completed` проверяются централизованно;
- старт сессии, проверка проекта/задачи и запись activity объединены транзакцией;
- проверяется принадлежность задачи проекту;
- есть защита от аномальной длительности;
- single-active-session проверяется внутри read/write transaction;
- модуль покрыт большим количеством unit/integration тестов.

Это правильный пример того, как должны быть устроены остальные доменные сервисы ALTERA.

### 3.3 Транзакции используются не формально

Создание проектов/задач, обновление progress, permanent delete заметок и ресурсов, backup import и очистка данных выполняются внутри Dexie transactions. Это существенно снижает риск частично применённых операций.

### 3.4 Есть базовые механизмы целостности

- При создании задачи проверяется существование проекта.
- Нельзя удалить проект с активной сессией.
- Редактирование заметки поддерживает optimistic revision check.
- Permanent delete notes/resources удаляет их tag assignments и entity links.
- Duplicate tags и entity links частично контролируются.

### 3.5 Безопасный вывод rich text продуман

Перед `dangerouslySetInnerHTML` текст экранируется, а ссылки проходят `sanitizeUrl`. В `urlSecurity.ts` разрешены только `http:` и `https:`, опасные схемы блокируются. Это заметно лучше обычной прямой вставки HTML.

### 3.6 Хорошо начат слой тестирования

Тесты покрывают:

- session state machine;
- DB CRUD и import/export сценарии;
- knowledge CRUD;
- relationships;
- notes/resources/attachments;
- pure search ranking;
- editor transforms;
- project/knowledge integration helpers.

Количество тестов уже достаточно велико, чтобы безопасно начать рефакторинг.

### 3.7 Route-level code splitting уже есть

Страницы загружаются через `React.lazy`. Это правильная основа bundle architecture, и её нужно сохранить.

### 3.8 UI primitives не изобретены заново

Диалоги, dropdown, tooltip, checkbox и select опираются на Radix UI. Это уменьшает количество accessibility и focus-management ошибок.

---

## 4. Критические и высокоприоритетные проблемы

## P0-1. Knowledge Hub входит в цикл обновлений React

**Статус: исправлено (Critical Fix 1/3, 2026-10-25).** Описание ниже фиксирует первоначальную причину.

**Файлы:**

- `src/pages/KnowledgeHub.tsx:38–68`
- `src/hooks/useKnowledge.ts:70–82`

**Что происходит**

Knowledge Hub одновременно хранит выбранную заметку:

1. в URL (`note` search param);
2. в локальном state `selectedNoteId`;
3. синхронизирует оба направления через два эффекта.

При автоселекте первой заметки:

1. `handleSelectNote` устанавливает локальный state и запускает `setSearchParams`;
2. до синхронизации location первый effect видит старый URL и сбрасывает state обратно;
3. второй effect снова выбирает первую заметку;
4. цикл повторяется.

Ситуацию усиливает `useNotes(...) ?? []`: до появления Dexie-результата создаётся новый массив на каждом render, а effect зависит от `allNotes`.

**Наблюдаемый результат**

В dev runtime воспроизводится `Maximum update depth exceeded`. Ошибка многократно появляется через `KnowledgeHub`/`AttachmentManager`, а detail view заметки может не открыться.

**Почему тесты не ловят**

Нет component integration test, который монтирует `KnowledgeHub` вместе с router и fake IndexedDB.

**Что было исправлено и как**

- URL-параметр `note` стал единственным источником выбранной заметки; независимое локальное состояние выбора удалено.
- Автовыбор ожидает завершения загрузки Dexie, сохраняет валидный явно указанный ID и обрабатывает отсутствующие/удалённые заметки без циклических переходов.
- Нестабильные fallback-массивы в релевантных Knowledge hooks заменены стабильными значениями.
- Добавлен набор policy-тестов `src/pages/knowledgeHubSelection.test.ts` (8 проверок); переход по URL и Back/Forward также проверены в браузере.

**Что осталось**

- Постоянного React component integration test с router и изолированной IndexedDB нет: текущая конфигурация Vitest не предоставляет DOM-среду. Реальный экран проверен вручную через Playwright, но эта проверка не является автоматическим тестом в CI.

---

## P0-2. Часть команд Command Palette фактически не работает

**Статус: исправлено (Critical Fix 3/3, 2026-10-25).** Описание ниже фиксирует первоначальные дефекты.

**Файлы:**

- `src/components/search/CommandPalette.tsx:213–274`
- `src/components/search/CommandPalette.tsx:382–404`
- `src/pages/KnowledgeHub.tsx:30–33`

### Ошибка маршрутизации note/resource

Command Palette открывает:

- `/knowledge?tab=notes&id=...`
- `/knowledge?tab=resources&id=...`

Но Knowledge Hub читает заметку из параметра `note`, а параметр `id` вообще не обрабатывает. В результате результат поиска не открывает выбранную заметку. Для ресурса нет согласованного URL contract.

### Ошибка quick actions

Команды создают global events:

- `altera:create-note`;
- `altera:create-resource`;
- `altera:start-session`.

После этого выполняется навигация. В целевых страницах нет listeners или обработки `action=create-*`. Event отправляется до монтирования страницы и теряется.

**Что было исправлено и как**

- Добавлены typed helpers в `src/lib/appRoutes.ts`. Контракт выбора: `/projects/:projectId`, `/projects/:projectId?task=:taskId` (fallback `/my-tasks?task=:taskId`), `/sessions?session=:sessionId`, `/knowledge?tab=notes&note=:noteId` и `/knowledge?tab=resources&resource=:resourceId`.
- Команды Create Note, Add Resource и Start Session теперь передают intent в URL. Страница назначения открывает существующий диалог один раз и удаляет `action` через history replace. New Project использует уже смонтированный глобальный Zustand-диалог. Fire-and-forget события для этих действий удалены.
- Resource открывается через существующий detail modal; Session — через detail dialog; Task переводит проект на вкладку задач, сбрасывает статусный фильтр, прокручивает и подсвечивает строку. Для удалённых/отсутствующих target ID stale-параметры очищаются.
- Добавлены 3 unit-теста контрактов маршрутов в `src/lib/appRoutes.test.ts`. Playwright подтвердил открытие результатов пяти типов, быстрых команд, прямого `action=start`, Back/Forward и очистку отсутствующих ID; диалоги создания были отменены без записи новых данных.

**Что осталось**

- Playwright-проверки пользовательских переходов проведены вручную; отдельного автоматически запускаемого E2E-набора в репозитории нет. Search ranking и клавиатурная модель не менялись и не переписывались.

---

## P0-3. Autosave редактора может конфликтовать сам с собой и терять изменения

**Статус: исправлено в рамках локальных клиентских гарантий (Critical Fix 2/3, 2026-10-25).** Исходные наблюдения ниже относятся к коду до исправления.

**Файлы:**

- `src/components/knowledge/editor/NoteEditor.tsx:196–307`
- `src/components/knowledge/notes/NoteDetail.tsx:114–152`
- `src/db/knowledge.ts:440–479`

**Проблемы**

1. Несколько `performSave` могут выполняться параллельно.
2. Оба запроса способны начать с одного `expectedRevision`.
3. Более поздний запрос получит stale-write conflict, даже если это изменения того же editor instance.
4. При unmount выполняется fire-and-forget `onSaveRef.current?.(...)`; Promise не ожидается и ошибка не обрабатывается.
5. `revision` и `expectedRevision` инициализируются один раз и не синхронизируются с внешним `note.revision`.
6. Изменение title/project/favorite увеличивает revision через отдельный `updateNote`, но editor остаётся на старой revision. Следующий autosave может получить ложный conflict.
7. После неудачной записи пользователь видит только generic `Failed`, но очередь изменений не имеет гарантированного retry/rebase.

**Риск**

Потеря последних изменений, ложные конфликты, непредсказуемое поведение при быстром вводе, переключении заметок или закрытии вкладки.

**Что было исправлено и как**

- В `saveCoordinator` сериализованы записи: одновременно выполняется одна; новые snapshots во время записи коалесцируются до последнего, не подтверждённые данные остаются доступными для retry.
- Координатор note updates сериализует metadata и content writes. Успешная запись передаёт editor актуальную revision; устаревшая запись из другой вкладки остаётся конфликтом и не перезаписывается принудительно.
- Добавлено восстановление черновика в `localStorage` с fallback на `sessionStorage`, заметными состояниями ошибки и действиями копирования/скачивания при невозможности автоматического восстановления. Flush при уходе/скрытии вкладки — best effort.
- Добавлены controlled-write и recovery проверки: `saveCoordinator.test.ts` (6), `noteUpdateCoordinator.test.ts` (7), `draftRecovery.test.ts` (5). Playwright проверил фактическое сохранение текста/заголовка после reload.

**Что осталось / границы гарантии**

- Нельзя гарантировать завершение IndexedDB-записи при force-close браузера, аварии процесса или отключении питания. При заблокированных `localStorage` и `sessionStorage` восстановление ограничивается ручными copy/download действиями, если редактор успевает их показать.
- Для внешнего конкурентного изменения корректно сохраняется conflict вместо слепой перезаписи; пользователю может потребоваться вручную объединить восстановленный черновик с новой версией.
- Автоматического полноценного browser E2E-набора для переключения заметок, reload и внешнего конфликта нет; покрытие состоит из unit/service тестов и проведённых Playwright smoke checks.

---

## P1-1. Wipe не является постоянным удалением данных

**Статус: исправлено в текущей рабочей копии.** `initialized` хранится отдельно в `metadata`; wipe атомарно очищает пользовательские таблицы и сохраняет marker, поэтому стартовая инициализация не считает пустую базу новой. `src/__tests__/initialization.test.ts` проверяет wipe → закрытие/повторное открытие → отсутствие reseed.

**Файлы:**

- `src/pages/Settings.tsx:93–115`
- `src/db/seed.ts:1266–1270`
- `src/App.tsx:42–49`

`handleWipeAll()` действительно очищает все таблицы. Но на следующем запуске `ensureDatabaseSeeded()` проверит `projects.count() === 0` и снова полностью заполнит базу демо-данными.

Для пользователя действие «wipe all» обещает пустое workspace, но пустое состояние не сохраняется после reload.

**Что менять**

- Разделить `firstRunInitialization` и `resetDemoData`.
- Хранить marker, что onboarding/initial seed уже выполнен.
- Wipe должен устанавливать marker `initialized=true`, оставляя пустую БД.
- Не использовать наличие проектов как маркер версии/инициализации.
- Добавить тест: wipe → recreate app → DB остаётся пустой.

---

## P1-2. Неполная каскадная очистка создаёт «сиротские» записи

**Статус: исправлено по выбранной политике удаления (2026-10-26).** Описание ниже фиксирует исходное поведение.

**Файлы:**

- `src/db/db.ts:235–253` — delete project;
- `src/db/db.ts:328–341` — delete task;
- `src/db/knowledge.ts:559–589` — delete note;
- `src/db/knowledge.ts:831–866` — delete resource.

`deleteProject` удаляет tasks, activities и project, но:

- completed sessions остаются с `projectId` удалённого проекта;
- notes/resources продолжают ссылаться на удалённый project;
- entityLinks, где project является source/target, не удаляются;
- tag assignments/entity links задач проекта могут остаться;
- attachments могут стать недостижимыми.

`deleteTask` не очищает entity links и не определяет поведение связанных sessions.

Dexie не обеспечивает foreign keys автоматически, поэтому целостность должна быть реализована в доменном сервисе.

**Что было исправлено и как**

- `deleteProject` теперь выполняет очистку графа одной Dexie-транзакцией по затронутым таблицам. Удаление проекта с незавершённой сессией блокируется.
- Завершённые сессии сохраняются как история: к записи добавляется `projectSnapshot` (ID, название, identifier), а ссылка на задачу удаляется. Историческая информация показывается в деталях и в списке сессий; поиск учитывает snapshot.
- Заметки и ресурсы отвязываются от проекта без удаления их содержимого. Revision заметки увеличивается, чтобы открытый редактор не записал поверх изменения с устаревшей revision. Вложения, связанные с сохранёнными file-ресурсами, остаются на месте.
- Удаление проекта очищает project/task tag assignments, entity links и project activities вместе с задачами и проектом. `deleteTask` отвязывает связанные сессии и activities, удаляет теги и связи задачи, затем записывает task-deleted activity атомарно. Удаление сессии также очищает её теги и entity links.
- Backup validator/import принимают завершённую сессию с историческим `projectSnapshot` и отсутствующим проектом. Добавлен `graphCleanup.test.ts`: проверяются сохранение заметок, ресурсов и attachment blob, snapshot сессии, транзакционный rollback, входящие/исходящие task links и JSON round-trip через реальный `importBackup`.

**Что осталось**

- Очистка реализована в доменных операциях `deleteProject`, `deleteTask` и `deleteSession`, а не вынесена в универсальный `deleteProjectGraph` policy engine. `inspectDatabaseIntegrity()` выявляет orphan references, но не исправляет их автоматически и пока не имеет UI для просмотра.
- Интеграционные проверки покрывают основные типы связей и round-trip snapshot/вложения, но не исчерпывают все сочетания сущностей и повреждённых исторических данных.

---

## P1-3. Entity links не проверяли существование связанных entities

**Статус: исправлено (2026-10-26).** Исходная проблема была в том, что `createEntityLink` принимал отсутствующие source/target и считал дублем любую пару одинаковых raw ID без учёта entity types. Пять старых tag-assignment tests также использовали fixtures без реальных сущностей после добавления `assertEntityExists`.

**Что исправлено**

- `createEntityLink` теперь проверяет source и target через entity registry внутри read/write транзакции по таблицам БД; missing endpoint отклоняется до записи.
- Дубликат определяется четырьмя полями (`sourceType`, `sourceId`, `targetType`, `targetId`). Конкурентная вставка защищена уникальным составным индексом и преобразуется в `DuplicateEntityLinkError`.
- Dexie v5 добавляет typed index и схлопывает только полностью идентичные legacy links, сохраняя запись с самым ранним `createdAt`; Dexie v6 объявляет этот индекс уникальным. Проверено, что существующий v4 link сохраняется при upgrade.
- Backup validation проверяет обе стороны связи и уникальность именно typed edge. Fixtures relationship/project integration tests создают реальные сущности вместо фиктивных ID.
- Добавлены проверки missing source/target, совпадающих raw ID при разных types, параллельных дубль-запросов, legacy migration и backup validation.

**Обновление 2026-10-26:** read-only сканирование можно запустить в Settings; найденные ссылки/IDs отображаются без автоматических изменений. Автоматические repairs намеренно не выполняются, чтобы не затрагивать пользовательские данные без подтверждения.

---

## P1-4. Backup validation покрывает основной контракт, но не миграцию формата

**Файл:** `src/pages/Settings.tsx:210–340`

**Статус: частично устранено в текущей рабочей копии.** `Settings.tsx` вызывает `validateBackup` до подтверждения импорта, а `importBackup` повторно валидирует данные перед транзакцией. Runtime validation проверяет обязательные поля и enum, даты, уникальность IDs/identifiers/tags/typed links, ссылки между сущностями, ограничения сессий, row limit, размер вложений, MIME и фактическую длину blob. Размер файла ограничен 50 MB до чтения; import атомарен и восстанавливает даты и Blob.

**Риски**

- Только backup schemaVersion 3 поддерживается; import migration для будущих/старых форматов не реализована.
- JSON размером до 50 MB всё ещё полностью читается и парсится в памяти; лимит снижает, но не исключает пик памяти на слабых устройствах.
- Проверка формата не заменяет domain-specific validation всех будущих полей и ссылок; валидатор нужно обновлять вместе с моделями.

**Что осталось**

- Добавить versioned backup migrations при необходимости поддерживать другие форматы.
- Рассмотреть потоковый/worker-based parse для крупных файлов и расширить domain-specific проверки по мере роста схемы.

---

## P1-5. Ошибка инициализации БД скрывается, приложение продолжает работу

**Статус: основной риск исправлен; recovery улучшен 2026-10-26.** `App` использует состояния `loading | ready | failed`, не переводит UI в ready после сбоя, показывает retry; `main.tsx` оборачивает приложение в root `AppErrorBoundary`. Recovery screen теперь также экспортирует структурированный JSON только с кодом отказа и временем генерации; raw exception и пользовательские записи не включаются. «Open empty workspace» не добавлено намеренно: при ошибке старта это могло бы замаскировать повреждение/недоступность базы.

**Файл:** `src/App.tsx:42–49`

Если `ensureDatabaseSeeded()` падает, ошибка логируется, но `isInitialized` всё равно становится `true`. Пользователь получает UI, который может быть частично неработоспособен, без recovery screen.

**Что менять**

- Хранить состояния `loading | ready | failed`.
- Показывать ошибку и действия `Retry`, `Export diagnostics`, `Open empty workspace`.
- Добавить верхнеуровневый React Error Boundary.
- Логировать структурированные ошибки без пользовательских данных.

---

## 5. Средний приоритет

## P2-1. TypeScript работает не в strict mode

**Статус: исправлено 2026-10-26.** `tsconfig.app.json` и `tsconfig.node.json` включают `strict: true`; оба проекта проверены в strict mode. Explicit `any` в production i18n lookup заменён безопасным `unknown` + узкой проверкой object.

**Файл:** `tsconfig.app.json`

На момент первичного аудита отсутствовал `"strict": true`, а production i18n lookup содержал явные `any`. Сейчас strict включён и эти `any` убраны. `noUncheckedIndexedAccess` не включён: это дополнительный флаг вне стандартного `strict`, его можно рассмотреть отдельно после оценки дополнительных diagnostic errors.

---

## P2-2. Несколько модулей превратились в «god files»

Самые крупные production-файлы:

| Файл | Строк |
|---|---:|
| `NoteEditor.tsx` | 1376 |
| `seed.ts` | 1271 |
| `ProjectWorkspace.tsx` | 1045 |
| `knowledge.ts` | 1027 |
| `CommandPalette.tsx` | 900 |
| `Settings.tsx` | 852 |
| `searchUtils.ts` | 833 |
| `NoteDetail.tsx` | 657 |
| `EditorToolbar.tsx` | 606 |

Это ухудшает:

- reviewability;
- ownership;
- regression isolation;
- возможность lazy loading;
- тестирование отдельных lifecycle;
- работу AI-инструментов, которые начинают менять слишком широкий контекст.

**Рекомендация по разбиению**

- `NoteEditor`: document model, selection adapter, autosave controller, block renderers, slash menu.
- `knowledge.ts`: tags, attachments, notes, resources, links, integrity.
- `Settings`: backup panel/service, storage stats, language, appearance, destructive actions.
- `ProjectWorkspace`: header, continuity, task tab, session tab, activity tab, knowledge tab.
- `CommandPalette`: commands registry, results renderer, keyboard controller, dialog shell.

---

## P2-3. Глобальный поиск загружается и подписывается всегда

**Статус: подписка и загрузка исправлены 2026-10-26.** `useSearch` получает `enabled: isOpen`, а Command Palette теперь импортируется отдельным lazy chunk только после первого вызова через `Ctrl/Cmd+K`, `/` или кнопку. Браузерная проверка подтвердила, что chunk отсутствует до вызова и загружается при открытии. Последний измеренный initial JS chunk — 359.54 kB raw (113.99 kB gzip), отдельный Command Palette — 27.56 kB raw (7.82 kB gzip); это размеры данного build, не универсальный бюджет.

**Файлы:**

- `src/App.tsx:5, 127–128`
- `src/components/search/useSearch.ts:37–74`
- `src/components/search/CommandPalette.tsx`

Хотя страницы lazy-loaded, `CommandPalette` импортируется синхронно в основной bundle и всегда mounted. `useSearchData()` подписывается сразу на projects/tasks/sessions/notes/resources и загружает все таблицы, даже если пользователь никогда не открывает поиск.

Текущий production output показывает крупные чанки:

- main JS около **404 KB**;
- dialog chunk около **215 KB**;
- relationships chunk около **180 KB**;
- CSS около **78 KB**.

**Что менять по Vercel React guidance**

- Lazy-load command palette при первом Ctrl/Cmd+K или клике.
- Не запускать Dexie search subscription, пока palette закрыта.
- Избегать barrel import в глобальном entry, импортировать компонент напрямую.
- При росте данных создать нормализованный search index или incremental tokens.
- Добавить bundle budget и visualizer в CI.

---

## P2-4. Поиск и knowledge queries делают full-table scans

**Статус: частично исправлено 2026-10-26.** Dexie v7 добавляет простые `projectId` indexes для notes/resources, а scoped queries и счётчики проекта используют их. Статистика сессий получает completed rows через существующий `status` index и отдельно вызывает IndexedDB `count()` для общего числа. Глобальный поиск, unscoped knowledge counts, recent sessions и вычисление следующего project identifier по-прежнему читают/сканируют коллекции целиком; отдельный search index не создавался.

Примеры:

- `getActiveNotes` и `getActiveResources` сначала читают массив, потом фильтруют;
- `getKnowledgeCounts` читает все notes/resources;
- global search читает все пять таблиц;
- session statistics читает все sessions;
- `getNextProjectIdentifier` сканирует все проекты.

Для текущего demo объёма это нормально. При сотнях/тысячах notes и attachments начнут расти задержки и число rerender.

**Что менять**

- Индексы `projectId` для notes/resources добавлены отдельной миграцией v7; compound indexes добавлять только под конкретные профилированные запросы.
- Использовать Dexie collections/index queries до `toArray()`.
- Кэшировать агрегаты или вычислять их инкрементально.
- Для глобального поиска использовать отдельный lightweight индекс без blob/contentJSON.

---

## P2-5. Нестабильные fallback values создают лишние rerender/effect triggers

**Файл:** `src/hooks/useKnowledge.ts`

Hooks возвращают литералы `[]`, `{...}` после `??`. До готовности query это новые references на каждый render. `useEntityLinks` и `useKnowledgeCounts` имеют ту же проблему.

`useSearchData` каждый раз возвращает новый aggregate object, поэтому `useMemo` в `useSearch` пересчитывается даже при неизменных данных. Кроме того, `isReady` фактически всегда `true`, потому что в `useLiveQuery` передан default result.

**Что менять**

- Module-level immutable empty constants.
- Стабилизировать aggregate object через `useMemo`.
- Отдельно хранить/вычислять реальный loading state.
- Не использовать effects для derived state.

---

## P2-6. Custom editor опирается на deprecated browser API

**Файл:** `src/components/knowledge/editor/NoteEditor.tsx:380–460`

Редактор использует `document.execCommand` и вручную изменяет DOM selection/ranges. `execCommand` deprecated, а ручная синхронизация DOM → JSON чрезвычайно чувствительна к browser differences, IME, paste, undo и mobile selection.

Комментарий в UI называет редактор TipTap, но фактически это собственная реализация. Это создаёт неверные ожидания при сопровождении.

**Варианты**

1. Если rich text — стратегическая функция, перейти на TipTap/ProseMirror/Lexical.
2. Если нужна простота — оставить Markdown textarea с preview.
3. Если custom editor остаётся — выделить DOM adapter и покрыть Playwright тестами Chrome/Edge, paste, IME, tables, undo/redo.

---

## P2-7. Локализация неполная и нет типобезопасных ключей

**Файлы:**

- `src/i18n/index.tsx:9, 22`
- множество pages/components.

Плюсы: есть provider, fallback и сохранение языка.

Минусы:

- translations и nested traversal используют `any`;
- ключи — произвольные строки;
- десятки UI-строк захардкожены на английском;
- fallback скрывает пропущенный перевод;
- command palette почти полностью английская;
- `index.html` начинает с `lang="en"`, затем исправляется effect.

**Что менять**

- Генерировать union keys из RU master dictionary.
- Добавить тест равенства структуры RU/EN.
- Убрать hardcoded user-facing text.
- В dev отображать предупреждение о missing key.
- Определять initial language до первого paint.

---

## P2-8. Offline-capable приложение зависит от Google Fonts

**Файл:** `index.html`

При отсутствии сети шрифты не загрузятся. Это не ломает данные, но нарушает заявленный polished offline experience, меняет метрики layout и отправляет запросы Google.

**Что менять**

- Self-host `.woff2` с ограниченным набором weights/subsets.
- Добавить preload только критического шрифта.
- Проверить лицензию и fallback metrics.
- Определить CSP для production hosting.

---

## P2-9. Command Palette имеет неполную accessibility-модель

**Статус: combobox/listbox контракт исправлен 2026-10-26.** Поиск теперь явно связывает combobox с listbox и активным option через ARIA IDREF; options сгруппированы и имеют стабильные IDs. Команды, скрытые выбранным entity-фильтром, исключены из keyboard-навигации. Проверено в Playwright при 390×844: active descendant всегда указывает на существующую option, document horizontal overflow отсутствует. Полный axe/screen-reader audit остаётся отдельной задачей.

Options размечены `role="option"`, но input не оформлен полноценным combobox:

- нет `role="combobox"`;
- нет `aria-controls`;
- нет `aria-activedescendant`;
- options — click-able `div`, сами не keyboard-focusable;
- active option не имеет стабильного DOM id для screen reader.

Стрелочная навигация программно работает, но assistive technology получает неполную модель.

**Что менять**

- Реализовать ARIA combobox/listbox pattern полностью.
- Либо использовать проверенный cmdk/Radix-compatible primitive.
- Добавить axe и keyboard E2E тест.

---

## P2-10. Нет CI и обязательных quality gates

В репозитории не обнаружен `.github/workflows` или другой CI pipeline.

**Минимальный pipeline**

1. clean install (`npm ci`);
2. TypeScript;
3. lint with zero errors and controlled warnings;
4. unit/integration tests;
5. production build;
6. Playwright smoke tests;
7. bundle-size check;
8. upload test/build artifacts.

---

## 6. Низкий приоритет и технический долг

### P3-1. Документация устарела

README утверждал, что wipe очищает «all four tables», хотя таблиц уже десять. Исправлено в малом follow-up проходе: описание продукта теперь упоминает Knowledge Hub, перечисляет все десять таблиц и корректно описывает очистку.

### P3-2. Version metadata неинформативна

`package.json` по-прежнему содержит `0.0.0`; назначение release version требует решения владельца. Метка в Settings, которая раньше ошибочно показывала Schema v3, обновлена до действующей schema v7. App release version и DB schema version остаются независимыми.

### P3-3. Seed data занимает 1271 строк production-кода

Демо-датасет полезен, но его лучше хранить в JSON/fixtures и загружать только для onboarding/reset. Сейчас он усложняет основной код и bundle/build processing.

### P3-4. Остались шаблонные assets/files

Неиспользуемые `src/assets/react.svg`, `src/assets/vite.svg` и `src/App.css` удалены в малом follow-up проходе после проверки, что проект на них не ссылается.

### P3-5. Ошибки часто только логируются

Во многих knowledge components ошибки уходят в `console.error`, без единого toast/error boundary/telemetry contract. Нужен единый user-safe error presenter.

### P3-6. Глобальные CustomEvent создают скрытые связи

Строки событий не типизированы, не централизованы и зависят от порядка mount. Если event bus остаётся, нужны typed event map и persistent intent semantics.

### P3-7. Линтер уже показывает архитектурные сигналы

15 warnings включают:

- state updates in effects;
- unstable KnowledgeHub effect dependencies;
- чтение/запись refs во время render;
- смешивание component и utility exports в i18n.

Warnings сейчас не блокируют CI, поэтому реальные проблемы накапливаются.

---

## 7. Проблемы схемы и миграций IndexedDB

### Хорошо

- Старые версии схемы не переписываются.
- v2/v3 добавлены последовательно.
- Таблицы типизированы.
- Write flows используют transactions.

### Актуальное состояние после исправлений

- В v4 добавлена metadata table и marker первой инициализации; новая версия не считает пустые пользовательские базы новыми.
- v5/v6 обеспечивают type-aware уникальность entity links; v7 добавляет projectId indexes для notes/resources.
- Политики delete зафиксированы в сервисах для project/task/session и проверяются integration-тестами; не все комбинации повреждённых исторических данных покрыты.
- `inspectDatabaseIntegrity()` — read-only scanner. Он не выполняет repair и пока не имеет UI.
- В metadata пока нет полного migration history (`createdAt`, `lastMigrationAt`, import format history); backup schemaVersion 3 остаётся отдельным контрактом.

---

## 8. Оценка тестовой стратегии

### Что уже хорошо (текущее состояние)

- 280 тестов проходят в 20 suites.
- Используется `fake-indexeddb`.
- Session engine покрыт особенно хорошо.
- Есть проверки security URL helpers и pure editor transforms.
- Есть import/export-oriented database test.

### Главные пробелы

Непокрыты или проверены вручную, но не автоматизированы:

- mount `App` и initialization failure;
- `KnowledgeHub` + Router + live query;
- автоселект первой заметки;
- command palette routes/actions;
- note editor autosave queue;
- title update + expected revision;
- initialization failure и export diagnostics UI;
- автоматизированный browser scenario lazy Command Palette / ARIA (проверен вручную через Playwright в этом проходе);
- wipe + reload и project/task cascade deletion в Playwright (есть fake-IndexedDB integration tests);
- browser-level backup runtime validation;
- mobile navigation;
- language switching по всем ключевым экранам;
- keyboard/ARIA behavior;
- offline font/network behavior.

### Рекомендуемая пирамида

- Pure unit tests: сохранить.
- Dexie service integration tests: расширить integrity/cascade/import.
- React Testing Library: hooks/pages with MemoryRouter and fake IndexedDB.
- Playwright: 8–12 критических user journeys.
- Отдельный regression test на каждый найденный P0/P1 bug.

---

## 9. Рекомендуемая целевая архитектура

Не требуется microservices или Redux. Для масштаба ALTERA достаточно модульного local-first frontend.

```text
src/
  app/
    router.tsx
    providers.tsx
    error-boundary.tsx
    initialization.ts
  db/
    schema.ts
    migrations/
    metadata.repository.ts
    integrity.service.ts
  features/
    projects/
      project.types.ts
      project.repository.ts
      project.service.ts
      project.hooks.ts
      ui/
    tasks/
    sessions/
    knowledge/
      notes/
      resources/
      tags/
      links/
      attachments/
      editor/
    search/
    backup/
  shared/
    ui/
    i18n/
    errors/
    utils/
```

### Правила границ

- UI не пишет напрямую в `db.*`.
- Repository отвечает за Dexie query/write.
- Service отвечает за транзакции, policies и invariants.
- Hooks только связывают React и services/repositories.
- Route params и command intents имеют единые типы/builders.
- Cross-entity delete выполняется только integrity service.
- Backup import проходит runtime validation до transaction.

---

## 10. План исправления для Antigravity

## Этап 0 — сохранить состояние

Перед любыми исправлениями:

1. Сделать копию текущей папки или Git snapshot.
2. Разобраться с большим незакоммиченным diff.
3. Создать отдельную ветку/commit baseline.
4. Зафиксировать текущие 224 passing tests.
5. Не смешивать визуальный redesign и data-layer fixes в одном commit.

## Этап 1 — P0 runtime bugs

1. Устранить duplicated selection state в KnowledgeHub.
2. Добавить integration test на отсутствие render loop.
3. Исправить typed route contract command palette.
4. Добавить E2E quick actions/search navigation.
5. Реализовать serial autosave queue.
6. Синхронизировать editor revision с результатом updateNote.

**Критерий завершения:** Knowledge Hub открывается без console errors; note autosave не теряет данные; все команды ведут в правильный UI.

## Этап 2 — данные и миграции

1. Добавить metadata/initialization marker.
2. Исправить wipe semantics.
3. Спроектировать deletion policies.
4. Реализовать cascade/integrity service.
5. Добавить v4 indexes и unique entity-link key.
6. Добавить integrity repair/report tool.

**Критерий завершения:** после delete/import/wipe не остаются неожиданные orphan records.

## Этап 3 — backup и error handling

1. Typed runtime validation backup.
2. Size/record/blob limits.
3. Versioned backup migrations.
4. Initialization error screen.
5. App-level Error Boundary.
6. Единый error/toast contract.

## Этап 4 — структурный рефакторинг

1. Разделить NoteEditor.
2. Разделить knowledge service.
3. Вынести backup из Settings.
4. Разделить ProjectWorkspace и CommandPalette.
5. Включать strict TypeScript постепенно.

Важно: структурный рефакторинг делать после regression tests, иначе будет сложно отличить старые баги от новых.

## Этап 5 — performance и production

1. Lazy-load command palette.
2. Не подписываться на search data до открытия.
3. Добавить IndexedDB indexes.
4. Self-host fonts.
5. Добавить CI, bundle budget и Playwright.
6. Завершить typed i18n.

---

## 11. Что не нужно делать

- Не переписывать приложение целиком.
- Не заменять Dexie без конкретной причины.
- Не добавлять backend только ради «правильной архитектуры».
- Не внедрять Redux поверх Dexie live queries.
- Не чинить все lint warnings механически без понимания lifecycle.
- Не менять старые Dexie schema versions; добавлять новую migration.
- Не объединять UI redesign, schema migration и editor rewrite в один PR.
- Не удалять passing tests при рефакторинге.

---

## 12. Итоговый приоритет найденных проблем

| ID | Приоритет | Проблема | Риск |
|---|---|---|---|
| P0-1 | Критический | Knowledge Hub render loop | Исправлено: URL source of truth, загрузка/автоселект стабилизированы; остаётся automated component-test gap |
| P0-2 | Критический | Broken command routes/actions | Исправлено: typed routes + одноразовые URL intents; остаётся автоматизировать Playwright E2E в CI |
| P0-3 | Критический | Autosave/revision race | Исправлено: serial coordinator, revisions, draft recovery; force-close браузера не может быть гарантирован |
| P1-1 | Высокий | Wipe заново seed-ит данные | Исправлено: persisted `initialized` marker; wipe → reopen остаётся пустым |
| P1-2 | Высокий | Неполный cascade delete | Исправлено по политике snapshot истории + detach знаний; read-only scan доступен в Settings, автоисправления нет |
| P1-3 | Высокий | Links не проверяют entities | Исправлено: обе стороны валидируются, typed key уникален; результаты read-only сканера доступны в Settings |
| P1-4 | Высокий | Слабая backup validation | Частично исправлено: runtime validation и лимиты работают; нет миграций форматов и streaming parse |
| P1-5 | Высокий | Initialization error скрывается | Исправлено: loading/ready/failed, retry, root Error Boundary и safe diagnostics export; empty mode намеренно не открывается |
| P2-1 | Средний | TypeScript strict выключен | Исправлено: `strict: true` в app/Vite проектах, i18n lookup типизирован через `unknown`; build проверяет оба |
| P2-2 | Средний | Мегамодули 850–1376 строк | Осталось; отдельная задача |
| P2-3 | Средний | Search eager-loaded | Исправлено: lazy chunk и подписка IndexedDB только при открытой палитре; браузер проверил первое открытие |
| P2-4 | Средний | Full-table scans | Частично исправлено: project scoped knowledge queries используют новые indexes v7; global search и агрегаты остаются без отдельного индекса |
| P2-5 | Средний | Нестабильные hook values | Исправлено в `useKnowledge`; readiness search query отражает реальную загрузку |
| P2-6 | Средний | Deprecated editor APIs | Осталось; отдельная задача |
| P2-7 | Средний | Неполная локализация | Частично исправлено: `t()` принимает только ключи каталога ru, RU/EN ключи и interpolation placeholders сверяются тестом; статические строки в интерфейсе ещё остались |
| P2-8 | Средний | Google Fonts online dependency | Осталось; отдельная задача |
| P2-9 | Средний | Command palette ARIA gaps | Исправлено: combobox/listbox/active option IDREF; Playwright проверил desktop и 390px viewport |
| P2-10 | Средний | Нет CI gates | Частично исправлено: CI запускает install/tests/lint/build и проверку bundle budget; автоматические Playwright E2E в CI ещё не подключены, удалённый запуск workflow не подтверждён |

---

## 13. Финальная оценка

ALTERA не нуждается в новом фундаменте. Самые ценные части — session service, транзакционная модель, rich domain entities и тесты — стоит сохранить.

Основная задача следующего этапа: **сделать интеграционные контракты явными**:

- URL ↔ selection;
- editor ↔ revision service;
- command ↔ route/action;
- delete ↔ dependency policy;
- backup JSON ↔ runtime schema;
- first run ↔ empty workspace.

После исправления этих границ можно безопасно заниматься производительностью и декомпозицией. До исправления P0/P1 расширять Knowledge Hub новыми возможностями не рекомендуется: текущая сложность уже превышает надёжность интеграционного слоя.

---

## 14. Малый проход исправлений — 2026-10-25

Выполнены две низкорисковые задачи из P3:

1. **Обновлена `README.md`.** В краткое описание добавлен Knowledge Hub; в разделе о хранении перечислены все десять таблиц `AlteraDB`; описание wipe исправлено с четырёх таблиц на десять. Это устраняет расхождение документации с текущей схемой и кодом очистки.
2. **Удалены неиспользуемые файлы Vite/React-шаблона:** `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`. До удаления выполнен поиск ссылок по проекту; активных импортов или ссылок не обнаружено.

Другие P3 пункты не исправлялись в этом проходе: `0.0.0` требует решения о версии релиза; перенос seed-данных, общий контракт ошибок и централизация событий затрагивают архитектурные контракты и не являются безопасной однофайловой правкой. Пункты P0–P2 также оставлены без изменений.

В runtime-коде, бизнес-логике, IndexedDB, сервисах, схемах и механизмах сохранения изменений не сделано. После этих правок тесты и production build повторно не запускались: изменены только README, сам отчёт и файлы без ссылок из приложения.

## 15. Продолжение низкорисковых исправлений — 2026-10-26

1. **Пользовательский read-only integrity scan.** В Settings добавлена кнопка проверки и локализованный результат: состояние чистой базы, количество/список проблем, timestamp и ошибка проверки. Используется существующий `inspectDatabaseIntegrity()`, который читает данные в read-only транзакции и не исправляет/не переписывает записи. Это закрывает отсутствие UI для уже существовавшего сканера.
2. **CI quality gate.** Добавлен `.github/workflows/ci.yml`: Node 22, `npm ci`, `npm test`, `npm run lint`, `npm run build` для push и pull request. Сам удалённый GitHub workflow не выполнялся из локальной среды.
3. **Метка схемы в Settings.** Статус хранилища обновлён с устаревшей Schema v3 на текущую v7.
4. **Старые backup-форматы.** Пользователь подтвердил, что поддержки v1/v2 не требуется; импорт остаётся ограничен текущим schema v3. Потенциальная streaming-обработка JSON остаётся отдельным пределом для больших файлов, текущий лимит — 50 MB.

Проверки после этих изменений:

- `npm test -- --reporter=dot`: **20 файлов, 280/280 тестов прошли**.
- `npm run lint`: **exit 0**, 12 предупреждений в существующих местах; в изменённом Settings новых lint-предупреждений не появилось.
- `npm run build`: **успешно**, `tsc -b` и Vite, 2,126 модулей.
- `git diff --check`: **успешно**; Git вывел только существующие предупреждения о преобразовании LF/CRLF.
- Playwright: открыл Settings, запустил integrity scan, UI показал «Нарушенных связей не найдено» и timestamp; при ширине 390px `scrollWidth === clientWidth` (390), горизонтального переполнения нет.

Автоматический ремонт orphan-записей и реальный запуск GitHub Actions локально не заявляются. Пользователь подтвердил, что старые backup schema v1/v2 поддерживать не требуется; текущий экспорт/импорт остаётся schema v3.

## 16. Закрытие замечаний аудита Phase 4 и старт Phase 5 — 2026-10-26

### Исправлено по Phase 4

1. **Редактирование срока задачи.** В `TaskRow` добавлен локализованный date-picker для установки, изменения и снятия `dueDate`. Дата сохраняется существующим `updateTask`; время выставляется на местный полдень, чтобы не попадать в редкие зоны с переходом времени около полуночи.
2. **Переход по дедлайну из календаря месяца.** Нажатие на дедлайн теперь открывает существующую задачу через канонический task route, а не переключает календарь на день.
3. **Старт только из запланированного блока.** `startSession` проверяет `status === 'planned'` в той же транзакции чтения/создания сессии. Завершённый или отменённый блок больше не создаёт связанную сессию.
4. **Валидация дат backup.** Проверяется реальная календарная дата в ISO timestamp, а не только успешность `Date.parse`; невозможные даты вроде `2026-02-30` отклоняются до импорта.
5. **Диалог сессии.** Строки запуска локализованы на RU/EN; текстовые поля имеют label/id, а select-контролы связаны через `aria-labelledby`.

Добавлены проверки persistence/снятия срока, статуса календарного блока и impossible-date backup. Playwright использовал отдельный origin `127.0.0.1:5174` с изолированным IndexedDB: дедлайн задачи изменён и восстановлен к исходному demo-значению, month deadline открыл связанный task route, диалог сессии показал русские подписи и был закрыт без старта сессии. На viewport 390 px `documentElement.scrollWidth === innerWidth`; браузерная консоль — 0 ошибок. Пользовательская база на обычном origin не использовалась.

### Phase 5 — первые production/performance quality gates

- Уже до этого прохода были реализованы lazy-load Command Palette, отложенная подписка поиска, additive Dexie indexes, GitHub Actions quality workflow и ручные Playwright smoke checks.
- В этом проходе `t()` получил union валидных ключей из русского каталога; добавлен тест равенства RU/EN ключей и interpolation placeholders. TypeScript выявил три отсутствующих ключа (`dashboard.noNextAction`, `dashboard.recentActivity`, `dashboard.noActivity`), они добавлены в обе локали.
- Добавлен `npm run check:bundle` и шаг CI: измеряются initial JS/CSS по ссылкам production `dist/index.html` с gzip budget. Текущий baseline: JS 598,566 B raw / 188,461 B gzip; CSS 83,517 B raw / 13,568 B gzip.
- Остаются self-hosting web fonts и автоматические Playwright E2E в CI. Установка новых npm-пакетов не выполнялась: `npm ping --fetch-timeout=10000 --fetch-retries=0` завершился ETIMEDOUT к `registry.npmjs.org`, а `@playwright/test` отсутствует в локальных зависимостях. Внешний реальный пользовательский браузер прошёл smoke-check через доступный Playwright MCP.

Ограничение календарной геометрии в осенний день с повторённым локальным часом остаётся отдельным: текущая неделя визуализируется 24-часовой сеткой, выбор второго occurrence часа в форме отсутствует.
