#!/bin/bash

# 🚀 HQMX Ultimate Bot Bypass System - 원라이너 배포 스크립트
# 서버에서 한 번에 실행할 수 있는 배포 명령어

echo "=== HQMX 원라이너 배포 스크립트 ==="
echo ""
echo "서버에 SSH 접속 후 다음 명령어를 복사해서 실행하세요:"
echo ""
echo "----------------------------------------"

cat << 'EOF'
curl -fsSL https://raw.githubusercontent.com/jaykoart/hqmx-backend/main/deploy-server.sh | bash
EOF

echo "----------------------------------------"
echo ""
echo "또는 수동으로 다음 명령어들을 실행하세요:"
echo ""

cat << 'EOF'
# 전체 배포 프로세스를 한 번에 실행
bash -c "
set -e
echo '🔄 기존 서비스 중지...'
pm2 stop hqmx-backend 2>/dev/null || true
pkill -f 'node.*server' 2>/dev/null || true

echo '📦 백업 생성...'
[ -d '/var/www/hqmx' ] && cp -r /var/www/hqmx /var/www/backup/hqmx-\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

echo '📥 최신 코드 다운로드...'
cd /var/www && rm -rf hqmx
git clone https://github.com/jaykoart/hqmx-backend.git hqmx && cd hqmx

echo '🔧 환경 설정...'
command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs)
command -v pm2 >/dev/null || sudo npm install -g pm2
sudo apt-get update && sudo apt-get install -y python3 python3-pip ffmpeg curl git make g++ chromium-browser
sudo pip3 install --break-system-packages yt-dlp

echo '🔨 빌드 및 설정...'
cd backend
npm ci --only=production && npm run build
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=5001
API_URL=https://api.hqmx.net
TEMP_DIR=\"/tmp/hqmx\"
REDIS_URL=\"redis://localhost:6379\"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=\"https://hqmx.net,https://www.hqmx.net\"
MAX_PROXY_POOL_SIZE=1000
PROXY_TEST_TIMEOUT=5000
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=45000
ENVEOF

mkdir -p logs temp /tmp/hqmx && chmod 755 logs temp /tmp/hqmx

echo '🚀 서비스 시작...'
NODE_ENV=production PORT=5001 pm2 start dist/server.js --name hqmx-backend
pm2 save && pm2 startup

echo '🔍 테스트...'
sleep 15
curl -X GET 'http://localhost:5001/health' | jq . || echo 'API 응답 확인 필요'

echo '🎉 배포 완료!'
echo 'API 테스트: curl -X POST http://localhost:5001/api/ultimate-bot-bypass -H \"Content-Type: application/json\" -d \"{\\\"url\\\":\\\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\\\",\\\"bypassLevel\\\":\\\"ultimate\\\"}\\"'
"
EOF
