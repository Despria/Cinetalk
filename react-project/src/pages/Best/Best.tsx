import { useEffect, useMemo, useState } from "react";

import { getMovies } from "../../api/movieApi.ts";
import { getLikes } from "../../api/likeApi.ts";
import { getReviewsByMovie } from "../../api/reviewApi.ts";
import type { Movie } from "../../interfaces/Movie.ts";

import "./Best.css";

type RankKey = "rating" | "reviews" | "likes";

function Best() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [reviewCounts, setReviewCounts] = useState<Record<number, number>>({});
  const [avgRatings, setAvgRatings] = useState<Record<number, number>>({});
  const [hasAvg, setHasAvg] = useState<Record<number, boolean>>({});
  const [rankKey, setRankKey] = useState<RankKey>("rating");

  useEffect(() => {
    Promise.all([getMovies(), getLikes()])
      .then(([m, likes]) => {
        setMovies(m);

        const lc: Record<number, number> = {};
        for (const l of likes)
          if (l.type === "like") lc[l.movieId] = (lc[l.movieId] ?? 0) + 1;
        setLikeCounts(lc);

        // 영화별 리뷰 수 + 평균 평점 병렬 로딩
        Promise.all(
          m.map((mv) =>
            getReviewsByMovie(mv.id).then((rs) => {
              const avg =
                rs.length === 0
                  ? null
                  : Math.round(
                      (rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10,
                    ) / 10;
              return {
                id: mv.id,
                count: rs.length,
                avg: avg ?? 0,
                hasAvg: avg != null,
              };
            }),
          ),
        ).then((rows) => {
          setReviewCounts(Object.fromEntries(rows.map((r) => [r.id, r.count])));
          setAvgRatings(Object.fromEntries(rows.map((r) => [r.id, r.avg])));
          setHasAvg(Object.fromEntries(rows.map((r) => [r.id, r.hasAvg])));
        });
      })
      .catch((err) => console.error("베스트 불러오기 실패:", err));
  }, []);

  const ranked = useMemo(() => {
    const list = [...movies];
    switch (rankKey) {
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
  }, [movies, rankKey, reviewCounts, likeCounts, avgRatings]);

  return (
    <main className="best-page">
      <div className="best-header">
        <h1 className="best-title">🏆 베스트 영화</h1>
        <p className="best-subtitle">평점 · 리뷰 · 좋아요 기준 랭킹</p>

        <div className="rank-tabs">
          {(
            [
              ["rating", "평점순"],
              ["reviews", "리뷰 많은순"],
              ["likes", "좋아요 많은순"],
            ] as [RankKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rank-tab ${rankKey === key ? "active" : ""}`}
              onClick={() => setRankKey(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="best-ranking">
        {ranked.map((m, i) => (
          <div className="rank-item" key={m.id}>
            <span className={`rank-no ${i < 3 ? `top-${i + 1}` : ""}`}>
              {i + 1}
            </span>
            <img className="rank-poster" src={m.poster} alt={m.title} />
            <div className="rank-info">
              <h3 className="rank-title">{m.title}</h3>
              <div className="rank-meta">
                <span className="rank-stat">
                  ★ {hasAvg[m.id] ? avgRatings[m.id] : "-"}
                </span>
                <span className="rank-stat">💬 {reviewCounts[m.id] ?? 0}</span>
                <span className="rank-stat">♥ {likeCounts[m.id] ?? 0}</span>
                <span className="rank-genre">{m.genre}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default Best;
