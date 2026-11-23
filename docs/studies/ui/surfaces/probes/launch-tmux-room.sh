#!/usr/bin/env zsh
set -euo pipefail

export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
REPO="/Users/adimov/xln"
SESSION="xln-ui-room"
P1_UUID="47000001-0000-4000-8000-000000000001"
P3_UUID="47000003-0000-4000-8000-000000000003"
DESIGN_UUID="4700000d-0000-4000-8000-00000000000d"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  exec tmux attach -t "$SESSION"
fi

P1_PROMPT='Read docs/studies/ui/surfaces/packs/p1-consumer.prompt.md ONLY (strict anti-priming: do NOT read any other file in perspectives/, rounds/, personal.scm, pro.scm, or forks.scm). Write docs/studies/ui/surfaces/perspectives/p1-consumer.scm in Arrival Scheme (DSL v2) starting with ";; Author: grok-4.7 (p1-consumer)" on line 1. Then run: bun docs/studies/ui/surfaces/check.ts --perspective docs/studies/ui/surfaces/perspectives/p1-consumer.scm and fix any errors until it prints VALID STRUCTURE and exits 0. Modify NO other files.'

P3_PROMPT='Read docs/studies/ui/surfaces/packs/p3-commercial.prompt.md ONLY (strict anti-priming: do NOT read any other file in perspectives/, rounds/, personal.scm, pro.scm, or forks.scm). Write docs/studies/ui/surfaces/perspectives/p3-commercial.scm in Arrival Scheme (DSL v2) starting with ";; Author: grok-4.7 (p3-commercial)" on line 1. Then run: bun docs/studies/ui/surfaces/check.ts --perspective docs/studies/ui/surfaces/perspectives/p3-commercial.scm and fix any errors until it prints VALID STRUCTURE and exits 0. Modify NO other files.'

SESS_DIR="$HOME/.grok/sessions/%2FUsers%2Fadimov%2Fxln"

P1_CMD="export PATH=\"\$HOME/.bun/bin:/opt/homebrew/bin:\$HOME/.local/bin:\$PATH\"; if [ -d \"$SESS_DIR/$P1_UUID\" ]; then grok -m grok-4.7 --always-approve --disable-web-search -r '$P1_UUID'; else grok -m grok-4.7 --always-approve --disable-web-search -s '$P1_UUID' $(printf '%q' "$P1_PROMPT"); fi; exec zsh"

P3_CMD="export PATH=\"\$HOME/.bun/bin:/opt/homebrew/bin:\$HOME/.local/bin:\$PATH\"; if [ -d \"$SESS_DIR/$P3_UUID\" ]; then grok -m grok-4.7 --always-approve --disable-web-search -r '$P3_UUID'; else grok -m grok-4.7 --always-approve --disable-web-search -s '$P3_UUID' $(printf '%q' "$P3_PROMPT"); fi; exec zsh"

tmux new-session -d -s "$SESSION" -n "p1-grok47" -c "$REPO" "$P1_CMD"
tmux new-window -t "$SESSION" -n "p3-grok47" -c "$REPO" "$P3_CMD"
tmux new-window -t "$SESSION" -n "design-grok47" -c "$REPO" \
  "export PATH=\"\$HOME/.bun/bin:/opt/homebrew/bin:\$HOME/.local/bin:\$PATH\"; if [ -d \"$SESS_DIR/$DESIGN_UUID\" ]; then grok -m grok-4.7 --always-approve --disable-web-search -r '$DESIGN_UUID'; else exec zsh; fi; exec zsh"
tmux new-window -t "$SESSION" -n "checker" -c "$REPO" \
  "export PATH=\"\$HOME/.bun/bin:/opt/homebrew/bin:\$HOME/.local/bin:\$PATH\"; ls -la docs/studies/ui/surfaces/perspectives; exec zsh"
tmux select-window -t "$SESSION:p1-grok47"

exec tmux attach -t "$SESSION"
