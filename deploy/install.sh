#!/usr/bin/env bash
# Debian 12 / Ubuntu 24.04 서버(LXC·VM) 안에서 root 로, 저장소 루트에서 실행한다:  sudo deploy/install.sh
# 여러 번 실행해도 안전하다(멱등). 설치: Node 24, Caddy, 앱 파일, systemd 유닛, fitness-admin 명령.
# todo-app 과 같은 호스트에 둘 때: FITNESS_SKIP_CADDYFILE=1 sudo deploy/install.sh  (기존 Caddyfile 에 사이트 블록만 덧붙인다)
set -euo pipefail

APP_DIR=/opt/fitness
STATE_DIR=/var/lib/fitness
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "root 로 실행해 주세요: sudo deploy/install.sh" >&2; exit 1; }
[ -f "$SRC/package.json" ] || { echo "저장소 루트를 찾을 수 없어요: $SRC" >&2; exit 1; }

echo "==> 기본 패키지"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg rsync debian-keyring debian-archive-keyring apt-transport-https

echo "==> Node.js 24"
if ! command -v node >/dev/null || ! node -v | grep -Eq '^v(2[4-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -qq nodejs
fi
node -v

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> 앱 빌드 (개발 의존성은 빌드에만 쓰고, 서버에는 런타임 의존성이 없다)"
(cd "$SRC" && npm ci --no-audit --no-fund && npm run build)

echo "==> 사용자와 폴더"
id fitness >/dev/null 2>&1 || useradd --system --home-dir "$STATE_DIR" --shell /usr/sbin/nologin fitness
install -d -m 0755 "$APP_DIR" "$APP_DIR/server" "$APP_DIR/shared" "$APP_DIR/client"
install -d -o fitness -g fitness -m 0750 "$STATE_DIR"

echo "==> 앱 파일 배포 → $APP_DIR"
rsync -a --delete "$SRC/server/src/" "$APP_DIR/server/src/"
rsync -a --delete --exclude tests "$SRC/shared/" "$APP_DIR/shared/"
rsync -a --delete "$SRC/client/dist/" "$APP_DIR/client/dist/"
install -m 0644 "$SRC/package.json" "$APP_DIR/package.json"   # "type": "module" 때문에 필요하다

echo "==> systemd 서비스"
install -m 0644 "$SRC/deploy/fitness.service" /etc/systemd/system/fitness.service
systemctl daemon-reload
systemctl enable fitness >/dev/null
systemctl restart fitness

echo "==> fitness-admin 명령"
cat > /usr/local/bin/fitness-admin <<'WRAP'
#!/bin/sh
# 서버와 같은 DB 를 쓰도록 fitness 사용자로 실행한다
exec runuser -u fitness -- env NODE_NO_WARNINGS=1 FITNESS_DB=/var/lib/fitness/fitness.db \
  /usr/bin/node /opt/fitness/server/src/admin-cli.ts "$@"
WRAP
chmod 0755 /usr/local/bin/fitness-admin

echo "==> Caddy 설정"
if [ "${FITNESS_SKIP_CADDYFILE:-0}" = "1" ]; then
  echo "  건너뜀(FITNESS_SKIP_CADDYFILE=1): deploy/Caddyfile 의 사이트 블록을 기존 /etc/caddy/Caddyfile 에 직접 덧붙이세요."
else
  install -m 0644 "$SRC/deploy/Caddyfile" /etc/caddy/Caddyfile
fi
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

echo "==> 확인"
sleep 2
if curl -fsS http://127.0.0.1:8081/api/health >/dev/null; then echo "  서버: 정상 (127.0.0.1:8081)"; else echo "  서버: 응답 없음 → journalctl -u fitness -n 50" >&2; fi
if curl -fsSkI --resolve fitness.home.arpa:443:127.0.0.1 https://fitness.home.arpa/ >/dev/null; then echo "  Caddy(HTTPS): 정상"; else echo "  Caddy(HTTPS): 응답 없음 → 사이트 블록이 Caddyfile 에 있는지, journalctl -u caddy -n 50" >&2; fi

cat <<'DONE'

설치가 끝났어요. 다음 단계:
  1) 기기에 Caddy 루트 인증서가 아직 없다면 설치하세요:  /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
     (todo-app 과 같은 Caddy 이면 이미 설치돼 있어요)
  2) fitness-admin pair --name "iPhone"  으로 페어링 코드를 받아 앱의 설정 > 홈서버에 연결 에서 입력하세요.
  3) 매일 백업:  fitness-admin backup /var/lib/fitness/backup-$(date +%F).db
DONE
