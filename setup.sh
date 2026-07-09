#!/usr/bin/env bash
# ============================================================
#  FABLEHIVE — one-shot VPS setup  (hardened)
#  Runs on a fresh Ubuntu 24.04 droplet.
# ============================================================
DOMAIN="fablehive.duckdns.org"

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo ">> [1/6] Node.js + git..."
apt-get update -y
apt-get install -y nodejs npm git ufw curl
node -v

echo ">> [2/6] Fetching the game from GitHub..."
rm -rf /opt/fablehive
git clone https://github.com/CeleryClaude/fablehive.git /opt/fablehive
cd /opt/fablehive
npm install --omit=dev

echo ">> [3/6] Running the game as an always-on service on :8081..."
cat >/etc/systemd/system/fablehive.service <<'EOF'
[Unit]
Description=FABLEHIVE room server
After=network.target
[Service]
WorkingDirectory=/opt/fablehive
ExecStart=/usr/bin/node server.js
Environment=PORT=8081
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now fablehive

echo ">> [4/6] Caddy (automatic HTTPS + WebSocket proxy)..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy
cat >/etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy localhost:8081
}
EOF

echo ">> [5/6] Firewall - 22, 80, 443 open..."
ufw allow 22/tcp  || true
ufw allow 80/tcp  || true
ufw allow 443/tcp || true
ufw --force enable || true

echo ">> [6/6] fail2ban - auto-bans login brute-forcers..."
apt-get install -y fail2ban
cat >/etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

systemctl restart caddy
echo ""
echo "======================================================"
echo "  DONE.  Open:  https://${DOMAIN}"
echo "  (first load can take ~30s while the cert issues)"
echo "======================================================"
