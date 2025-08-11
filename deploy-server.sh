#!/bin/bash

# 🚀 HQMX Ultimate Bot Bypass System - 서버 배포 스크립트
# GitHub raw URL로 직접 실행 가능한 배포 스크립트

set -e

# 색깔 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "🚀 HQMX Ultimate Bot Bypass System 배포 시작..."

# 1. 기존 서비스 중지
log_info "🔄 기존 서비스 중지 중..."
pm2 stop hqmx-backend 2>/dev/null || true
systemctl stop hqmx-backend 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

# 2. 백업 생성
if [ -d "/var/www/hqmx" ]; then
    BACKUP_DIR="/var/www/backup/hqmx-$(date +%Y%m%d_%H%M%S)"
    log_info "📦 백업 생성: $BACKUP_DIR"
    mkdir -p /var/www/backup
    cp -r /var/www/hqmx "$BACKUP_DIR"
    log_success "백업 완료"
fi

# 3. 최신 코드 다운로드
log_info "📥 최신 코드 다운로드 중..."
cd /var/www
rm -rf hqmx
git clone https://github.com/jaykoart/hqmx-backend.git hqmx
cd hqmx

# 4. Node.js 환경 확인
log_info "🔧 Node.js 환경 확인 중..."
if ! command -v node &> /dev/null; then
    log_info "📦 Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    log_info "📦 PM2 설치 중..."
    sudo npm install -g pm2
fi

# 5. 시스템 패키지 설치
log_info "🔧 시스템 패키지 설치 중..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip ffmpeg curl git make g++ chromium-browser jq

# 6. yt-dlp 설치
log_info "📦 yt-dlp 설치 중..."
sudo pip3 install --break-system-packages yt-dlp

# 7. 백엔드 빌드
log_info "🔨 백엔드 빌드 중..."
cd backend
npm ci --only=production
npm run build

# 8. 환경 변수 설정
log_info "⚙️ 환경 변수 설정 중..."
cat > .env << 'EOF'
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
EOF

# 9. 디렉토리 생성
log_info "📁 디렉토리 생성 중..."
mkdir -p logs temp /tmp/hqmx
chmod 755 logs temp /tmp/hqmx

# 10. 서비스 시작
log_info "🚀 서비스 시작 중..."
NODE_ENV=production PORT=5001 pm2 start dist/server.js --name hqmx-backend
pm2 save
pm2 startup

# 11. 서비스 확인
log_info "🔍 서비스 상태 확인 중..."
sleep 15

if pm2 list | grep -q "hqmx-backend.*online"; then
    log_success "✅ 서비스 시작 성공"
else
    log_error "❌ 서비스 시작 실패"
    pm2 logs hqmx-backend --lines 20
    exit 1
fi

# 12. API 테스트
log_info "🧪 API 테스트 중..."
if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    log_success "✅ API 헬스체크 통과"
    
    # 궁극의 우회 시스템 테스트
    log_info "🎯 궁극의 우회 시스템 테스트 중..."
    RESPONSE=$(curl -s -X POST "http://localhost:5001/api/ultimate-bot-bypass" \
        -H "Content-Type: application/json" \
        -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","bypassLevel":"ultimate","useIPRotation":true}' \
        --max-time 60)
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        log_success "🎉 궁극의 우회 시스템 테스트 성공!"
        echo "$RESPONSE" | jq '.title, .techniques_used'
    else
        log_warning "⚠️ 궁극의 우회 시스템 테스트 실패 - 추가 확인 필요"
    fi
else
    log_warning "⚠️ API 헬스체크 실패 - 서비스 로그 확인 필요"
fi

log_success "🎉 HQMX Ultimate Bot Bypass System 배포 완료!"
log_info "📊 서비스 상태: pm2 status"
log_info "📋 로그 확인: pm2 logs hqmx-backend"
log_info "🔍 API 테스트: curl http://localhost:5001/health"
log_info "🚀 궁극의 우회: curl -X POST http://localhost:5001/api/ultimate-bot-bypass -H 'Content-Type: application/json' -d '{\"url\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",\"bypassLevel\":\"ultimate\"}'"
log_info "🌐 프론트엔드 확인: https://hqmx.net"
