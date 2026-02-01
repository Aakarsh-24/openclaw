---
name: fork-manager
description: Manage forks with open PRs - sync upstream, rebase branches, track PR status, detect duplicate PRs, link related issues, and maintain production branches.
metadata: {"openclaw":{"emoji":"🍴","os":["darwin","linux"],"requires":{"bins":["git","gh"]}}}
---

# Fork Manager Skill

Skill para gerenciar forks de repositórios onde você contribui com PRs, detectar contribuições duplicadas, e engajar com a comunidade de forma estratégica.

## Quando usar

- Usuário pede para atualizar/sincronizar um fork
- Usuário quer saber status dos PRs abertos
- Usuário quer fazer rebase das branches de PR
- Usuário quer criar uma branch de produção com todos os PRs
- Usuário quer detectar PRs duplicados ou similares
- Usuário quer linkar issues relacionadas aos PRs
- Execução automática via cron (a cada 12h)

## Configuração

Configs ficam em `~/.openclaw/fork-manager/<repo-name>.json`:

```json
{
  "repo": "owner/repo",
  "fork": "your-user/repo", 
  "localPath": "/path/to/local/clone",
  "mainBranch": "main",
  "productionBranch": "main-with-all-prs",
  "upstreamRemote": "upstream",
  "forkRemote": "fork",
  "openPRs": [123, 456],
  "prBranches": {
    "123": "fix/issue-123",
    "456": "feat/feature-456"
  },
  "prMetadata": {
    "123": {
      "title": "fix: resolve issue with X",
      "linkedIssues": [100, 101],
      "relatedPRs": [],
      "keywords": ["fix", "X", "issue"]
    }
  },
  "lastSync": "2026-01-28T12:00:00Z",
  "lastDuplicateCheck": "2026-01-28T12:00:00Z"
}
```

---

## Fluxo Completo (full-sync)

### 1. Carregar config e fetch

```bash
CONFIG_DIR=~/.openclaw/fork-manager
cat "$CONFIG_DIR/<repo>.json"
cd <localPath>
git fetch --all
```

### 2. Sync main com upstream

```bash
git checkout <mainBranch>
git merge <upstreamRemote>/<mainBranch> --ff-only
git push <forkRemote> <mainBranch>
```

### 3. Atualizar lista de PRs

```bash
gh pr list --state open --author @me --repo <repo> --json number,title,headRefName,body
```

### 4. Rebase de todas as branches

Para cada PR:
```bash
git checkout -B <branch> <forkRemote>/<branch>
git rebase <upstreamRemote>/<mainBranch>
git push <forkRemote> <branch> --force-with-lease
```

### 5. Detectar PRs duplicados (NOVO)

Ver seção "Detecção de PRs Duplicados" abaixo.

### 6. Linkar issues relacionadas (NOVO)

Ver seção "Tracking de Issues" abaixo.

### 7. Build production branch

```bash
git checkout -b <productionBranch> <upstreamRemote>/<mainBranch>
for branch in <prBranches>; do
  git merge $branch --no-edit
done
git push <forkRemote> <productionBranch> --force
```

---

## Detecção de PRs Duplicados

### Objetivo

Identificar PRs de outros contribuidores que tentam resolver o mesmo problema. Isso permite:
- Consolidar esforços com PRs melhores
- Pedir apoio em PRs que você já abriu
- Evitar trabalho duplicado

### Estratégia de Detecção

Para cada PR meu, buscar PRs similares usando:

```bash
# 1. Buscar PRs que modificam os mesmos arquivos
MY_FILES=$(gh pr view <my_pr> --json files --jq '.files[].path' | sort)
gh pr list --state open --json number,title,files,author --jq '.[] | select(.author.login != "@me")'

# 2. Buscar PRs com títulos/keywords similares
gh pr list --state open --search "<keywords from my PR title>"

# 3. Buscar PRs que referenciam as mesmas issues
gh pr list --state open --search "linked:issue#<issue_number>"
```

### Análise de Qualidade

Para cada PR similar encontrado, avaliar:

| Critério | Peso | Como verificar |
|----------|------|----------------|
| Completude | 30% | Número de arquivos alterados, cobertura do fix |
| Qualidade do código | 25% | Review comments, CI status |
| Antiguidade | 15% | Data de criação (PRs mais antigos têm precedência) |
| Engajamento | 15% | Número de reviews, comentários, reações |
| Autor reputation | 15% | Contribuições anteriores ao repo |

