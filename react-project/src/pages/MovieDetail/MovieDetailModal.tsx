import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Movie } from "../../interfaces/Movie.ts";
import type { Review } from "../../interfaces/Review.ts";
import type { User } from "../../interfaces/User.ts";
import Modal from "../../components/Modal/Modal.tsx";
import { getMovie, deleteMovie } from "../../api/movieApi.ts";
import {
  getReviewsByMovie,
  createReview,
  deleteReview,
} from "../../api/reviewApi.ts";
import DetailPoster from "./DetailPoster.tsx";
import DetailInfo from "./DetailInfo.tsx";
import ReviewList from "./ReviewList.tsx";
import ReviewWriteModal from "../../modals/ReviewWriteModal/ReviewWriteModal.tsx";
import ReviewResultModal, {
  type ReviewStatus,
} from "../../modals/ReviewResultModal/ReviewResultModal.tsx";

import "./MovieDetail.css";

interface MovieDetailModalProps {
  /** 열린 영화 id (null 이면 닫힘) */
  movieId: number | null;

  currentUser: User | null;

  onClose: () => void;

  /** 로그인 필요 동작에서 로그인 모달을 여는 콜백 */
  onRequireLogin: () => void;

  /** 좋아요/리뷰 등 데이터 변동 시 상위 갱신 */
  onDataChanged?: () => void;
}

function MovieDetailModal({
  movieId,
  currentUser,
  onClose,
  onRequireLogin,
  onDataChanged,
}: MovieDetailModalProps) {
  const open = movieId !== null;
  const navigate = useNavigate();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  // 리뷰 작성 모달 / 결과 모달 / 삭제 확인
  const [writeOpen, setWriteOpen] = useState(false);
  const [result, setResult] = useState<{
    open: boolean;
    status: ReviewStatus;
    message: string;
  }>({ open: false, status: "success", message: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // 영화 삭제(관리자)
  const [confirmMovieDelete, setConfirmMovieDelete] = useState(false);

  const loadReviews = (id: number) => {
    getReviewsByMovie(id)
      .then(setReviews)
      .catch((err) => console.error("리뷰 불러오기 실패:", err));
  };

  // 영화가 바뀔 때마다 재조회
  useEffect(() => {
    if (movieId == null) return;

    setLoading(true);
    Promise.all([getMovie(movieId), getReviewsByMovie(movieId)])
      .then(([m, r]) => {
        setMovie(m);
        setReviews(r);
      })
      .catch((err) => console.error("영화 상세 불러오기 실패:", err))
      .finally(() => setLoading(false));
  }, [movieId]);

  // 리뷰 쓰기 버튼: 미로그인 → 로그인 유도 / 로그인 → 작성 모달
  const handleWriteClick = () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    setWriteOpen(true);
  };

  // 리뷰 등록
  const handleReviewSubmit = async (rating: number, content: string) => {
    if (!movie || !currentUser) return;

    if (rating === 0) {
      setResult({ open: true, status: "error", message: "평점을 선택해주세요." });
      return;
    }

    if (!content.trim()) {
      setResult({
        open: true,
        status: "error",
        message: "리뷰 내용을 입력해주세요.",
      });
      return;
    }

    try {
      await createReview({
        movieId: movie.id,
        userId: currentUser.id,
        rating,
        content: content.trim(),
      });

      setWriteOpen(false);
      loadReviews(movie.id);
      onDataChanged?.();
      setResult({ open: true, status: "success", message: "리뷰가 등록되었습니다." });
    } catch (err) {
      console.error("리뷰 등록 실패:", err);
      setWriteOpen(false);
      setResult({ open: true, status: "error", message: "리뷰 등록에 실패했습니다." });
    }
  };

  // 리뷰 삭제
  const handleReviewDelete = async () => {
    if (confirmDeleteId == null) return;
    try {
      await deleteReview(confirmDeleteId);
      if (movie) loadReviews(movie.id);
      onDataChanged?.();
    } catch (err) {
      console.error("리뷰 삭제 실패:", err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // 영화 삭제 (관리자)
  const handleMovieDelete = async () => {
    if (!movie) return;
    try {
      await deleteMovie(movie.id);
      onDataChanged?.();
      onClose();
    } catch (err) {
      console.error("영화 삭제 실패:", err);
    } finally {
      setConfirmMovieDelete(false);
    }
  };

  // 영화 수정 (관리자) — 모달 닫고 편집 페이지로 이동
  const handleMovieEdit = () => {
    if (!movie) return;
    onClose();
    navigate(`/edit/${movie.id}`);
  };

  return (
    <Modal open={open} onClose={onClose} size="large" closeOnOverlay closeOnEsc>
      {loading && (
        <div className="movie-detail-loading">불러오는 중…</div>
      )}

      {!loading && movie && (
        <div className="movie-detail movie-detail--in-modal">
          <div className="detail-grid">
            {/* 좌측: 포스터 + 메타 */}
            <DetailPoster movie={movie} />

            {/* 우측: 슬로건/줄거리/리뷰 */}
            <div className="detail-right-panel">
              <DetailInfo movie={movie} />

              <div className="reviews-section">
                <div className="reviews-header-row">
                  <span className="reviews-title-text">
                    리뷰 {reviews.length}개
                  </span>

                  <div className="reviews-header-actions">
                    {currentUser?.authority && (
                      <>
                        <button
                          type="button"
                          className="btn btn-cancel"
                          onClick={handleMovieEdit}
                        >
                          영화 수정
                        </button>
                        <button
                          type="button"
                          className="btn btn-cancel btn-delete"
                          onClick={() => setConfirmMovieDelete(true)}
                        >
                          영화 삭제
                        </button>
                      </>
                    )}
                    <button className="btn" onClick={handleWriteClick}>
                      리뷰 쓰기
                    </button>
                  </div>
                </div>

                <ReviewList
                  reviews={reviews}
                  currentUser={currentUser}
                  onRequestDelete={(id) => setConfirmDeleteId(id)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리뷰 작성 모달 */}
      <ReviewWriteModal
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        onSubmit={handleReviewSubmit}
      />

      {/* 결과 알림 모달 */}
      <ReviewResultModal
        open={result.open}
        status={result.status}
        message={result.message}
        onClose={() => setResult((r) => ({ ...r, open: false }))}
      />

      {/* 삭제 확인 모달 */}
      <ReviewResultModal
        open={confirmDeleteId !== null}
        status="error"
        message="이 리뷰를 삭제하시겠습니까?"
        onClose={() => setConfirmDeleteId(null)}
        confirmMode
        onConfirm={handleReviewDelete}
      />

      {/* 영화 삭제 확인 모달 (관리자) */}
      <ReviewResultModal
        open={confirmMovieDelete}
        status="error"
        message="이 영화를 삭제하시겠습니까? 등록된 리뷰도 함께 사라집니다."
        onClose={() => setConfirmMovieDelete(false)}
        confirmMode
        onConfirm={handleMovieDelete}
      />
    </Modal>
  );
}

export default MovieDetailModal;
