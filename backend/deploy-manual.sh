#!/bin/bash

echo "🚀 HQMX Backend 수동 배포 시작..."

# 1. 빌드
echo "📦 애플리케이션 빌드 중..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi

echo "✅ 빌드 완료"

# 2. Docker 이미지 빌드
echo "🐳 Docker 이미지 빌드 중..."
docker build -t hqmx-backend:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker 빌드 실패"
    exit 1
fi

echo "✅ Docker 이미지 빌드 완료"

# 3. 서버에 배포 (SSH 키가 설정된 경우)
echo "🌐 서버에 배포 중..."
echo "⚠️  SSH 키가 설정되어 있지 않으면 수동으로 서버에 접속하여 다음 명령을 실행하세요:"
echo ""
echo "ssh root@165.232.95.144"
echo "cd /root/hqmx-backend"
echo "git pull origin main"
echo "npm install"
echo "npm run build"
echo "docker-compose down"
echo "docker-compose up -d"
echo ""

# 4. 배포 확인
echo "🔍 배포 상태 확인:"
echo "curl -X GET https://api.hqmx.net/health"
echo ""

echo "✅ 수동 배포 스크립트 완료!"
echo "📝 다음 단계:"
echo "1. GitHub Actions에서 워크플로우 수동 실행"
echo "2. 또는 서버에 직접 SSH 접속하여 위 명령 실행"
