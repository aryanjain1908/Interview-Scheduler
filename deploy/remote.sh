#!/usr/bin/env bash
# Runs on the server (Ubuntu) during each deploy. Safe to run again and again.
#
# Expects in ~/grit-interviews: docker-compose.yml and .deploy.env with
# API_IMAGE, WEB_IMAGE, SITE_ADDRESS, PUBLIC_URL, REGISTRY_USER, REGISTRY_TOKEN.
set -euo pipefail

APP_DIR="$HOME/grit-interviews"
cd "$APP_DIR"

say() { printf '\n==> %s\n' "$*"; }

# Deploy settings for this run; the registry token is only valid during the workflow run.
set -a
. ./.deploy.env
set +a
rm -f .deploy.env

say "Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
sudo systemctl enable --now docker >/dev/null 2>&1 || true
docker version --format 'Docker {{.Server.Version}}' 2>/dev/null || sudo docker version --format 'Docker {{.Server.Version}}'
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

say "Firewall (ports 80 and 443)"
# Oracle Cloud's Ubuntu images reject everything except SSH in iptables.
if command -v iptables >/dev/null 2>&1; then
  changed=""
  for port in 80 443; do
    if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      reject_at=$(sudo iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')
      sudo iptables -I INPUT "${reject_at:-1}" -p tcp --dport "$port" -j ACCEPT
      changed=1
    fi
  done
  # Saved rules (loaded at boot) are edited in place rather than re-saved,
  # so Docker's own chains never get persisted.
  rules=/etc/iptables/rules.v4
  if [ -n "$changed" ] && [ -f "$rules" ]; then
    for port in 443 80; do
      line="-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT"
      sudo grep -qF -- "$line" "$rules" || sudo sed -i "/--dport 22 -j ACCEPT/a $line" "$rules"
    done
  fi
fi
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80/tcp >/dev/null
  sudo ufw allow 443/tcp >/dev/null
fi
echo "open"

say "Secrets"
# Generated once on the server and never leave it.
if [ ! -f .env ]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
  echo "created .env"
else
  echo "kept existing .env"
fi

# Keep this deploy's (non-secret) settings next to the secrets, so plain
# "docker compose ps / logs" work on the server too.
for key in API_IMAGE WEB_IMAGE SITE_ADDRESS PUBLIC_URL; do
  sed -i "/^$key=/d" .env
  printf '%s=%s\n' "$key" "${!key}" >> .env
done

say "Pulling images"
echo "$REGISTRY_TOKEN" | $DOCKER login ghcr.io -u "$REGISTRY_USER" --password-stdin >/dev/null
$DOCKER compose pull --quiet
$DOCKER logout ghcr.io >/dev/null

say "Starting"
$DOCKER compose up -d --remove-orphans

say "Waiting for the API"
for _ in $(seq 1 60); do
  status=$($DOCKER inspect --format '{{.State.Health.Status}}' "$($DOCKER compose ps -q api)" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    $DOCKER image prune -f >/dev/null
    $DOCKER compose ps
    echo "Deployed $API_IMAGE"
    exit 0
  fi
  sleep 3
done
echo "The API did not become healthy. Recent logs:"
$DOCKER compose logs --tail 80
exit 1
