import type { Movie } from "../../interfaces/Movie";
import type { LikeType } from "../../interfaces/Like";

import "./MovieCard.css";

interface Props {
  movie: Movie;

  /** 이 영화의 좋아요 수 (표시용) */
  likeCount: number;

  /** 현재 사용자가 이 영화에 누른 상태 맵 (type → 눌림 여부) */
  liked: Record<LikeType, boolean>;

  /** 평균 평점 (리뷰 기반). hasRating=false 면 표시하지 않음 */
  rating: number;

  /** 리뷰가 1개 이상 있어 평균 평점이 존재하는지 */
  hasRating: boolean;

  /** 카드 본문 클릭 → 상세 모달 오픈 */
  onCardClick: (movie: Movie) => void;

  /** 좋아요/찜 토글 (이벤트 전파 방지 — 카드 클릭과 분리) */
  onToggleLike: (movie: Movie, type: LikeType) => void;
}

function MovieCard({
  movie,
  likeCount,
  liked,
  rating,
  hasRating,
  onCardClick,
  onToggleLike,
}: Props) {
  return (
    <article
      className="movie-card"
      onClick={() => onCardClick(movie)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick(movie);
        }
      }}
    >
      <img src={movie.poster} alt={movie.title} loading="lazy" />

      <div className="movie-card-body">
        <h3>{movie.title}</h3>

        <div className="movie-card-meta">
          <span className="movie-card-rating">
            {hasRating ? `★ ${rating}` : "★ -"}
          </span>
          <span className="movie-card-genre">{movie.genre}</span>
        </div>
      </div>

      <div
        className="movie-card-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`like-btn ${liked.like ? "active" : ""}`}
          aria-pressed={liked.like}
          aria-label="좋아요"
          onClick={() => onToggleLike(movie, "like")}
        >
          <span className="like-icon">{liked.like ? "♥" : "♡"}</span>
          <span className="like-count">{likeCount}</span>
        </button>

        <button
          type="button"
          className={`fav-btn ${liked.favorite ? "active" : ""}`}
          aria-pressed={liked.favorite}
          aria-label="찜"
          onClick={() => onToggleLike(movie, "favorite")}
        >
          {liked.favorite ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}

export default MovieCard;
