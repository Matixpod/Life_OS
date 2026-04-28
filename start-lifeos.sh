#!/bin/bash
SESSION="lifeos"
ROOT="$(cd "$(dirname "$0")" && pwd)"

tmux has-session -t $SESSION 2>/dev/null
if [ $? == 0 ]; then
  tmux attach -t $SESSION
  exit 0
fi

tmux new-session -d -s $SESSION -n "claude"
tmux send-keys -t $SESSION:0 "cd $ROOT && claude" Enter

tmux new-window -t $SESSION:1 -n "backend"
tmux send-keys -t $SESSION:1 "cd $ROOT/backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000" Enter

tmux new-window -t $SESSION:2 -n "frontend"
tmux send-keys -t $SESSION:2 "cd $ROOT/frontend && pnpm dev" Enter

tmux new-window -t $SESSION:3 -n "logs"
tmux select-window -t $SESSION:0
tmux attach -t $SESSION
