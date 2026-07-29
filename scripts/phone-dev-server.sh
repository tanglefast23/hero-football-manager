#!/bin/zsh
# Phone must always track MAIN on port 8081 — hardcoded so a worktree launch can't serve the wrong copy.
cd /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager || exit 1
exec npx expo start --lan --port 8081
