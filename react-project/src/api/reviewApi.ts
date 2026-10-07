import type { Review } from "../interfaces/Review.ts";
import { request, requestPost, requestDelete } from "./http.ts";

// 특정 영화의 리뷰 목록 (movieId로 필터링 + _expand=user 로 작성자 닉네임 조인)
export function getReviewsByMovie(movieId: number): Promise<Review[]> {
  return request<Review[]>(
    `/reviews?movieId=${movieId}&_expand=user&_sort=createdAt&_order=desc`,
  );
}

// 리뷰 등록 — POST /reviews (id/createdAt은 여기서 조립해 전송)
export function createReview(input: {
  movieId: number;
  userId: number;
  rating: number;
  content: string;
}): Promise<Review> {
  const createdAt = new Date().toISOString();

  return requestPost<Review>("/reviews", { ...input, createdAt });
}

// 리뷰 삭제
export function deleteReview(id: number): Promise<void> {
  return requestDelete(`/reviews/${id}`);
}
