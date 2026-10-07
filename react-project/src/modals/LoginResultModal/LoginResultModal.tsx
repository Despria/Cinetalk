import Modal from "../../components/Modal/Modal.tsx";
import "../../components/Alert.css";
import "./LoginResultModal.css";

export type LoginStatus = "success" | "error";

interface LoginResultModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 로그인 결과 상태 */
  status: LoginStatus;

  /** 사용자에게 보여줄 안내 메시지 */
  message: string;
}

// 로그인 결과(성공/실패)를 안내 알림으로 띄우는 모달.
// alert-* 클래스는 공용 Alert.css를 사용하고, .btn 보조 스타일만 임시 CSS로 처리.
function LoginResultModal({
  open,
  onClose,
  status,
  message,
}: LoginResultModalProps) {
  const isSuccess = status === "success";

  return (
    <Modal open={open} onClose={onClose} size="small">
      <div className="alert-panel">
        <div className={isSuccess ? "alert-icon-success" : "alert-icon-error"}>
          {isSuccess ? "✓" : "✕"}
        </div>

        <h2 className="alert-title">{isSuccess ? "로그인 성공" : "로그인 실패"}</h2>

        <p className="alert-desc">{message}</p>

        <div className="alert-actions">
          <button className="btn" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default LoginResultModal;
