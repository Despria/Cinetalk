"""
chatbot_server.py - 영화 챗봇 API 서버 (FastAPI)

  React ChatWidget -> api.ts -> POST /api/chat -> rag_core.rag_answer() -> Ollama / Milvus

실행
    pip install fastapi "uvicorn[standard]" "pydantic>=2" python-dotenv \
                langchain-core langchain-ollama pymilvus
    uvicorn chatbot_server:app --host 127.0.0.1 --port 8000

요청/응답
    POST /api/chat   {"messages": [{"role": "user", "content": "..."}, ...]}
                  -> {"answer": "...", "movies": [{"movie_id": 269, "title": "..."}]}
    GET  /api/health

설정 (.env 또는 환경변수, 모두 선택)
    CORS_ORIGINS(http://localhost:5173,http://127.0.0.1:5173)   쉼표로 구분
    MAX_CONCURRENCY(2)       동시에 처리할 질문 수 (로컬 LLM은 동시 처리에 약하므로 작게)
    QUEUE_TIMEOUT_SEC(30)    대기열에서 기다릴 최대 시간
    RATE_LIMIT_PER_MIN(20)   접속 IP당 분당 요청 수
    MAX_QUESTION_CHARS(1000) 질문 최대 글자 수
"""

import logging
import threading
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import rag_core

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("chatbot-server")

env = rag_core.env
MAX_CONCURRENCY = int(env("MAX_CONCURRENCY", "2"))
QUEUE_TIMEOUT_SEC = float(env("QUEUE_TIMEOUT_SEC", "30"))
RATE_LIMIT_PER_MIN = int(env("RATE_LIMIT_PER_MIN", "20"))
MAX_QUESTION_CHARS = int(env("MAX_QUESTION_CHARS", "1000"))
CORS_ORIGINS = [o.strip() for o in env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001").split(",") if o.strip()]

# ----------------------------- 요청/응답 모델 -----------------------------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


class Movie(BaseModel):
    movie_id: int
    title: str


class ChatResponse(BaseModel):
    answer: str
    movies: list[Movie]


# ----------------------------- 앱 / 보호 장치 -----------------------------

app = FastAPI(title="CineTalk Chatbot API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,          # "*" 대신 사이트 주소만 허용
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_slots = threading.BoundedSemaphore(MAX_CONCURRENCY)
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def _allowed_by_rate_limit(ip: str) -> bool:
    """접속 IP당 분당 요청 수 제한 (메모리 기반, 서버 1대 기준).
    nginx 등 리버스 프록시 뒤에서는 모든 요청이 프록시 IP로 보이므로 프록시에서 X-Forwarded-For를 처리하세요."""
    now = time.monotonic()
    with _hits_lock:
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_LIMIT_PER_MIN:
            return False
        q.append(now)
        return True


# ----------------------------- 엔드포인트 -----------------------------

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    # 일반 def로 선언해, 오래 걸리는 LLM 호출이 이벤트 루프를 막지 않고 스레드풀에서 실행되게 한다.
    ip = request.client.host if request.client else "unknown"
    if not _allowed_by_rate_limit(ip):
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 잠시 후 다시 시도해 주세요.")

    last = req.messages[-1]
    question = last.content.strip()
    if last.role != "user" or not question:
        raise HTTPException(status_code=400, detail="마지막 메시지는 비어 있지 않은 사용자 메시지여야 해요.")
    if len(question) > MAX_QUESTION_CHARS:
        raise HTTPException(status_code=400, detail=f"질문은 {MAX_QUESTION_CHARS}자 이내로 입력해 주세요.")

    if not _slots.acquire(timeout=QUEUE_TIMEOUT_SEC):
        raise HTTPException(status_code=503, detail="지금 질문이 많아 답변이 지연되고 있어요. 잠시 후 다시 시도해 주세요.")
    try:
        started = time.monotonic()
        answer, results = rag_core.rag_answer(question)   # 1차 버전: 마지막 사용자 질문만 사용
        log.info("답변 완료 (%.1fs) 질문=%r", time.monotonic() - started, question[:80])
    except Exception:
        log.exception("답변 생성 실패")
        raise HTTPException(status_code=500, detail="답변을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.")
    finally:
        _slots.release()

    seen, movies = set(), []
    for r in results:
        e = r["entity"]
        if e["movie_id"] not in seen:
            seen.add(e["movie_id"])
            movies.append(Movie(movie_id=e["movie_id"], title=e["title"]))
    return ChatResponse(answer=answer, movies=movies)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "collection": rag_core.COLLECTION_NAME,
        "llm_model": rag_core.LLM_MODEL,
        "directors": len(rag_core.DIRECTORS),
        "genres": len(rag_core.GENRES),
    }
