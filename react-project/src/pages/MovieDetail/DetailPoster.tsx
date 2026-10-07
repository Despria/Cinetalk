import type { Movie } from "../../interfaces/Movie.ts";

interface DetailPosterProps {
  movie: Movie;
}

// 영화 상세 좌측 패널: 포스터 배경 + 메타(장르 / 제목 / 평점·개봉·상영시간).
// 스타일은 MovieDetail.css(detail-left-panel / detail-panel-* / detail-*)를 사용.
function DetailPoster({ movie }: DetailPosterProps) {
  return (
    <div className="detail-left-panel">
      <div
        className="detail-panel-artwork"
        style={{ backgroundImage: `url(${movie.poster})` }}
      />

      <div className="detail-panel-gradient" />

      <div className="detail-panel-meta">
        <span className="detail-genre">{movie.genre}</span>

        <h2 className="detail-main-title">{movie.title}</h2>

        <div className="detail-specs">
          <span>★ {movie.rating}</span>

          <span>
            {new Date(movie.releaseDate).toLocaleDateString("ko-KR")}
          </span>

          <span>{movie.runningTime}분</span>
        </div>
      </div>
    </div>
  );
}

export default DetailPoster;
