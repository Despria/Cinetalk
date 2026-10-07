import { useState } from "react";
import Modal from "../../components/Modal/Modal.tsx";
import "../../components/Form.css";
import "../../components/ReviewCard/ReviewCard.css";
import "./ReviewWriteModal.css";

const MAX_RATING = 5;

interface ReviewWriteModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 등록 버튼 클릭 시 (rating, content) 를 상위로 전달 (저장은 상위가 수행) */
  onSubmit: (rating: number, content: string) => void;
}

function ReviewWriteModal({ open, onClose, onSubmit }: ReviewWriteModalProps) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    onSubmit(rating, content);
  };

  return (
    <Modal open={open} onClose={onClose} size="medium">
      <div className="review-write-modal">
        <div className="form-header">
          <h2 className="form-title">리뷰 작성</h2>
        </div>

        <form className="form-body">
          {/* 별점 입력: ReviewCard.css 의 .star / .star.empty 재사용 */}
          <div className="form-group">
            <label>평점</label>

            <div className="rating-input">
              {Array.from({ length: MAX_RATING }, (_, i) => {
                const value = i + 1;

                return (
                  <button
                    key={value}
                    type="button"
                    className={`rating-star ${
                      value <= rating ? "star" : "star empty"
                    }`}
                    onClick={() => setRating(value)}
                    aria-label={`${value}점`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
          </div>

          {/* 내용 입력 */}
          <div className="form-group">
            <label>한줄평</label>

            <textarea
              className="interactive-control"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="영화에 대한 솔직한 감상을 남겨주세요."
            />
          </div>

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              취소
            </button>

            <button type="button" className="btn" onClick={handleSubmit}>
              등록
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default ReviewWriteModal;
