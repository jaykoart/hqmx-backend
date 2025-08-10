# YouTube Data API 설정 가이드

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성
1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성 (예: hqmx-youtube-api)

### 1.2 YouTube Data API 활성화
1. API 및 서비스 → 라이브러리
2. "YouTube Data API v3" 검색 및 활성화

### 1.3 API 키 생성
1. API 및 서비스 → 사용자 인증 정보
2. "사용자 인증 정보 만들기" → "API 키"
3. 생성된 키 복사

## 2. 환경변수 설정

### 2.1 .env 파일에 추가
```bash
YOUTUBE_API_KEY=your_api_key_here
```

### 2.2 프론트엔드에서 사용
```javascript
// script.js에서 API 키 사용
const YOUTUBE_API_KEY = 'your_api_key_here';
```

## 3. 사용 예시

### 3.1 비디오 정보 가져오기
```javascript
async function getVideoInfo(videoId) {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`
    );
    return await response.json();
}
```

### 3.2 비용 모니터링
- Google Cloud Console → 결제 → 예산 및 알림 설정
- 일일/월간 사용량 제한 설정

## 4. 보안 설정

### 4.1 API 키 제한
1. 사용자 인증 정보 → API 키 → 편집
2. 애플리케이션 제한: "HTTP 리퍼러" 설정
3. API 제한: "YouTube Data API v3"만 선택

### 4.2 도메인 제한
```
https://hqmx.net/*
https://www.hqmx.net/*
```

## 5. 비용 최적화

### 5.1 캐싱 구현
```javascript
// 로컬 스토리지에 결과 캐싱
const cached = localStorage.getItem(`video_${videoId}`);
if (cached) return JSON.parse(cached);
```

### 5.2 요청 최소화
- 필요한 정보만 요청 (part 파라미터 최적화)
- 불필요한 요청 방지

## 6. 예상 비용

### 6.1 소규모 사용
- 일일 100회 요청
- 월 3,000회 요청
- 비용: 무료

### 6.2 중간 규모
- 일일 1,000회 요청
- 월 30,000회 요청
- 비용: 약 $0.10/월

### 6.3 대규모
- 일일 10,000회 요청
- 월 300,000회 요청
- 비용: 약 $1.50/월
