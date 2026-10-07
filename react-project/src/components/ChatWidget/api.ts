// ============================================================
// LLM 통신 담당 모듈 — Python 챗봇 서버(RAG) 연결 (CineTalk AI 채팅)
// ============================================================
// 동작 방식: 브라우저 → 챗봇 서버(POST /api/chat) → [검색 계획 + Milvus 검색 + Exaone 답변]
// - Ollama·Milvus는 서버 PC 안에서만 사용하므로 브라우저에 노출하지 않는다.
// - 모델, 프롬프트, 검색 방식을 바꿀 때는 이 파일이 아니라 서버(rag_core.py)만 수정하면 된다.

// 챗봇 서버 주소
// - 기본값 "/api/chat" (같은 주소의 /api 를 챗봇 서버로 넘기는 Vite 프록시 또는 nginx 사용)
// - 다른 주소를 직접 쓰려면 .env 에 VITE_CHAT_API_URL=http://서버IP:8000/api/chat 지정
const CHAT_API_URL: string = import.meta.env.VITE_CHAT_API_URL ?? "/chat-api/chat";

// 서버로 보낼 최근 메시지 수 (대화가 길어져도 요청 크기를 제한)
const MAX_HISTORY = 10;

// 답변 대기 제한 시간 (로컬 LLM은 검색 계획 + 답변 생성으로 10초 이상 걸릴 수 있다)
const TIMEOUT_MS = 120_000;

// 채팅 메시지 타입 (role: "user"=사용자, "assistant"=AI)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 대화 기록(메시지 배열)을 챗봇 서버로 보내고 답변 텍스트를 반환한다.
 * 에러가 나면 그대로 throw — 컴포넌트가 오류 메시지로 표시한다.
 */
export async function sendToLLM(messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY) }),
      signal: controller.signal,
    });

    // 서버가 보낸 오류 안내(detail)가 있으면 그대로 사용 (429: 요청 과다, 503: 대기 초과 등)
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(typeof body?.detail === "string" ? body.detail : `서버 오류 (${res.status})`);
    }

    // 응답 형식: { answer: "답변 텍스트", movies: [{ movie_id, title }, ...] }
    const data = await res.json();
    if (typeof data?.answer !== "string") {
      throw new Error("서버 응답 형식이 올바르지 않아요");
    }
    return data.answer;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("답변이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}