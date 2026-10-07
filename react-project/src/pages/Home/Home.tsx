import { useEffect, useMemo, useState } from "react";

import HeroBanner from "../../components/HeroBanner/HeroBanner";
import MovieGrid from "../../components/MovieGrid/MovieGrid";
import { getMovies } from "../../api/movieApi.ts";
import { getLikes, toggleLike } from "../../api/likeApi.ts";
import type { Movie } from "../../interfaces/Movie.ts";
import type { Like, LikeType } from "../../interfaces/Like.ts";
import type { User } from "../../interfaces/User.ts";
import MovieDetailModal from "../../pages/MovieDetail/MovieDetailModal.tsx";

import "./Home.css";

type SortKey = "default" | "rating" | "reviews" | "likes";

interface Props {
  currentUser: User | null;
  onRequireLogin: () => void;
}

// 영화 한 편의 장르 목록.
// 서버가 genres 배열(genres/movie_genres 테이블 기반)을 내려주면 그대로 사용하고,
// 없으면(구버전 응답) genre 문자열 "SF, 액션"을 쉼표로 나눠서 사용한다.
const genresOf = (m: Movie): string[] =>
  m.genres ??
  m.genre
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function Home({ currentUser, onRequireLogin }: Props) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);

  // 목록 컨트롤
  const [genreFilter, setGenreFilter] = useState<string>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [onlyMyLikes, setOnlyMyLikes] = useState(false);

  // 상세 모달
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 영화별 리뷰 수 / 평균 평점(소수점 1자리) / 평점 보유 여부.
  // 서버가 영화 목록 응답에 함께 내려주는 reviewCount, rating(리뷰 평균)을 사용한다.
  // 리뷰 등록·삭제 후 영화 목록을 다시 불러오면(reloadData) 함께 갱신되므로
  // 영화마다 리뷰를 따로 요청하지 않는다. 리뷰가 없으면 평균 0, hasAvg false.
  const { reviewCounts, avgRatings, hasAvg } = useMemo(() => {
    const counts: Record<number, number> = {};
    const avgs: Record<number, number> = {};
    const flags: Record<number, boolean> = {};
    for (const m of movies) {
      const count = m.reviewCount ?? 0;
      counts[m.id] = count;
      avgs[m.id] = count > 0 ? Math.round(m.rating * 10) / 10 : 0;
      flags[m.id] = count > 0;
    }
    return { reviewCounts: counts, avgRatings: avgs, hasAvg: flags };
  }, [movies]);

  useEffect(() => {
    Promise.all([getMovies(), getLikes()])
      .then(([m, l]) => {
        setMovies(m);
        setLikes(l);
      })
      .catch((err) => console.error("목록 불러오기 실패:", err));
  }, []);

  // 좋아요·리뷰·영화 데이터 갱신 (모달에서 토글·등록·삭제·영화삭제 시)
  const reloadData = () => {
    getMovies()
      .then(setMovies)
      .catch((err) => console.error("영화 불러오기 실패:", err));
    getLikes()
      .then(setLikes)
      .catch((err) => console.error("좋아요 불러오기 실패:", err));
  };

  // movieId → 좋아요 수
  const likeCounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const l of likes) {
      if (l.type === "like") map[l.movieId] = (map[l.movieId] ?? 0) + 1;
    }
    return map;
  }, [likes]);

  // movieId → 현재 사용자의 토글 상태
  const likedMap = useMemo(() => {
    const map: Record<number, Record<LikeType, boolean>> = {};
    for (const m of movies) map[m.id] = { like: false, favorite: false };
    if (!currentUser) return map;
    for (const l of likes) {
      if (l.userId === currentUser.id) {
        map[l.movieId] = {
          like: map[l.movieId]?.like ?? false,
          favorite: map[l.movieId]?.favorite ?? false,
          [l.type]: true,
        } as Record<LikeType, boolean>;
      }
    }
    return map;
  }, [likes, movies, currentUser]);

  // 장르 태그: 영화들이 가진 장르를 낱개로 펼쳐 고유값만 추출 (영화 수가 많은 장르 순)
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of movies) {
      for (const g of genresOf(m)) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
      .map(([g]) => g);
    return ["전체", ...sorted];
  }, [movies]);

  // 내가 좋아요/찜한 영화 id 집합
  const myLikedIds = useMemo(() => {
    const set = new Set<number>();
    if (currentUser) {
      for (const l of likes) {
        if (l.userId === currentUser.id) set.add(l.movieId);
      }
    }
    return set;
  }, [likes, currentUser]);

  // 필터 + 정렬 적용
  const visibleMovies = useMemo(() => {
    let list = [...movies];

    // 선택한 장르를 "가지고 있는" 영화만 (여러 장르 중 하나라도 일치하면 포함)
    if (genreFilter !== "전체") {
      list = list.filter((m) => genresOf(m).includes(genreFilter));
    }

    if (onlyMyLikes) {
      list = list.filter((m) => myLikedIds.has(m.id));
    }

    switch (sortKey) {
      case "rating":
        list.sort(
          (a, b) => (avgRatings[b.id] ?? 0) - (avgRatings[a.id] ?? 0),
        );
        break;
      case "reviews":
        list.sort(
          (a, b) => (reviewCounts[b.id] ?? 0) - (reviewCounts[a.id] ?? 0),
        );
        break;
      case "likes":
        list.sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0));
        break;
    }

    return list;
  }, [
    movies,
    genreFilter,
    onlyMyLikes,
    sortKey,
    myLikedIds,
    reviewCounts,
    likeCounts,
    avgRatings,
  ]);

  // 좋아요/찜 토글
  const handleToggleLike = async (movie: Movie, type: LikeType) => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    try {
      await toggleLike(currentUser.id, movie.id, type);
      reloadData();
    } catch (err) {
      console.error("좋아요 토글 실패:", err);
    }
  };

  return (
    <main className="home">
      <HeroBanner />

      <div className="list-controls">
        <div className="genre-filters">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              className={`genre-chip ${genreFilter === g ? "active" : ""}`}
              onClick={() => setGenreFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="list-controls-right">
          <select
            className="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="정렬"
          >
            <option value="default">기본순</option>
            <option value="rating">평점순</option>
            <option value="reviews">리뷰 많은순</option>
            <option value="likes">좋아요 많은순</option>
          </select>

          <button
            type="button"
            className={`my-likes-toggle ${onlyMyLikes ? "active" : ""}`}
            onClick={() => {
              if (!currentUser) {
                onRequireLogin();
                return;
              }
              setOnlyMyLikes((v) => !v);
            }}
          >
            {onlyMyLikes ? "♥" : "♡"} 좋아요·찜만 보기
          </button>
        </div>
      </div>

      <MovieGrid
        movies={visibleMovies}
        likeCounts={likeCounts}
        likedMap={likedMap}
        avgRatings={avgRatings}
        hasAvg={hasAvg}
        onCardClick={(m) => setSelectedId(m.id)}
        onToggleLike={handleToggleLike}
      />

      <MovieDetailModal
        movieId={selectedId}
        currentUser={currentUser}
        onClose={() => setSelectedId(null)}
        onRequireLogin={onRequireLogin}
        onDataChanged={reloadData}
      />
    </main>
  );
}

export default Home;