```bash
# Obter métricas de um PR
gh pr view <pr_number> --json \
  createdAt,additions,deletions,changedFiles,comments,reviews,\
  statusCheckRollup,author --jq '{
    created: .createdAt,
    changes: (.additions + .deletions),
    files: .changedFiles,
    engagement: ((.comments | length) + (.reviews | length)),
    ci_passed: (.statusCheckRollup | map(select(.conclusion == "SUCCESS")) | length),
    author: .author.login
  }'
```

### Ações Baseadas na Análise

#### Se meu PR é melhor (score > PR similar):

```bash
# Comentar no PR similar pedindo apoio
gh pr comment <similar_pr> --body "Hey! I noticed this PR addresses the same issue as #<my_pr>.

I've been working on a similar fix that [explain why yours is better - more complete, cleaner approach, etc.].

Would you consider reviewing my PR and potentially closing this one in favor of consolidating our efforts? I'd really appreciate your support! 🙏

Happy to discuss if you have concerns or suggestions."
```

#### Se PR similar é melhor (score < PR similar):

```bash
# 1. Adicionar thumbs up no PR melhor
gh pr review <better_pr> --approve --body "Great work! This is a cleaner approach than my PR #<my_pr>. Closing mine in favor of this one. 👍"

# 2. Fechar meu PR com explicação
gh pr close <my_pr> --comment "Closing in favor of #<better_pr> which has a better implementation.

See my review there for details. Thanks @<author> for the great work!"

# 3. Atualizar config
# Remover PR fechado da lista
```

#### Se PRs são equivalentes (scores próximos):

```bash
# Comentar sugerindo colaboração
gh pr comment <similar_pr> --body "Hi! I see we're both working on the same problem (#<my_pr>).

Our approaches seem similar in scope. Would you be interested in collaborating? We could:
1. Merge our changes into one PR
2. Split the work if there are distinct parts
3. Review each other's code

Let me know what you think!"
```

---

## Tracking de Issues

### Objetivo

Encontrar issues que descrevem o problema que meu PR resolve, e linká-las para:
- Aumentar visibilidade do PR
- Ajudar usuários que buscam solução
- Mostrar aos maintainers que o PR resolve demandas reais

### Busca de Issues Relacionadas

```bash
# 1. Buscar issues por keywords do título do PR
gh issue list --state open --search "<keywords>" --json number,title,body

# 2. Buscar issues que mencionam os arquivos alterados
gh issue list --state open --search "path:<file_path>"

# 3. Buscar issues por labels relacionadas
gh issue list --state open --label "bug" --label "<area>"

# 4. Buscar issues referenciadas em commits
git log --oneline <branch> | grep -oE "#[0-9]+"
```

### Análise de Relevância

Para cada issue encontrada, calcular relevância:

```python
def calculate_relevance(issue, pr):
    score = 0
    
    # Keywords em comum no título
    pr_keywords = extract_keywords(pr.title)
    issue_keywords = extract_keywords(issue.title)
    score += len(pr_keywords & issue_keywords) * 10
    
    # Arquivos mencionados
    pr_files = pr.changed_files
    issue_files = extract_file_refs(issue.body)
    score += len(set(pr_files) & set(issue_files)) * 20
    
    # Error messages em comum
    pr_errors = extract_errors(pr.body)
    issue_errors = extract_errors(issue.body)
    score += len(set(pr_errors) & set(issue_errors)) * 30
    
    return score
```

### Ações de Linking

#### Para issues altamente relacionadas (score > 50):

```bash
# Comentar na issue linkando o PR
gh issue comment <issue_number> --body "This should be fixed by #<pr_number>.

The PR addresses this by [brief explanation of the fix].

@<issue_author> - would you be able to test this fix? You can try it from my fork:
\`\`\`bash
# Option 1: Cherry-pick the fix
git fetch https://github.com/<fork>/repo.git <branch>
git cherry-pick FETCH_HEAD

# Option 2: Use my fork directly  
git remote add temp https://github.com/<fork>/repo.git
git fetch temp <branch>
git checkout temp/<branch>
\`\`\`

Let me know if it works for you! 🙏"

# Atualizar PR description para mencionar a issue
gh pr edit <pr_number> --body "$(gh pr view <pr_number> --json body -q .body)

---
**Related Issues:**
- Fixes #<issue_number>"
```

