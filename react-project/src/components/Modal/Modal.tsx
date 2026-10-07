import { useEffect, type ReactNode } from "react";
import "./Modal.css";

export type ModalSize = "small" | "medium" | "large" | "fullscreen";

interface ModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 모달 내부 컴포넌트 */
  children: ReactNode;

  /** 모달 크기 */
  size?: ModalSize;

  /** X 버튼 표시 여부 */
  showCloseButton?: boolean;

  /** Overlay 클릭 시 닫기 */
  closeOnOverlay?: boolean;

  /** ESC 키로 닫기 */
  closeOnEsc?: boolean;
}

function Modal({
  open,
  onClose,
  children,
  size = "medium",
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEsc = true,
}: ModalProps) {
  /**
   * ESC 키 처리
   */
  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeOnEsc, onClose]);

  /**
   * 모달 오픈 시 배경(body) 스크롤 잠금.
   * 여러 모달이 동시에 떠도 안전하게 이전 overflow를 기억해 원복.
   */
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /**
   * 열려있지 않으면 렌더링하지 않음
   */
  if (!open) {
    return null;
  }

  /**
   * Overlay 클릭
   */
  const handleOverlayClick = () => {
    if (closeOnOverlay) {
      onClose();
    }
  };

  /**
   * Modal 내부 클릭 시 Overlay 이벤트 차단
   */
  const handleModalClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-window modal-${size}`} onClick={handleModalClick}>
        {showCloseButton && (
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        )}

        {children}
      </div>
    </div>
  );
}

export default Modal;
