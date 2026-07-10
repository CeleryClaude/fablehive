#!/usr/bin/env bash
# ONE-TIME INSTALL: after this, every commit to main lands on the droplet by itself.
set -e
chmod +x /opt/fablehive/autodeploy.sh
cat > /etc/systemd/system/fablehive-deploy.service <<'UNIT'
[Unit]
Description=FABLEHIVE autodeploy pull
[Service]
Type=oneshot
ExecStart=/opt/fablehive/autodeploy.sh
UNIT
cat > /etc/systemd/system/fablehive-deploy.timer <<'UNIT'
[Unit]
Description=FABLEHIVE autodeploy every minute
[Timer]
OnBootSec=60
OnUnitActiveSec=60
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now fablehive-deploy.timer
echo ""
echo "AUTODEPLOY IS ON — new commits land within ~1 minute when the meadow is empty,"
echo "and within 15 minutes even mid-session (the reconnect catches everyone)."
echo ""
echo "While you are here, one security chore worth 20 seconds: type   passwd"
echo "and set a fresh root password — the old one is sitting in an old chat log."
