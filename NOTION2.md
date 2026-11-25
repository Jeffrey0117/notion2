# notion2

自己版本的 Notion。底是 [Docmost](https://github.com/docmost/docmost)（AGPL-3.0）的 fork，
`upstream` remote 指向原版，要跟上游就 `git fetch upstream && git merge upstream/main`。

## 在本機跑

需要：Node 22、pnpm、PostgreSQL 16（只用它的執行檔，不碰系統那個資料庫服務）、
Windows 版 Redis（解壓到 `data\redis\`）。

第一次：

```
pnpm install
copy .env.example .env      （改 PORT、APP_SECRET、DATABASE_URL、REDIS_URL，加 HOST=127.0.0.1）
"%ProgramFiles%\PostgreSQL\16\bin\initdb.exe" -D data\pg -U notion2 -A trust -E UTF8 --locale=C
notion2-services.cmd
"%ProgramFiles%\PostgreSQL\16\bin\createdb.exe" -h 127.0.0.1 -p 5433 -U notion2 notion2
pnpm build
```

之後每次：

```
powershell Start-Process -WindowStyle Hidden notion2-start.cmd
```

- `notion2-services.cmd`：開 notion2 自己的 Postgres（5433）和 Redis（6380），只聽本機，重複跑沒關係。
- `notion2-start.cmd`：先開上面兩個，再跑 build 好的 app。log 在 `data\notion2.log`。
- 資料全部在 `data\`（不進 git）：`data\pg` 資料庫、`data\redis`、`data\storage` 上傳檔。
- 資料表在 app 啟動時自動建立與升級。

## 改程式

`pnpm dev`：前端即時更新、後端自動重啟。改完要讓平常用的那份吃到，`pnpm build` 後重開 `notion2-start.cmd`。

- 前端：`apps/client`（React、Mantine、Tiptap）
- 後端：`apps/server`（NestJS、Kysely）
- 編輯器擴充：`packages/editor-ext`

自己加的東西盡量放新檔案，少動原版檔案，之後合上游才不會一直衝突。

## 雷

- 這台機器的 cmd 不會在當前資料夾找指令，`.cmd` 之間互叫要寫 `"%~dp0檔名.cmd"`。
- `.cmd` 一定要 CRLF（`.gitattributes` 已設）。
- 從 Bash 直接跑 `pg_ctl start` 會卡住終端，用 `notion2-services.cmd`。
