#!/bin/bash
# overnight-improvement.sh
git checkout -b autonomous-improvements-$(date +%Y%m%d-%H%M%S)
while true; do
  branch="session-${sessionNum}-codex"
  echo "=== Starting ${branch} ==="

  # Create a new branch

  # Set up logging
  LOG_FILE="improvement-$(date +%Y%m%d-%H%M%S).log"
  echo wat
  echo < architecture-improvements.md
  echo wat
  # Run Claude Code with maximum iterations and logging
  claude --print --max-turns 1000 --dangerously-skip-permissions --verbose < architecture-improvements.md

  # Commit all changes
  git add -A
  git commit -m "Autonomous improvements completed at $(date)"
  shouldPause=$(cat .pause || echo 1)
  if (( shouldPause % 2 == 0 )); then
    exit
  fi
done

echo "Improvements complete! Check $LOG_FILE for details"
