import type { Movie } from "../interfaces/Movie.ts";
import { request, requestPost, requestPatch, requestDelete } from "./http.ts";

// 전체 영화 목록
export function getMovies(): Promise<Movie[]> {
  return request<Movie[]>("/movies");
}

// 단일 영화
export function getMovie(id: number): Promise<Movie> {
  return request<Movie>(`/movies/${id}`);
}

// 신규 영화 등록 (id는 json-server가 자동 부여)
export function createMovie(input: Omit<Movie, "id">): Promise<Movie> {
  return requestPost<Movie>("/movies", input);
}

// 영화 수정 (부분 필드)
export function updateMovie(
  id: number,
  patch: Partial<Omit<Movie, "id">>,
): Promise<Movie> {
  return requestPatch<Movie>(`/movies/${id}`, patch);
}

// 영화 삭제
export function deleteMovie(id: number): Promise<void> {
  return requestDelete(`/movies/${id}`);
}
