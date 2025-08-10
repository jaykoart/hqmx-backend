#!/bin/bash

# HQMX Backend 배포 스크립트

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

# 배포 환경 확인
check_environment() {
    log_info "환경 확인 중..."
    
    # Docker 설치 확인
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        exit 1
    fi
    
    # Docker Compose 설치 확인
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        exit 1
    fi
    
    # .env 파일 확인
    if [ ! -f .env ]; then
        log_error ".env 파일이 없습니다. env.example을 참고하여 생성하세요."
        exit 1
    fi
    
    log_success "환경 확인 완료"
}

# 이전 배포 백업
backup_previous() {
    log_info "이전 배포 백업 중..."
    
    if [ -d "dist" ]; then
        BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r dist/ "$BACKUP_DIR/"
        cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
        log_success "백업 완료: $BACKUP_DIR"
    fi
}

# 애플리케이션 빌드
build_application() {
    log_info "애플리케이션 빌드 중..."
    
    # Node.js 의존성 설치
    npm ci --only=production
    
    # TypeScript 컴파일
    npm run build
    
    log_success "빌드 완료"
}

# Docker 이미지 빌드
build_docker() {
    log_info "Docker 이미지 빌드 중..."
    
    # 기존 컨테이너 중지
    docker-compose down || true
    
    # 이미지 빌드
    docker-compose build --no-cache
    
    log_success "Docker 이미지 빌드 완료"
}

# 서비스 배포
deploy_services() {
    log_info "서비스 배포 중..."
    
    # 서비스 시작
    docker-compose up -d
    
    # 헬스체크 대기
    log_info "서비스 시작 대기 중..."
    sleep 30
    
    # 헬스체크
    if curl -f http://localhost:5001/health > /dev/null 2>&1; then
        log_success "서비스 시작 완료"
    else
        log_error "서비스 헬스체크 실패"
        docker-compose logs hqmx-backend
        exit 1
    fi
}

# 정리 작업
cleanup() {
    log_info "정리 작업 수행 중..."
    
    # 사용하지 않는 Docker 이미지 정리
    docker image prune -f
    
    # 오래된 백업 정리 (30일 이상)
    find backup/ -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
    
    log_success "정리 작업 완료"
}

# 배포 검증
verify_deployment() {
    log_info "배포 검증 중..."
    
    # API 엔드포인트 테스트
    local endpoints=(
        "http://localhost:5001/health"
        "http://localhost:5001/health/detailed"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f "$endpoint" > /dev/null 2>&1; then
            log_success "✓ $endpoint"
        else
            log_error "✗ $endpoint"
            return 1
        fi
    done
    
    log_success "배포 검증 완료"
}

# 롤백 함수
rollback() {
    log_warning "롤백 시작..."
    
    # 최신 백업 찾기
    LATEST_BACKUP=$(find backup/ -type d -name "20*" | sort -r | head -n 1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -d "$LATEST_BACKUP" ]; then
        log_info "백업에서 복원 중: $LATEST_BACKUP"
        
        # 현재 서비스 중지
        docker-compose down
        
        # 백업에서 복원
        cp -r "$LATEST_BACKUP"/* ./
        
        # 서비스 재시작
        docker-compose up -d
        
        log_success "롤백 완료"
    else
        log_error "사용 가능한 백업이 없습니다."
        exit 1
    fi
}

# 사용법 출력
usage() {
    echo "사용법: $0 [OPTION]"
    echo ""
    echo "옵션:"
    echo "  deploy    - 전체 배포 실행"
    echo "  build     - 빌드만 실행"
    echo "  start     - 서비스 시작"
    echo "  stop      - 서비스 중지"
    echo "  restart   - 서비스 재시작"
    echo "  rollback  - 이전 버전으로 롤백"
    echo "  logs      - 로그 출력"
    echo "  status    - 서비스 상태 확인"
    echo "  cleanup   - 정리 작업 수행"
    echo ""
}

# 메인 함수
main() {
    case "$1" in
        "deploy")
            log_info "HQMX Backend 배포 시작..."
            check_environment
            backup_previous
            build_application
            build_docker
            deploy_services
            verify_deployment
            cleanup
            log_success "배포 완료!"
            ;;
        "build")
            build_application
            build_docker
            ;;
        "start")
            docker-compose up -d
            log_success "서비스 시작됨"
            ;;
        "stop")
            docker-compose down
            log_success "서비스 중지됨"
            ;;
        "restart")
            docker-compose restart
            log_success "서비스 재시작됨"
            ;;
        "rollback")
            rollback
            ;;
        "logs")
            docker-compose logs -f hqmx-backend
            ;;
        "status")
            docker-compose ps
            echo ""
            curl -s http://localhost:5001/health | jq . || echo "서비스가 응답하지 않습니다."
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"