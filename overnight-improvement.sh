#!/bin/bash
# overnight-improvement.sh

# Create a new branch
git checkout -b autonomous-improvements-$(date +%Y%m%d-%H%M%S)

# Set up logging
LOG_FILE="improvement-$(date +%Y%m%d-%H%M%S).log"

# Run Claude Code with maximum iterations and logging
claude-code \
  --max-iterations 1000 \
  --auto-confirm \
  --continue-on-error \
  --log-level debug \
  --file architecture-improvements.md | tee "$LOG_FILE"

# Commit all changes
git add -A
git commit -m "Autonomous improvements completed at $(date)"

echo "Improvements complete! Check $LOG_FILE for details"