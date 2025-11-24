#!/bin/bash
# overnight-improvement.sh
while true; do
  branch="session-${sessionNum}-codex"
  echo "=== Starting ${branch} ==="

  # Create a new branch
  git checkout -b autonomous-improvements-$(date +%Y%m%d-%H%M%S)

  # Set up logging
  LOG_FILE="improvement-$(date +%Y%m%d-%H%M%S).log"

  # Run Claude Code with maximum iterations and logging
  claude --max-turns 1000 --dangerously-skip-permissions < architecture-improvements.md

  # Commit all changes
  git add -A
  git commit -m "Autonomous improvements completed at $(date)"
done

echo "Improvements complete! Check $LOG_FILE for details"
