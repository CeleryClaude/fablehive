#!/usr/bin/env bash
# FABLEHIVE AUTODEPLOY — pulls main when it moves; restarts only when the meadow is EMPTY
# (or when the update has waited 15+ minutes). Players mid-flight are never yanked for a routine deploy.
cd /opt/fablehive || exit 0
git fetch -q origin main || exit 0
L=$(git rev-parse @)
R=$(git rev-parse origin/main)
[ "$L" = "$R" ] && exit 0
# BY DECREE (Jul 11): updates deploy IMMEDIATELY, seats or no seats - souls persist server-side now,
# so a restart costs a ~2s reconnect, never progress. (Soften later by restoring the seat check.)
git pull -q origin main && systemctl restart fablehive \
 && echo "$(date -Is) deployed ${R:0:7} (forced, by decree)" >> /var/log/fablehive-deploy.log
