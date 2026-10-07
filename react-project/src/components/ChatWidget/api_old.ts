// ============================================================
// LLM 통신 담당 모듈 — Ollama 직접 연결 (CineTalk AI 채팅)
// ============================================================
// ★★★ LLM 연결은 이 파일만 수정하면 됩니다 ★★★
//
// 동작 방식: 브라우저가 서버 PC의 Ollama HTTP API(POST /api/chat)를 호출한다.
// (Ollama는 WebSocket 대신 HTTP API를 제공하므로 이 방식이 기본이다.)

// ★ 여기만 수정하면 됩니다 ★
// - 서버 PC 자체의 브라우저에서 접속할 때: http://127.0.0.1:11434 (그대로 두면 됨)
// - 다른 PC·휴대폰에서도 쓸 때:      http://서버PC의IP:11434
const OLLAMA_URL = "http://127.0.0.1:11434";

// Ollama에 설치한 모델명 (서버 터미널에서 `ollama list`로 확인 가능)
const MODEL = "gemma4:e4b";

// 채팅 메시지 타입 (role: "user"=사용자, "assistant"=AI)
// ※ 이 형식은 Ollama /api/chat 이 요구하는 형식과 같아서 그대로 전달하면 된다.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 대화 기록(메시지 배열)을 Ollama로 보내고 답변 텍스트를 반환한다.
 * 에러가 나면 그대로 throw — 컴포넌트가 오류 메시지로 표시한다.
 */
export async function sendToLLM(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: messages, // 대화 기록 전체 → 문맥이 유지된 채 답변함
      stream: false, // 전체 답변을 한 번에 받기 (true면 조각조각 스트리밍됨)
    }),
  });

  // 모델이 없거나(404) 서버 오류일 때의 안내
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama 오류 (${res.status}) ${text}`);
  }

  // 응답 형식: { message: { role: "assistant", content: "답변 텍스트" }, done: true, ... }
  const data = await res.json();
  const reply = data?.message?.content;
  if (typeof reply !== "string") {
    throw new Error("Ollama 응답 형식이 올바르지 않아요");
  }
  return reply;
}

// ------------------------------------------------------------
// 【서버 PC(우분투)에서 다른 기기도 채팅을 쓰려면 Ollama 설정 2가지】
// 1) 외부 접속 허용:  OLLAMA_HOST=0.0.0.0
//    (systemd 라면: sudo systemctl edit ollama 으로
//     [Service] 아래 Environment="OLLAMA_HOST=0.0.0.0" 추가 후 재시작)
// 2) 웹앱에서의 접근 허용(CORS):  OLLAMA_ORIGINS="*"
//    → 브라우저 콘솔에 CORS 오류가 뜰 때 필요.
//    서버 PC 자체 브라우저에서만 쓸 거면 기본 설정으로 충분하다.
// ------------------------------------------------------------
