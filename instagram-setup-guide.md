# 인스타그램 분석 설정 가이드

## 1. 인스타그램 계정 준비

### 필수 조건:
- ✅ 실제 인스타그램 계정 (가짜 계정 금지)
- ✅ 2단계 인증 비활성화 (봇 감지 방지)
- ✅ 최소 1주일 이상 된 계정
- ✅ 정상적인 활동 이력

### 권장사항:
- 🔄 여러 계정 준비 (로테이션)
- 🔄 각 계정별 다른 IP 사용
- 🔄 자연스러운 활동 패턴

## 2. 환경변수 설정

### backend/.env 파일에 추가:
```bash
# 인스타그램 자격증명
INSTA_USER="your_instagram_username"
INSTA_PASS="your_instagram_password"

# 프록시 설정 (권장)
RESIDENTIAL_PROXIES="http://proxy1:port,http://proxy2:port"
```

## 3. 보안 주의사항

### ⚠️ 계정 보호:
- 로그인 시도 실패 시 즉시 중단
- 의심스러운 활동 감지 시 계정 교체
- 정기적인 비밀번호 변경

### ⚠️ 사용량 제한:
- 시간당 최대 10-20개 분석
- 일일 최대 100개 분석
- 계정당 최대 3-5개 동시 세션

## 4. 테스트 방법

### 로컬 테스트:
```bash
cd backend
npm run dev
```

### API 테스트:
```bash
curl -X POST http://localhost:5001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/p/EXAMPLE/"}'
```

## 5. 문제 해결

### 일반적인 오류:
1. **로그인 실패**: 자격증명 확인, 2단계 인증 비활성화
2. **봇 차단**: 프록시 변경, 요청 간격 늘리기
3. **세션 만료**: 재로그인, 쿠키 갱신

### 모니터링:
- 로그 확인: `tail -f logs/app.log`
- 세션 상태 확인: Redis 모니터링
- 차단 감지: HTTP 403/429 응답 모니터링
