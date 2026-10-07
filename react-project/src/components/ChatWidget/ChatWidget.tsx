import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { sendToLLM, type ChatMessage } from "./api.ts";

import "./ChatWidget.css";

// 첫 열림 때 표시할 AI 인사말
const GREETING: ChatMessage = {
  role: "assistant",
  content: "안녕하세요! CineTalk AI예요 🎬\n영화 추천이나 리뷰에 대해 무엇이든 물어보세요.",
};

/**
 * 우측 하단 플로팅 채팅 위젯
 * - 동그란 버튼(채팅 아이콘)을 누르면 채팅 팝업이 열림
 * - 대화 기록은 메모리에만 저장 (새로고침 시 초기화)
 * - LLM 통신은 ./api.ts 의 sendToLLM() 이 전담
 */
function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 새 메시지가 올 때마다 목록 맨 아래로 자동 스크롤
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, open]);

  // 팝업을 열 때 입력창에 포커스
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const canSend = input.trim().length > 0 && !isLoading;

  // 메시지 전송: user 추가 → 로딩 → LLM 응답 추가
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendToLLM(next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("LLM 호출 실패:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `죄송해요, 답변을 가져오지 못했어요. (${msg})` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  // Enter 전송 / Shift+Enter 줄바꿈
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="chat-root">
      {open && (
        <section className="chat-panel" aria-label="CineTalk AI 채팅">
          <header className="chat-header">
            <div className="chat-header-title">
              <span className="chat-online-dot" />
              <h3>CineTalk AI</h3>
            </div>
            <button
              type="button"
              className="chat-close-button"
              aria-label="채팅창 닫기"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>

          <div className="chat-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-msg assistant">
                <div className="chat-bubble chat-typing" aria-label="답변 작성 중">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          <form className="chat-input-row" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="chat-input"
              rows={1}
              placeholder="메시지를 입력하세요…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button type="submit" className="chat-send-button" disabled={!canSend} aria-label="전송">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </section>
      )}

      {/* 플로팅 동그란 버튼: 닫힘=채팅 아이콘 / 열림=✕ */}
      <button
        type="button"
        className="chat-fab"
        aria-label={open ? "채팅창 닫기" : "AI 채팅 열기"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm0 4h7v2H7v-2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default ChatWidget;