#### Para issues moderadamente relacionadas (score 25-50):

```bash
# Comentar de forma mais cautelosa
gh issue comment <issue_number> --body "This might be related to #<pr_number>.

I'm not 100% sure if it's the same root cause, but the symptoms seem similar. Could you check if my PR addresses your issue?"
```

---

## Relatório Completo

Após full-sync, gerar relatório:

```markdown
## 🍴 Fork Manager Report: <repo>
**Run:** <timestamp>

### 📊 Sync Status
- **Main:** ✅ Synced (was X commits behind)
- **PRs rebased:** Y/Z successful
- **Production branch:** ✅ Rebuilt

### 📋 Open PRs (Z total)

| # | Title | Status | Duplicates | Issues |
|---|-------|--------|------------|--------|
| 123 | fix: thing | ✅ Rebased | 0 found | #100 linked |
| 456 | feat: other | ⚠️ Conflict | 1 similar | 2 candidates |

### 🔍 Duplicate Analysis

#### PR #456: feat: other thing
- **Similar PR found:** #789 by @other-user
- **Quality comparison:**
  - My PR: 65/100 (older, more complete)
  - Their PR: 45/100 (newer, partial fix)
- **Action taken:** Commented requesting support

### 🔗 Issue Linking

#### PR #123: fix: the thing
- **Linked:** #100 (exact match)
- **Candidates:** #101, #102 (partial match)
- **Comments posted:** 1

### ⚠️ Action Required
1. PR #456 has merge conflicts - manual resolution needed
2. Review response from @other-user on duplicate PR

### 📈 Stats
- Issues linked this run: 3
- Duplicate PRs found: 1
- Community comments posted: 4
```

---

## Configuração de Cron

Para execução automática a cada 12 horas:

```json
{
  "schedule": { "kind": "every", "everyMs": 43200000 },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run fork-manager full-sync on openclaw repo. Include duplicate detection and issue linking.",
    "timeoutSeconds": 600,
    "deliver": true
  }
}
```

---

## Notas Importantes

### Etiqueta de Comunidade

- **Seja respeitoso** ao comentar em PRs de outros
- **Não spam** - máximo 1 comentário por PR/issue por run
- **Acknowledge** trabalho de outros mesmo quando pedindo suporte
- **Seja específico** sobre por que seu PR é melhor (se for o caso)
- **Aceite graciosamente** quando o PR de outro for melhor

### Rate Limits

- GitHub API: 5000 requests/hour para authenticated
- Espaçar comentários: mínimo 30s entre ações
- Não fazer mais que 10 comentários por run

### Tracking

Manter registro de ações em `~/.openclaw/fork-manager/<repo>-actions.log`:
```
2026-01-31T12:00:00Z | COMMENT | PR#789 | duplicate_request
2026-01-31T12:00:30Z | LINK | ISSUE#100 | PR#123
2026-01-31T12:01:00Z | CLOSE | PR#456 | better_alternative
```

Evitar ações repetidas:
```bash
# Verificar se já comentou neste PR nas últimas 48h
grep "PR#789" ~/.openclaw/fork-manager/repo-actions.log | tail -1
```

---

## Exemplo de Execução Cron

```
🍴 Fork Manager - Automated Run
Time: 2026-02-01 00:00 UTC

[1/7] Loading config for openclaw...
[2/7] Fetching remotes...
[3/7] Syncing main (46 commits behind)... ✅
[4/7] Rebasing 23 PRs...
  - fix/telegram-dns: ✅
  - feat/models-menu: ✅
  - fix/compaction: ⚠️ conflict (skipped)
  ...
[5/7] Checking for duplicate PRs...
  - PR#5405: No duplicates found
  - PR#4307: Similar to #5500 by @contributor
    → Commented requesting review
[6/7] Linking related issues...
  - PR#5381: Linked to #5200, #5210
  - PR#5376: 1 candidate found, commented
[7/7] Rebuilding production branch... ✅

Summary: 22/23 rebased, 1 duplicate found, 3 issues linked
Next run: 2026-02-01 12:00 UTC
```
