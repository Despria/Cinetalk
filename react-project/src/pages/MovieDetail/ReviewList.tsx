import type { Review } from "../../interfaces/Review.ts";
import type { User } from "../../interfaces/User.ts";
import ReviewCard from "../../components/ReviewCard/ReviewCard.tsx";
// 리스트 컨테이너(.reviews-scroller / .empty-reviews-placeholder) 스타일이
// 현재 ReviewCard.css 에 정의되어 있어 함께 import. CSS 재구성 시 ReviewList.css로 옮기면 됨.
import "../../components/ReviewCard/ReviewCard.css";
import "./ReviewList.css";

interface Props {
  /** 이미 선택한 영화(movieId)로 필터링된 리뷰 목록 */
  reviews: Review[];

  /** 현재 로그인한 사용자 */
  currentUser?: User | null;

  /** 리뷰 삭제 요청 */
  onRequestDelete?: (id: number) => void;
}

function ReviewList({ reviews, currentUser, onRequestDelete }: Props) {
  if (reviews.length === 0) {
    return (
      <div className="empty-reviews-placeholder">아직 등록된 리뷰가 없습니다.</div>
    );
  }

  return (
    <div className="reviews-scroller">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          currentUser={currentUser}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}

export default ReviewList;
