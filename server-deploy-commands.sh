#!/bin/bash

# 🚀 HQMX Ultimate Bot Bypass System - 서버 배포 명령어
# 사용자가 직접 서버에 SSH 접속한 후 실행할 명령어들

echo "=== HQMX Ultimate Bot Bypass System 서버 배포 ==="
echo "다음 명령어들을 서버에서 순서대로 실행하세요:"
echo ""

cat << 'EOF'
# 1. 기존 서비스 중지 및 백업
echo "🔄 기존 서비스 중지 중..."
pm2 stop hqmx-backend 2>/dev/null || true
systemctl stop hqmx-backend 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

# 백업 생성
if [ -d "/var/www/hqmx" ]; then
    BACKUP_DIR="/var/www/backup/hqmx-$(date +%Y%m%d_%H%M%S)"
    echo "📦 백업 생성: $BACKUP_DIR"
    mkdir -p /var/www/backup
    cp -r /var/www/hqmx "$BACKUP_DIR"
    echo "✅ 백업 완료"
fi

# 2. 최신 코드 다운로드
echo "📥 최신 코드 다운로드 중..."
cd /var/www
rm -rf hqmx
git clone https://github.com/jaykoart/hqmx-backend.git hqmx
cd hqmx

# 3. Node.js 환경 확인 및 설치
echo "🔧 Node.js 환경 확인 중..."
if ! command -v node &> /dev/null; then
    echo "📦 Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2 설치 중..."
    sudo npm install -g pm2
fi

# 4. 시스템 패키지 설치
echo "🔧 시스템 패키지 설치 중..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip ffmpeg curl git make g++ chromium-browser

# 5. yt-dlp 설치
echo "📦 yt-dlp 설치 중..."
sudo pip3 install --break-system-packages yt-dlp

# 6. 백엔드 의존성 설치 및 빌드
echo "🔨 백엔드 빌드 중..."
cd backend
npm ci --only=production
npm run build

# 7. 환경 변수 설정
echo "⚙️ 환경 변수 설정 중..."
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=5001
API_URL=https://api.hqmx.net
TEMP_DIR="/tmp/hqmx"
REDIS_URL="redis://localhost:6379"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="https://hqmx.net,https://www.hqmx.net"
MAX_PROXY_POOL_SIZE=1000
PROXY_TEST_TIMEOUT=5000
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=45000
ENVEOF

# 8. 디렉토리 생성
echo "📁 디렉토리 생성 중..."
mkdir -p logs temp /tmp/hqmx
chmod 755 logs temp /tmp/hqmx

# 9. 서비스 시작
echo "🚀 서비스 시작 중..."
NODE_ENV=production PORT=5001 pm2 start dist/server.js --name hqmx-backend
pm2 save
pm2 startup

# 10. 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
sleep 10
pm2 status

# 11. API 테스트
echo "🧪 API 테스트 중..."
curl -X GET "http://localhost:5001/health" | jq .

echo ""
echo "🎉 배포 완료!"
echo "✅ 서비스 상태: pm2 status"
echo "✅ 로그 확인: pm2 logs hqmx-backend"
echo "✅ API 테스트: curl http://localhost:5001/health"
echo "✅ 궁극의 우회 테스트: curl -X POST http://localhost:5001/api/ultimate-bot-bypass -H 'Content-Type: application/json' -d '{\"url\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",\"bypassLevel\":\"ultimate\"}'"

EOF
