#!/usr/bin/env bash
# FABLEHIVE AUTODEPLOY — pulls main when it moves; restarts only when the meadow is EMPTY
# (or when the update has waited 15+ minutes). Players mid-flight are never yanked for a routine deploy.
cd /opt/fablehive || exit 0
git fetch -q origin main || exit 0
L=$(git rev-parse @)
R=$(git rev-parse origin/main)
[ "$L" = "$R" ] && exit 0
SEATS=$(curl -s --max-time 3 http://127.0.0.1:8081/healthz | grep -o '"seats":[0-9]*' | head -1 | cut -d: -f2)
AGE=$(( $(date +%s) - $(git log -1 --format=%ct origin/main) ))
if [ "${SEATS:-0}" = "0" ] || [ "$AGE" -gt 900 ]; then
  git pull -q origin main && systemctl restart fablehive \
   && echo "$(date -Is) deployed ${R:0:7} (seats=${SEATS:-?}, waited=${AGE}s)" >> /var/log/fablehive-deploy.log
fi
