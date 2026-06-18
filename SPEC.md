# 技術情報メモDB Phase0 仕様書

## 1. 目的

SupabaseのGetting Startedとして、技術情報を登録・一覧表示・検索できるシンプルなWebアプリを作成する。

将来的にはAI要約、RAG検索、PDF取り込みへ拡張するが、Phase0ではAI機能は実装しない。

---

## 2. アプリ名

AI Technical Notes DB

---

## 3. 技術スタック

- Frontend: Next.js
- Language: TypeScript
- Styling: Tailwind CSS
- Backend/DB: Supabase
- Authentication: なし
- Deployment: ローカル実行を優先

---

## 4. 主要機能

### 4.1 技術メモ登録

ユーザーは以下の項目を入力して技術メモを登録できる。

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| title | text | 必須 | 技術メモのタイトル |
| category | text | 任意 | 例: MuleSoft, Salesforce, AI, Supabase |
| tags | text[] | 任意 | カンマ区切りで入力し、配列として保存 |
| content | text | 必須 | 技術メモ本文 |
| source_url | text | 任意 | 参考URL |
| created_at | timestamp | 自動 | 作成日時 |
| updated_at | timestamp | 自動 | 更新日時 |

---

### 4.2 技術メモ一覧

- 登録済みメモを作成日時の降順で表示する
- 一覧には以下を表示する
  - title
  - category
  - tags
  - created_at
  - contentの先頭200文字程度

---

### 4.3 技術メモ詳細

- 一覧からメモを選択すると詳細を表示する
- 詳細画面には全項目を表示する

---

### 4.4 技術メモ検索

- キーワードで検索できる
- 検索対象:
  - title
  - content
  - category
  - tags
- Phase0ではPostgreSQLのLIKEまたはilike検索でよい

---

### 4.5 技術メモ削除

- 詳細画面または一覧から削除できる
- 削除前に確認ダイアログを表示する

---

## 5. 画面構成

### 5.1 Home画面

役割:
- 技術メモ登録フォーム
- 技術メモ検索ボックス
- 技術メモ一覧

構成:

```text
------------------------------------------------
AI Technical Notes DB

[検索ボックス] [検索ボタン] [クリア]

## New Note
Title
Category
Tags
Source URL
Content
[Save]

## Notes
- Note Card
- Note Card
- Note Card
------------------------------------------------
