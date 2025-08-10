# HQMX Backend

전세계 사용자를 위한 고품질 미디어 다운로드 서비스의 백엔드 시스템입니다.

## 🚀 기능

- **다중 플랫폼 지원**: YouTube, Instagram, TikTok, Facebook 등 20+ 플랫폼
- **고품질 다운로드**: 4K/8K 비디오, 무손실 오디오 지원
- **실시간 진행상황**: Server-Sent Events를 통한 실시간 다운로드 진행상황
- **클라우드 스토리지**: Cloudflare R2를 통한 안전한 파일 저장
- **다국어 지원**: 20개 언어 지원
- **확장 가능한 아키텍처**: Redis 캐싱, Docker 컨테이너화

## 🏗️ 아키텍처

```
Client → Cloudflare → Nginx → Node.js Backend → yt-dlp → Cloudflare R2
                                    ↓
                                  Redis
```

## 📋 요구사항

- Node.js 18+
- Docker & Docker Compose
- yt-dlp
- FFmpeg
- Redis (선택사항)

## 🛠️ 설치 및 실행

### 개발 환경

```bash
# 저장소 클론
git clone https://github.com/yourusername/hqmx-backend.git
cd hqmx-backend

# 의존성 설치
npm install

# 환경 변수 설정
cp env.example .env
# .env 파일을 편집하여 필요한 값들을 설정

# 개발 서버 시작
npm run dev
```

### Docker로 실행

```bash
# Docker Compose로 전체 스택 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f hqmx-backend
```

### 프로덕션 배포

```bash
# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 🔧 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 서버 포트 | `5001` |
| `NODE_ENV` | 실행 환경 | `development` |
| `CLOUDFLARE_R2_ACCESS_KEY` | R2 액세스 키 | 필수 |
| `CLOUDFLARE_R2_SECRET_KEY` | R2 시크릿 키 | 필수 |
| `CLOUDFLARE_R2_BUCKET` | R2 버킷 이름 | 필수 |
| `REDIS_URL` | Redis 연결 URL | 선택사항 |
| `MAX_CONCURRENT_DOWNLOADS` | 최대 동시 다운로드 수 | `10` |

## 📚 API 문서

### 미디어 분석
```http
POST /analyze
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=..."
}
```

### 다운로드 시작
```http
POST /download
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=...",
  "mediaType": "video",
  "formatType": "mp4",
  "quality": "1080"
}
```

### 진행상황 모니터링 (SSE)
```http
GET /stream-progress/{taskId}
```

### 파일 다운로드
```http
GET /get-file/{taskId}
```

## 🔄 CI/CD

GitHub Actions를 사용한 자동 배포 파이프라인:

1. **코드 검사**: ESLint, TypeScript 컴파일
2. **테스트**: 단위 테스트 실행
3. **Docker 빌드**: 컨테이너 이미지 빌드 및 테스트
4. **배포**: DigitalOcean VPS로 자동 배포

## 📊 모니터링

### 헬스체크 엔드포인트
- `GET /health` - 기본 상태 확인
- `GET /health/detailed` - 상세 시스템 상태
- `GET /health/ready` - Kubernetes Readiness Probe
- `GET /health/live` - Kubernetes Liveness Probe

### 로깅
- 구조화된 JSON 로그
- 요청/응답 로깅
- 에러 추적 및 알림
- 성능 메트릭

## 🔒 보안

- **Rate Limiting**: IP별 요청 제한
- **CORS**: 허용된 도메인만 접근
- **헬멧**: 보안 헤더 자동 설정
- **입력 검증**: 모든 사용자 입력 검증
- **에러 처리**: 민감한 정보 노출 방지

## 🚀 배포 가이드

### DigitalOcean VPS 설정

1. **서버 생성**
   ```bash
   # Docker 설치
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Docker Compose 설치
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **배포 디렉토리 준비**
   ```bash
   mkdir -p /opt/hqmx-backend
   cd /opt/hqmx-backend
   ```

3. **환경 변수 설정**
   ```bash
   # .env 파일 생성 및 설정
   nano .env
   ```

### Cloudflare 설정

1. **DNS 설정**
   - A 레코드: `api.hqmx.net` → VPS IP
   - CNAME 레코드: `www.hqmx.net` → `hqmx.net`

2. **SSL/TLS 설정**
   - SSL/TLS 암호화 모드: Full (strict)
   - Always Use HTTPS: 활성화

3. **R2 버킷 설정**
   - 버킷 생성: `hqmx-media-storage`
   - API 토큰 생성 (R2 읽기/쓰기 권한)

## 🧪 테스트

```bash
# 단위 테스트
npm test

# 테스트 커버리지
npm run test:coverage

# E2E 테스트
npm run test:e2e
```

## 📈 성능 최적화

- **Redis 캐싱**: 작업 상태 및 메타데이터 캐싱
- **스트리밍**: 대용량 파일 스트리밍 다운로드
- **압축**: Gzip 응답 압축
- **로드 밸런싱**: Nginx 리버스 프록시
- **CDN**: Cloudflare 글로벌 CDN

## 🐛 문제 해결

### 일반적인 문제들

1. **yt-dlp 업데이트**
   ```bash
   pip3 install --upgrade yt-dlp
   ```

2. **디스크 공간 부족**
   ```bash
   # 임시 파일 정리
   docker exec hqmx-backend npm run cleanup
   ```

3. **메모리 부족**
   ```bash
   # 컨테이너 재시작
   docker-compose restart hqmx-backend
   ```

## 📞 지원

- **이슈 리포트**: GitHub Issues
- **문서**: [API 문서](https://api.hqmx.net/docs)
- **이메일**: support@hqmx.net

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

**HQMX Team** © 2024# HQMX Backend - R2 Integration Fixed 🔧
🚀 Deploy with VPS IP: 165.232.95.144
🔧 SSH Key Format Fixed - Retry Deployment
