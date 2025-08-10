#!/bin/bash

# HQMX Backend 모니터링 스크립트
BASE_URL="http://165.232.95.144:5001"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 HQMX Backend 모니터링 대시보드${NC}"
echo -e "${CYAN}=====================================${NC}"

# 헬스체크 먼저 수행
HEALTH_STATUS=$(curl -s "$BASE_URL/health" | jq -r '.status' 2>/dev/null)
if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✅ 서버 상태: 정상${NC}"
else
    echo -e "${RED}❌ 서버 상태: 비정상${NC}"
    exit 1
fi

echo -e "\n${BLUE}📊 시스템 상태:${NC}"
SYSTEM_DATA=$(curl -s "$BASE_URL/monitoring/status")
if [ $? -eq 0 ]; then
    UPTIME=$(echo "$SYSTEM_DATA" | jq -r '.system.uptime | round')
    MEMORY_RSS=$(echo "$SYSTEM_DATA" | jq -r '.system.memory.rss / 1024 / 1024 | round')
    MEMORY_HEAP=$(echo "$SYSTEM_DATA" | jq -r '.system.memory.heapUsed / 1024 / 1024 | round')
    CPU_USER=$(echo "$SYSTEM_DATA" | jq -r '.system.cpu.user / 1000000 | round')
    
    echo -e "  🕐 업타임: ${YELLOW}${UPTIME}초${NC}"
    echo -e "  💾 메모리 RSS: ${YELLOW}${MEMORY_RSS}MB${NC}"
    echo -e "  🧠 Heap 사용량: ${YELLOW}${MEMORY_HEAP}MB${NC}"
    echo -e "  ⚡ CPU 사용자: ${YELLOW}${CPU_USER}초${NC}"
else
    echo -e "${RED}  ❌ 시스템 데이터를 불러올 수 없습니다${NC}"
fi

echo -e "\n${BLUE}📈 성능 정보:${NC}"
PERF_DATA=$(curl -s "$BASE_URL/monitoring/status")
if [ $? -eq 0 ]; then
    RSS=$(echo "$PERF_DATA" | jq -r '.performance.memoryUsage.rss')
    HEAP_TOTAL=$(echo "$PERF_DATA" | jq -r '.performance.memoryUsage.heapTotal')
    HEAP_USED=$(echo "$PERF_DATA" | jq -r '.performance.memoryUsage.heapUsed')
    HEAP_PERCENT=$((HEAP_USED * 100 / HEAP_TOTAL))
    
    echo -e "  📊 RSS: ${YELLOW}${RSS}MB${NC}"
    echo -e "  📦 Heap Total: ${YELLOW}${HEAP_TOTAL}MB${NC}"
    echo -e "  🔥 Heap Used: ${YELLOW}${HEAP_USED}MB (${HEAP_PERCENT}%)${NC}"
    
    # 메모리 사용량 경고
    if [ $HEAP_PERCENT -gt 80 ]; then
        echo -e "  ${RED}⚠️  메모리 사용량이 높습니다!${NC}"
    elif [ $HEAP_PERCENT -gt 60 ]; then
        echo -e "  ${YELLOW}⚠️  메모리 사용량이 중간입니다${NC}"
    else
        echo -e "  ${GREEN}✅ 메모리 사용량이 정상입니다${NC}"
    fi
else
    echo -e "${RED}  ❌ 성능 데이터를 불러올 수 없습니다${NC}"
fi

