#!/bin/bash

# 🚀 HQMX DigitalOcean 서버 업데이트 스크립트
# 최신 고급 우회 서비스 배포

echo "🚀 HQMX DigitalOcean 서버 업데이트 시작..."

# 1. 기존 프로세스 정리
echo "📱 기존 프로세스 정리 중..."
pm2 delete all 2>/dev/null || echo "PM2 프로세스 없음"
pm2 kill 2>/dev/null || echo "PM2 데몬 없음"
lsof -ti:5001 | xargs kill -9 2>/dev/null || echo "포트 5001 프로세스 없음"

# 2. 백업 생성
echo "💾 현재 버전 백업 중..."
cd /var/www
cp -r hqmx hqmx-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "백업 스킵"

# 3. 최신 코드 다운로드
echo "📦 최신 코드 다운로드 중..."
rm -rf hqmx-new
git clone https://github.com/jaykoart/hqmx-backend.git hqmx-new
cd hqmx-new

# 4. 기존 설정 파일 복사
echo "⚙️ 기존 설정 복사 중..."
if [ -f "/var/www/hqmx/backend/.env" ]; then
    cp /var/www/hqmx/backend/.env backend/.env
    echo "✅ 기존 .env 파일 복사 완료"
else
    echo "⚠️ 기존 .env 파일 없음, 새로 생성..."
    cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=5001
API_URL=https://api.hqmx.net
CORS_ORIGIN="https://hqmx.net,https://www.hqmx.net"
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=60000
ENABLE_PROXY_ROTATION=true
PROXY_ROTATION_STRATEGY=performance
USE_PROXY_FOR_YOUTUBE=true
ENABLE_ADVANCED_BYPASS=true
USE_USER_PROFILE_MIMIC=true
BYPASS_MAX_RETRIES=5
BYPASS_TIMEOUT=45000
ENABLE_STEALTH_MODE=true
SIMULATE_HUMAN_BEHAVIOR=true
RATE_LIMIT_MAX_REQUESTS=1000
EOF
fi

# 5. 백엔드 설치 및 빌드
echo "🔨 백엔드 빌드 중..."
cd backend
npm install --production
npm run build

# 6. 기존 디렉토리 교체
echo "🔄 서비스 교체 중..."
cd /var/www
mv hqmx hqmx-old 2>/dev/null || echo "기존 디렉토리 없음"
mv hqmx-new hqmx

# 7. 권한 설정
echo "🔐 권한 설정 중..."
chown -R www-data:www-data hqmx/frontend
chmod -R 755 hqmx

# 8. PM2로 서비스 시작
echo "🚀 서비스 시작 중..."
cd hqmx/backend
NODE_ENV=production PORT=5001 pm2 start dist/server.js --name hqmx-backend
pm2 save

# 9. Nginx 재시작 (설정 변경사항 반영)
echo "🌐 Nginx 재시작 중..."
nginx -t && systemctl restart nginx

# 10. 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
sleep 5
pm2 status
curl -s http://localhost:5001/health | head -1

echo ""
echo "✅ 업데이트 완료!"
echo "🌐 https://hqmx.net 에서 테스트해보세요"
echo "📊 PM2 상태: pm2 status"
echo "📋 로그 확인: pm2 logs hqmx-backend"
