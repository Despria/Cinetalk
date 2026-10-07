import type { Movie } from "../../interfaces/Movie.ts";

interface DetailInfoProps {
  movie: Movie;
}

// 영화 상세 우측 정보 블록: 슬로건 + 줄거리.
// 스타일은 MovieDetail.css(info-block / movie-slogan / movie-plot)를 사용.
function DetailInfo({ movie }: DetailInfoProps) {
  return (
    <div className="info-block">
      <p className="movie-slogan">{movie.slogan}</p>

      <p className="movie-plot">{movie.plot}</p>
    </div>
  );
}

export default DetailInfo;
