import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { Movie } from "../../interfaces/Movie.ts";
import {
  getMovie,
  createMovie,
  updateMovie,
  deleteMovie,
} from "../../api/movieApi.ts";
import { uploadPosterFromUrl } from "../../api/uploadApi.ts";
import "../../components/Form.css";
import "../../components/Alert.css";
import "./MovieForm.css";

const GENRE_OPTIONS = ["가족", "로맨스", "추리", "판타지", "SF", "전쟁", "드라마", "액션", "코미디", "스릴러", "애니메이션", "기타"];

const EMPTY_FORM: Omit<Movie, "id"> = {
  title: "",
  poster: "",
  genre: "SF",
  director: "",
  actors: "",
  releaseDate: new Date().toISOString().slice(0, 10),
  runningTime: 120,
  rating: 0,
  slogan: "",
  plot: "",
};

function MovieForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id != null;

  const [form, setForm] = useState<Omit<Movie, "id">>(EMPTY_FORM);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 수정 모드: 기존 영화 데이터 로드
  useEffect(() => {
    if (!isEdit || id == null) return;
    setLoading(true);
    getMovie(Number(id))
      .then((m) => {
        setForm({ ...EMPTY_FORM, ...m });
      })
      .catch((err) => {
        console.error("영화 불러오기 실패:", err);
        setError("영화 정보를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const update = (field: keyof typeof form, value: string | number) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "제목을 입력해주세요.";
    if (!form.director.trim()) return "감독을 입력해주세요.";
    if (form.runningTime <= 0) return "상영시간을 올바르게 입력해주세요.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // 1) poster URL이 외부 링크(http/https)면 서버로 보내 다운로드/저장 후 로컬 경로로 교체
      let poster = form.poster.trim();
      if (poster && /^https?:\/\//i.test(poster)) {
        try {
          poster = await uploadPosterFromUrl(poster);
        } catch (uploadErr) {
          console.error("포스터 저장 실패:", uploadErr);
          setError(
            "포스터 이미지를 저장하지 못했습니다. URL을 확인해 주세요.",
          );
          setSubmitting(false);
          return;
        }
      }

      // 2) poster가 비어있으면 임시 자동 생성
      if (!poster) {
        poster = `https://picsum.photos/seed/${encodeURIComponent(
          form.title.trim(),
        )}/300/450`;
      }

      const payload: Omit<Movie, "id"> = {
        ...form,
        title: form.title.trim(),
        director: form.director.trim(),
        actors: form.actors.trim(),
        slogan: form.slogan.trim(),
        plot: form.plot.trim(),
        poster,
      };

      if (isEdit && id != null) {
        await updateMovie(Number(id), payload);
      } else {
        await createMovie(payload);
      }
      navigate("/");
    } catch (err) {
      console.error("영화 저장 실패:", err);
      setError("영화 저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (id == null) return;
    try {
      await deleteMovie(Number(id));
      navigate("/");
    } catch (err) {
      console.error("영화 삭제 실패:", err);
      setError("영화 삭제에 실패했습니다.");
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return <div className="movie-form-page">불러오는 중…</div>;
  }

  return (
    <div className="movie-form-page">
      <div className="form-header">
        <h1 className="form-title">{isEdit ? "영화 수정" : "새 영화 등록"}</h1>
        <p className="form-subtitle">
          {isEdit
            ? "기존 영화 정보를 수정하거나 삭제할 수 있습니다."
            : "목록에 새로운 영화를 추가합니다."}
        </p>
      </div>

      <form className="movie-form-card" onSubmit={handleSubmit}>
        {error && (
          <p className="alert-desc form-error" style={{ color: "var(--primary-light)", marginBottom: 16 }}>
            {error}
          </p>
        )}

        <div className="form-body">
          <div className="form-group full">
            <label>제목 *</label>
            <input
              className="interactive-control"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="예) 인터스텔라"
            />
          </div>

          <div className="form-group">
            <label>장르</label>
            <select
              className="interactive-control"
              value={form.genre}
              onChange={(e) => update("genre", e.target.value)}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>감독 *</label>
            <input
              className="interactive-control"
              value={form.director}
              onChange={(e) => update("director", e.target.value)}
              placeholder="예) 크리스토퍼 놀란"
            />
          </div>

          <div className="form-group">
            <label>출연</label>
            <input
              className="interactive-control"
              value={form.actors}
              onChange={(e) => update("actors", e.target.value)}
              placeholder="예) 매튜 맥커너히, 앤 해서웨이"
            />
          </div>

          <div className="form-group">
            <label>개봉일</label>
            <input
              type="date"
              className="interactive-control"
              value={String(form.releaseDate).slice(0, 10)}
              onChange={(e) => update("releaseDate", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>상영시간(분)</label>
            <input
              type="number"
              className="interactive-control"
              value={form.runningTime}
              onChange={(e) => update("runningTime", Number(e.target.value))}
              min={1}
            />
          </div>

          <div className="form-group full">
            <label>포스터 URL (선택 · 입력 시 서버에 저장, 비우면 자동 생성)</label>
            <input
              className="interactive-control"
              value={form.poster}
              onChange={(e) => update("poster", e.target.value)}
              placeholder="https://image.example.com/poster.jpg"
            />
          </div>

          <div className="form-group full">
            <label>슬로건</label>
            <input
              className="interactive-control"
              value={form.slogan}
              onChange={(e) => update("slogan", e.target.value)}
              placeholder="한 줄 문구"
            />
          </div>

          <div className="form-group full">
            <label>줄거리</label>
            <textarea
              className="interactive-control"
              value={form.plot}
              onChange={(e) => update("plot", e.target.value)}
              placeholder="영화 줄거리를 입력하세요."
            />
          </div>
        </div>

        <div className="form-footer">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => navigate("/")}
          >
            취소
          </button>

          {isEdit && (
            <button
              type="button"
              className="btn btn-cancel btn-delete"
              onClick={() => setConfirmDelete(true)}
            >
              삭제
            </button>
          )}

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "저장 중…" : isEdit ? "수정 저장" : "등록"}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div
            className="alert-panel"
            style={{ maxWidth: 420, margin: "auto", background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alert-icon-error">🗑</div>
            <h2 className="alert-title">영화 삭제</h2>
            <p className="alert-desc">이 영화를 정말 삭제하시겠습니까?</p>
            <div className="alert-actions">
              <button className="btn btn-cancel" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button className="btn" onClick={handleDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieForm;
