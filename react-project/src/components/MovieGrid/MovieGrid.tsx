import type { Movie } from "../../interfaces/Movie.ts";
import type { LikeType } from "../../interfaces/Like.ts";
import MovieCard from "../MovieCard/MovieCard.tsx";
import "./MovieGrid.css";

interface Props {
  movies: Movie[];

  /** movieId → 좋아요 수 */
  likeCounts: Record<number, number>;

  /** movieId → 사용자 토글 상태 (type → 눌림 여부) */
  likedMap: Record<number, Record<LikeType, boolean>>;

  /** movieId → 평균 평점 (리뷰 기반) */
  avgRatings: Record<number, number>;

  /** movieId → 평균 평점 존재 여부 (리뷰 0개면 false) */
  hasAvg: Record<number, boolean>;

  /** 카드 클릭 → 상세 모달 오픈 */
  onCardClick: (movie: Movie) => void;

  /** 좋아요/찜 토글 */
  onToggleLike: (movie: Movie, type: LikeType) => void;
}

function MovieGrid({
  movies,
  likeCounts,
  likedMap,
  avgRatings,
  hasAvg,
  onCardClick,
  onToggleLike,
}: Props) {
  if (movies.length === 0) {
    return <div className="movie-grid-empty">표시할 영화가 없습니다.</div>;
  }

  return (
    <div className="movie-grid">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          likeCount={likeCounts[movie.id] ?? 0}
          liked={likedMap[movie.id] ?? { like: false, favorite: false }}
          rating={avgRatings[movie.id] ?? 0}
          hasRating={hasAvg[movie.id] ?? false}
          onCardClick={onCardClick}
          onToggleLike={onToggleLike}
        />
      ))}
    </div>
  );
}

export default MovieGrid;
