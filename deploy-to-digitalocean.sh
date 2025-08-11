#!/bin/bash

# 🚀 HQMX Ultimate Bot Bypass System - DigitalOcean 배포 스크립트

set -e  # 에러 발생 시 스크립트 중단

# 색깔 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 서버 정보 (사용자가 수정해야 함)
SERVER_IP="${1:-YOUR_SERVER_IP}"
SERVER_USER="${2:-root}"
PROJECT_PATH="/var/www/hqmx"
GITHUB_REPO="https://github.com/jaykoart/hqmx-backend.git"

if [ "$SERVER_IP" = "YOUR_SERVER_IP" ]; then
    log_error "서버 IP를 지정해주세요: $0 <SERVER_IP> [USER]"
    exit 1
fi

log_info "🚀 HQMX Ultimate Bot Bypass System 배포 시작..."
log_info "서버: $SERVER_USER@$SERVER_IP"
log_info "경로: $PROJECT_PATH"

# SSH 연결 테스트
log_info "SSH 연결 테스트 중..."
if ! ssh -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'SSH 연결 성공'" 2>/dev/null; then
    log_error "SSH 연결 실패. 서버 IP와 SSH 키를 확인해주세요."
    exit 1
fi
log_success "SSH 연결 성공"

# 서버에서 배포 스크립트 실행
log_info "서버에서 배포 스크립트 실행 중..."

ssh "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
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

PROJECT_PATH="/var/www/hqmx"
GITHUB_REPO="https://github.com/jaykoart/hqmx-backend.git"

log_info "🔄 서버에서 배포 프로세스 시작..."

# 1. 기존 서비스 중지
log_info "기존 서비스 중지 중..."
pm2 stop hqmx-backend 2>/dev/null || true
systemctl stop hqmx-backend 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

# 2. 백업 생성
if [ -d "$PROJECT_PATH" ]; then
    BACKUP_DIR="/var/www/backup/hqmx-$(date +%Y%m%d_%H%M%S)"
    log_info "백업 생성: $BACKUP_DIR"
    mkdir -p /var/www/backup
    cp -r "$PROJECT_PATH" "$BACKUP_DIR"
    log_success "백업 완료"
fi

# 3. 프로젝트 디렉토리 생성
log_info "프로젝트 디렉토리 준비..."
mkdir -p "$(dirname $PROJECT_PATH)"
cd "$(dirname $PROJECT_PATH)"

# 4. 최신 코드 클론 (기존 디렉토리 삭제 후)
if [ -d "$PROJECT_PATH" ]; then
    log_info "기존 디렉토리 삭제 중..."
    rm -rf "$PROJECT_PATH"
fi

log_info "GitHub에서 최신 코드 클론 중..."
git clone "$GITHUB_REPO" "$(basename $PROJECT_PATH)"
cd "$PROJECT_PATH"

# 5. Node.js 및 npm 설치 확인
log_info "Node.js 환경 확인 중..."
if ! command -v node &> /dev/null; then
    log_info "Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    log_info "PM2 설치 중..."
    npm install -g pm2
fi

# 6. 의존성 설치
log_info "의존성 설치 중..."
cd backend
npm ci --only=production

# 7. TypeScript 빌드
log_info "TypeScript 빌드 중..."
npm run build

# 8. 환경 변수 설정
log_info "환경 변수 설정 중..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=5001
API_URL=https://api.hqmx.net
TEMP_DIR="/tmp/hqmx"

# Redis
REDIS_URL="redis://localhost:6379"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN="https://hqmx.net,https://www.hqmx.net"

# Proxy Configuration
MAX_PROXY_POOL_SIZE=1000
PROXY_TEST_TIMEOUT=5000

# Browser Configuration  
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=45000
EOF
    log_success "환경 변수 파일 생성 완료"
fi

# 9. 필요한 시스템 패키지 설치
log_info "시스템 패키지 설치 중..."
apt-get update
apt-get install -y python3 python3-pip ffmpeg curl git make g++

# 10. yt-dlp 설치
log_info "yt-dlp 설치 중..."
pip3 install --break-system-packages yt-dlp

# 11. Chromium 브라우저 설치 (Puppeteer용)
log_info "Chromium 브라우저 설치 중..."
apt-get install -y chromium-browser

# 12. 로그 및 임시 디렉토리 생성
log_info "디렉토리 생성 중..."
mkdir -p logs temp /tmp/hqmx
chmod 755 logs temp /tmp/hqmx

# 13. PM2로 서비스 시작
log_info "서비스 시작 중..."
NODE_ENV=production PORT=5001 pm2 start dist/server.js --name hqmx-backend
pm2 save
pm2 startup

# 14. 서비스 상태 확인
log_info "서비스 상태 확인 중..."
sleep 10

if pm2 list | grep -q "hqmx-backend.*online"; then
    log_success "✅ 서비스 시작 성공"
else
    log_error "❌ 서비스 시작 실패"
    pm2 logs hqmx-backend --lines 20
    exit 1
fi

# 15. API 테스트
log_info "API 테스트 중..."
if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    log_success "✅ API 헬스체크 통과"
else
    log_warning "⚠️ API 헬스체크 실패 - 서비스 로그 확인 필요"
fi

log_success "🎉 HQMX Ultimate Bot Bypass System 배포 완료!"
log_info "서비스 상태: pm2 status"
log_info "로그 확인: pm2 logs hqmx-backend"
log_info "API 테스트: curl http://localhost:5001/health"

ENDSSH

log_success "🎉 DigitalOcean 배포 완료!"
log_info "다음 단계:"
log_info "1. https://hqmx.net 에서 서비스 확인"
log_info "2. API 테스트: curl https://api.hqmx.net/health"
log_info "3. 궁극의 우회 시스템 테스트"
