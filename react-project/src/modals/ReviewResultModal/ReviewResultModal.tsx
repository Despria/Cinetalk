import Modal from "../../components/Modal/Modal.tsx";
import "../../components/Alert.css";
import "./ReviewResultModal.css";

export type ReviewStatus = "success" | "error";

interface ReviewResultModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 리뷰 등록 결과 상태 */
  status: ReviewStatus;

  /** 사용자에게 보여줄 안내 메시지 */
  message: string;

  /** 삭제 확인 모드 (확인/취소 두 버튼) */
  confirmMode?: boolean;

  /** 삭제 확인 모드에서 '삭제' 클릭 시 실행 */
  onConfirm?: () => void;
}

// 리뷰 등록 결과(성공/실패) 안내 + 삭제 확인(confirmMode)을 겸하는 모달.
// alert-* 클래스는 공용 Alert.css 사용, .btn 보조 스타일은 ReviewResultModal.css.
function ReviewResultModal({
  open,
  onClose,
  status,
  message,
  confirmMode = false,
  onConfirm,
}: ReviewResultModalProps) {
  const isSuccess = status === "success";

  return (
    <Modal open={open} onClose={onClose} size="small" closeOnOverlay closeOnEsc>
      <div className="alert-panel">
        <div className={isSuccess ? "alert-icon-success" : "alert-icon-error"}>
          {confirmMode ? "🗑" : isSuccess ? "✓" : "✕"}
        </div>

        <h2 className="alert-title">
          {confirmMode
            ? "리뷰 삭제"
            : isSuccess
              ? "리뷰 등록 완료"
              : "리뷰 등록 실패"}
        </h2>

        <p className="alert-desc">{message}</p>

        <div className="alert-actions">
          {confirmMode ? (
            <>
              <button className="btn btn-cancel" onClick={onClose}>
                취소
              </button>
              <button className="btn" onClick={onConfirm}>
                삭제
              </button>
            </>
          ) : (
            <button className="btn" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ReviewResultModal;
