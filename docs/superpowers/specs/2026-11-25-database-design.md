# notion2 資料庫（第一刀）

2026-11-25，Jeff 核准（「幹 幹爆」）。

## 為什麼

Notion 被一堆人用的原因就是資料庫：一份資料切成表格、看板來看，每一列點開又是一頁。
Docmost 把這個功能（Bases）鎖在付費企業版，伺服器端程式不在開源 repo，所以從零自己寫。
Jeff 自己不一定用，但要把它開發出來。

## 這一刀做什麼

- 在頁面裡打 `/資料庫`（`/database`）插入一個資料庫區塊。
- 欄位五種：文字、數字、單選、勾選、日期。另有一個固定的「名稱」欄（就是那一列的頁面標題）。
- 每一列是一個真的頁面，點開就是完整編輯器，標題下方顯示這一列的欄位。
- 同一份資料兩種看法：表格、看板（依某個單選欄分組，可拖卡片換組）。
- 貼 Notion 網址抓進來的資料庫變成這種真的資料庫。

## 不做

行事曆、公式、關聯、彙總、篩選、排序、多人即時同步（別人改了要重新整理才看到）、AI。

## 不能做的事（會讓這件事失敗）

- 不能用、不能抄 `apps/*/src/ee` 和 `packages/ee` 的程式（企業版授權）。也不沿用它的 `bases` 資料表。
- 列的頁面不能塞滿側欄。

## 做法

考慮過三種：

1. **列存成真的頁面，另外兩張表記資料庫和欄位值（採用）。** 列點開直接有完整編輯器、搜尋、歷史版本，全部免費拿到。代價是要在側欄查詢加一行把列的頁面藏起來。
2. 列只是一筆 JSON，點開用彈窗加簡易編輯器。不動原版查詢，但編輯器綁著協作伺服器，另開一個不是頁面的編輯器要重寫一大塊，而且「每一列是一頁」就做不到。
3. 資料直接存在編輯器區塊的屬性裡。最省事，但一份資料只能在一個地方、沒辦法給 API 讀寫、列一多整頁變慢。

### 資料

- `n2_databases`：`id, workspace_id, space_id, name, schema(jsonb), views(jsonb), creator_id, 時間戳, deleted_at`
  - `schema`：`[{ id, name, type: text|number|select|checkbox|date, options?: [{ id, name, color }] }]`
  - `views`：`[{ id, name, type: table|board, groupBy?: 欄位id }]`
- `n2_database_rows`：`id, database_id, page_id(唯一), values(jsonb: 欄位id → 值), position, 時間戳`
- 列的頁面放在空間最上層，側欄查詢排除「在 `n2_database_rows` 裡的頁面」。
- 權限跟著空間走：看得到空間就讀得到，能編輯頁面就能改。

### 接口（都要登入，照原版慣例全用 POST）

`/api/n2/databases/` 底下：`create`、`info`（含所有列）、`update`（名稱、欄位、看法）、`delete`、
`rows/create`、`rows/update`、`rows/delete`、`row-by-page`（這個頁面是不是某資料庫的一列）。

### 編輯器

新區塊 `n2Database`（屬性只有 `databaseId`），定義在 `packages/editor-ext`，前後端都註冊。
HTML 形式 `<div data-type="n2Database" data-database-id="…">`，所以匯入器可以直接產生。

### 畫面

`apps/client/src/notion2/database/`：資料庫區塊（名稱、表格/看板切換、新增）、表格、看板、各型別的儲存格、
列頁面上方的欄位區。

## 留給實作決定的

元件怎麼拆、樣式細節、顏色選項、拖曳怎麼做。
