# Clawdbot並列実行クラッシュFix実装プラン

**作成日**: 2026-01-25
**担当**: しきるん (Claude Code)
**GitHub Issue**: #93
**関連Issue**: #92 (調査レポート)

---

## 📋 概要

Clawdbotの並列実行時に発生するサービス再起動ループ (30回/3.2分間隔) を修正するための詳細実装プラン。

### 問題の要約

| 現象 | 頻度 | 影響 |
|------|------|------|
| Service Restart Loop | 30回/3.2分 | Discord切断、応答欠落 |
| Shutdown Timeout | 1回 | リソースリーク |
| Discordリアクション未完了 | 複数回 | UX低下 |

---

## 🎯 根本原因

### Primary Cause: Config Watcher過剰反応

1. **metaフィールドの循環更新**
   ```json
   "meta": {
     "lastTouchedAt": "2026-01-25T11:25:18.265Z",
     "lastTouchedVersion": "2026.1.24-0"
   }
   ```
   これらのメタデータが更新されるたびに、Config Watcherが変更検知 → 再起動トリガー → またメタデータ更新 (無限ループ)

2. **デバウンス時間不足**
   - 現行: 300ms
   - 問題: 並列実行時の複数Config更新を吸収しきれない

---

## 🔧 Fix設計

### Fix 1: metaフィールド無視ルール追加

**ファイル**: `src/gateway/config-reload.ts`

**変更内容**:
```diff
 const BASE_RELOAD_RULES_TAIL: ReloadRule[] = [
   { prefix: "identity", kind: "none" },
   { prefix: "wizard", kind: "none" },
   { prefix: "logging", kind: "none" },
+  { prefix: "meta", kind: "none" },      // FIX: meta.*フィールドの変更を無視
   { prefix: "models", kind: "none" },
   ...
```

**効果**:
- `meta.lastTouchedAt`, `meta.lastTouchedVersion` の変更が再起動をトリガーしなくなる
- ループが断ち切られる

### Fix 2: デバウンス時間延長

**変更内容**:
```diff
 const DEFAULT_RELOAD_SETTINGS: GatewayReloadSettings = {
   mode: "hybrid",
-  debounceMs: 300,
+  debounceMs: 5000,  // FIX: 300ms → 5000ms (並列実行時の複数更新を吸収)
 };
```

**効果**:
- 5秒間のConfig変更がまとめて処理される
- 並列実行時の複数エージェントによるConfig更新を1回に集約

---

## 📊 変更ファイル

| ファイル | 変更内容 | 行数 |
|---------|----------|------|
| `src/gateway/config-reload.ts` | metaルール追加 + debounceMs変更 | 2箇所 |

---

## 🧪 検証計画

### Unit Tests

```bash
pnpm test src/gateway/config-reload.test.ts
```

**検証項目**:
- [ ] metaフィールド変更で再起動がトリガーされない
- [ ] 5000msデバウンスが正しく動作
- [ ] その他のフィールド変更は正常に動作

### Integration Tests

```bash
# 並列実行シミュレーション
pnpm test:manual --parallel-config-changes
```

**検証シナリオ**:
1. 複数エージェントが同時にConfig更新
2. 5秒以内の複数変更が1回に集約される
3. metaフィールド更新で再起動が発生しない

### Production Verification

```bash
# 1. ローカルビルドをインストール
cd /path/to/clawdbot
pnpm build
sudo npm link

# 2. Gateway再起動
pkill -9 -f clawdbot-gateway || true
clawdbot gateway run --port 18789 &

# 3. ログ監視
tail -f /tmp/clawdbot/clawdbot-*.log | grep -E "config change|service restart|SIGUSR1"

# 4. Discordテスト
# - メッセージ送信 → リアクションが返ってくることを確認
# - 並列実行 → 再起動回数が減少していることを確認
```

---

## 📝 CodeXレビュー依頼項目

### コードレビュー

| 項目 | 確認内容 |
|------|----------|
| **正確性** | metaフィールドが正しく無視されるか? |
| **完全性** | 他のフィールドへの副作用はないか? |
| **安全性** | デバウンス延長による問題はないか? |
| **パフォーマンス** | 5000msの遅延がUXに影響しないか? |

### エッジケース確認

1. **meta以外のフィールド変更**: 正常に再起動するか?
2. **5秒以上の間隔で更新**: デバウンスが効かないことを確認
3. **hot reloadアクション**: 既存のhot reloadは正しく動くか?

---

## 🔄 リリース計画

### Phase 1: Local Testing
- [ ] Unit Tests実行
- [ ] Integration Tests実行
- [ ] ローカルGatewayで検証

### Phase 2: Beta Release
- [ ] `npm publish --tag beta`
- [ ] テスト環境にデプロイ
- [ ] 24時間監視

### Phase 3: Stable Release
- [ ] 問題なしを確認
- [ ] `npm publish --tag latest`
- [ ] 変更ログ更新

---

## 📈 成功指標

| 指標 | 現状 | 目標 | 測定方法 |
|------|------|------|----------|
| 再起動回数/時間 | 30回/3.2分 | <5回/時間 | ログ解析 |
| Discord切断 | 33回/日 | <5回/日 | ログ解析 |
| 応答完了率 | ~70% | >95% | Discord確認 |

---

## ⚠️ リスク評価

| リスク | 確率 | 影響 | 緩和策 |
|--------|------|------|--------|
| デバウンス長すぎてUX悪化 | 低 | 中 | ユーザー設定で短縮可能 |
| meta無視で必要な更新漏れ | 低 | 低 | metaは内部用のみ |
| 既存機能への副作用 | 低 | 中 | Unit Testsで網羅 |

---

## 📚 参考資料

- [調査レポート](CRASH_INVESTIGATION_REPORT.md)
- [GitHub Issue #92](https://github.com/ShunsukeHayashi/dev-workspace/issues/92)
- [GitHub Issue #93](https://github.com/ShunsukeHayashi/dev-workspace/issues/93)

---

**作成者**: しきるん (Claude Code)
**最終更新**: 2026-01-25
**ステータス**: 🟡 コードレビュー待ち
