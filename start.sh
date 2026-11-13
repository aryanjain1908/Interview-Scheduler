#!/usr/bin/env bash
# Starts GRIT Interviews (database, API, web app) with Docker, waits until it is ready, and opens it.
#
#   ./start.sh            build if needed, start, open http://localhost:5173
#   ./start.sh --rebuild  rebuild the images first (after dependency changes)
#   ./start.sh --reset    start, then wipe and reload the demo data
#   ./start.sh --test     start, then run the backend test suite
#   ./start.sh --logs     follow the logs of all services
#   ./start.sh --stop     stop everything (data is kept); add --wipe to delete the database
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=grit-interviews
WEB_URL=http://localhost:5173
API_URL=http://localhost:8000/api/health
REBUILD=0 RESET=0 TEST=0 LOGS=0 STOP=0 WIPE=0 BROWSER=1

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;; --reset) RESET=1 ;; --test) TEST=1 ;; --logs) LOGS=1 ;;
    --stop) STOP=1 ;; --wipe) WIPE=1 ;; --no-browser) BROWSER=0 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
  esac
done

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mERROR: %s\033[0m\n' "$1"; exit 1; }

wait_url() { # url name seconds
  local end=$((SECONDS + $3))
  while (( SECONDS < end )); do
    if curl -fs -o /dev/null "$1"; then ok "$2 is ready"; return; fi
    sleep 2
  done
  fail "$2 did not respond at $1 within $3 seconds. Run './start.sh --logs' to see why."
}

step "Checking Docker"
command -v docker >/dev/null || fail "Docker is not installed. Get Docker Desktop: https://www.docker.com/products/docker-desktop/"
if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname)" == "Darwin" ]] && open -a Docker 2>/dev/null; then
    echo "    Docker Desktop is not running. Starting it..."
    end=$((SECONDS + 180))
    until docker info >/dev/null 2>&1; do
      (( SECONDS < end )) || fail "Docker did not start within 3 minutes. Start it manually and run this again."
      sleep 3
    done
  else
    fail "Docker is installed but not running. Start it and run this again."
  fi
fi
ok "Docker is running"

if (( STOP )); then
  step "Stopping GRIT Interviews"
  if (( WIPE )); then docker compose down -v; else docker compose down; fi
  ok "Stopped"; exit 0
fi
if (( LOGS )); then docker compose logs -f --tail 100; exit 0; fi

# Plain 'docker build': 'docker compose build' fails on some setups.
for svc in backend frontend; do
  image="$PROJECT-$svc"
  if (( REBUILD )) || [[ -z "$(docker images -q "$image" 2>/dev/null)" ]]; then
    step "Building the $svc image (first run takes a few minutes)"
    docker build -t "$image" "./$svc" || fail "Building the $svc image failed."
    ok "$image built"
  fi
done

# -V gives the web app fresh node_modules so new dependencies are picked up.
step "Starting database, API and web app"
docker compose up -d --no-build -V || fail "docker compose up failed. Is something else using port 5432, 8000 or 5173?"

step "Waiting for the services"
wait_url "$API_URL" "API" 180
wait_url "$WEB_URL" "Web app" 180

if (( RESET )); then
  step "Reloading the demo data"
  docker compose exec -T backend python -m app.seed --reset || fail "Reloading the demo data failed."
fi
if (( TEST )); then
  step "Running the backend tests"
  docker compose exec -T backend pytest -q -p no:warnings || fail "Some tests failed (see above)."
  ok "All tests passed"
fi

cat <<EOF

GRIT Interviews is running
  Web app   $WEB_URL
  API docs  http://localhost:8000/docs

  Demo accounts (password demo1234):
    sneha@grit.demo   student, ready to book
    priya@grit.demo   interviewer
    admin@grit.demo   interview team

  Stop with: ./start.sh --stop
EOF

if (( BROWSER )); then
  if command -v open >/dev/null; then open "$WEB_URL"; elif command -v xdg-open >/dev/null; then xdg-open "$WEB_URL" >/dev/null 2>&1 || true; fi
fi
