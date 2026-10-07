import type { Review } from "../../interfaces/Review.ts";
import type { User } from "../../interfaces/User.ts";
import "./ReviewCard.css";

interface Props {
  review: Review;

  /** 현재 로그인한 사용자 (본인 리뷰 삭제 버튼 노출 판정) */
  currentUser?: User | null;

  /** 삭제 요청 (상위에서 확인 모달 처리) */
  onRequestDelete?: (id: number) => void;
}

// 별점은 1~5 정수로 가정 (CSS .star / .star.empty 5칸 기준)
const MAX_RATING = 5;

function ReviewCard({ review, currentUser, onRequestDelete }: Props) {
  // 수정 이력이 있으면 수정일, 없으면 작성일 표시
  const date = review.updatedAt ?? review.createdAt;
  const authorName = review.user?.nickname ?? "익명";
  const isMine = currentUser != null && currentUser.id === review.userId;
  // 삭제 권한: 본인 리뷰이거나 관리자
  const canDelete = isMine || !!currentUser?.authority;

  return (
    <article className="review-card">
      <div className="review-header">
        <div className="review-user">
          <div className="review-avatar">
            {authorName.charAt(0)}
          </div>
          <span className="review-author">{authorName}</span>
          {isMine && <span className="review-tag">내 리뷰</span>}
        </div>

        <div className="review-rating">
          {Array.from({ length: MAX_RATING }, (_, i) => (
            <span key={i} className={i < review.rating ? "star" : "star empty"}>
              ★
            </span>
          ))}
        </div>
      </div>

      <p className="review-content">{review.content}</p>

      <div className="review-footer">
        <span className="review-date">
          {new Date(date).toLocaleDateString("ko-KR")}
        </span>

        {canDelete && onRequestDelete && (
          <button
            type="button"
            className="review-delete-btn"
            onClick={() => onRequestDelete(review.id)}
          >
            삭제
          </button>
        )}
      </div>
    </article>
  );
}

export default ReviewCard;
