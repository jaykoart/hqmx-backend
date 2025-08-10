# HQMX Backend Dockerfile

# Node.js 18 LTS Alpine 이미지 사용 (최적화된 크기)
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    git \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# yt-dlp 설치 (최신 버전)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hqmx -u 1001 -G nodejs

# package.json과 package-lock.json 복사
COPY package*.json ./

# Node.js 의존성 설치 (개발 의존성 포함)
RUN npm ci && npm cache clean --force

# 소스 코드 복사
COPY . .

# 디버깅: 파일 확인
RUN ls -la && echo "=== tsconfig.json exists ===" && ls -la tsconfig.json

# TypeScript 컴파일
RUN npm run build

# 불필요한 파일 정리
RUN rm -rf src/ && \
    rm -rf node_modules/@types/ && \
    npm prune --production

# 로그 및 임시 디렉토리 생성
RUN mkdir -p /app/logs /app/temp /tmp/hqmx && \
    chown -R hqmx:nodejs /app/logs /app/temp /tmp/hqmx

# 사용자 전환
USER hqmx

# 포트 설정
EXPOSE 5001

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=5001

# 애플리케이션 시작
CMD ["node", "dist/server.js"]