echo -e "\n${BLUE}🌐 API 통계:${NC}"
STATS_DATA=$(curl -s "$BASE_URL/monitoring/stats")
if [ $? -eq 0 ]; then
    TOTAL_REQUESTS=$(echo "$STATS_DATA" | jq -r '.api.totalRequests')
    SUCCESS_REQUESTS=$(echo "$STATS_DATA" | jq -r '.api.successfulRequests')
    FAILED_REQUESTS=$(echo "$STATS_DATA" | jq -r '.api.failedRequests')
    AVG_RESPONSE_TIME=$(echo "$STATS_DATA" | jq -r '.api.averageResponseTime')
    
    echo -e "  📊 총 요청: ${YELLOW}${TOTAL_REQUESTS}${NC}"
    echo -e "  ✅ 성공 요청: ${GREEN}${SUCCESS_REQUESTS}${NC}"
    echo -e "  ❌ 실패 요청: ${RED}${FAILED_REQUESTS}${NC}"
    echo -e "  ⏱️  평균 응답시간: ${YELLOW}${AVG_RESPONSE_TIME}ms${NC}"
    
    # 다운로드 통계
    TOTAL_DOWNLOADS=$(echo "$STATS_DATA" | jq -r '.downloads.totalDownloads')
    SUCCESS_DOWNLOADS=$(echo "$STATS_DATA" | jq -r '.downloads.successfulDownloads')
    FAILED_DOWNLOADS=$(echo "$STATS_DATA" | jq -r '.downloads.failedDownloads')
    
    echo -e "  📥 총 다운로드: ${YELLOW}${TOTAL_DOWNLOADS}${NC}"
    echo -e "  ✅ 성공 다운로드: ${GREEN}${SUCCESS_DOWNLOADS}${NC}"
    echo -e "  ❌ 실패 다운로드: ${RED}${FAILED_DOWNLOADS}${NC}"
else
    echo -e "${RED}  ❌ API 통계를 불러올 수 없습니다${NC}"
fi

echo -e "\n${BLUE}💾 저장소 통계:${NC}"
if [ $? -eq 0 ]; then
    TOTAL_FILES=$(echo "$STATS_DATA" | jq -r '.storage.totalFiles')
    TOTAL_SIZE=$(echo "$STATS_DATA" | jq -r '.storage.totalSize')
    AVG_FILE_SIZE=$(echo "$STATS_DATA" | jq -r '.storage.averageFileSize')
    
    echo -e "  📁 총 파일: ${YELLOW}${TOTAL_FILES}${NC}"
    echo -e "  💽 총 크기: ${YELLOW}${TOTAL_SIZE} bytes${NC}"
    echo -e "  📏 평균 파일 크기: ${YELLOW}${AVG_FILE_SIZE} bytes${NC}"
else
    echo -e "${RED}  ❌ 저장소 통계를 불러올 수 없습니다${NC}"
fi

echo -e "\n${BLUE}📝 최근 로그 (마지막 3줄):${NC}"
LOGS_DATA=$(curl -s "$BASE_URL/monitoring/logs")
if [ $? -eq 0 ]; then
    echo "$LOGS_DATA" | jq -r '.logs[-3:] | .[]' 2>/dev/null | while read -r line; do
        if [[ $line == *"ERROR"* ]]; then
            echo -e "  ${RED}❌ $line${NC}"
        elif [[ $line == *"WARN"* ]]; then
            echo -e "  ${YELLOW}⚠️  $line${NC}"
        elif [[ $line == *"INFO"* ]]; then
            echo -e "  ${GREEN}ℹ️  $line${NC}"
        else
            echo -e "  📝 $line"
        fi
    done
else
    echo -e "${RED}  ❌ 로그를 불러올 수 없습니다${NC}"
fi

echo -e "\n${BLUE}🔧 환경 정보:${NC}"
ENV_DATA=$(curl -s "$BASE_URL/monitoring/status")
if [ $? -eq 0 ]; then
    NODE_VERSION=$(echo "$ENV_DATA" | jq -r '.environment.nodeVersion')
    PLATFORM=$(echo "$ENV_DATA" | jq -r '.environment.platform')
    ENV=$(echo "$ENV_DATA" | jq -r '.environment.env')
    
    echo -e "  🟢 Node.js: ${YELLOW}${NODE_VERSION}${NC}"
    echo -e "  🖥️  플랫폼: ${YELLOW}${PLATFORM}${NC}"
    echo -e "  🌍 환경: ${YELLOW}${ENV}${NC}"
else
    echo -e "${RED}  ❌ 환경 정보를 불러올 수 없습니다${NC}"
fi

echo -e "\n${PURPLE}🕐 현재 시간: $(date)${NC}"
echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}모니터링 완료! 🚀${NC}"
