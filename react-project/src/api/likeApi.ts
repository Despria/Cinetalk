import type { Like, LikeType } from "../interfaces/Like.ts";
import { request, requestPost, requestDelete } from "./http.ts";

// 전체 좋아요·찜 기록 (목록 카드 카운트/토글 상태 계산용)
export function getLikes(): Promise<Like[]> {
  return request<Like[]>("/likes");
}

// 특정 사용자의 좋아요·찜 기록 (내가 좋아요/찜한 영화 보기용)
export function getLikesByUser(userId: number): Promise<Like[]> {
  return request<Like[]>(`/likes?userId=${userId}`);
}

// 토글: 같은 (userId, movieId, type) 이 있으면 DELETE, 없으면 POST.
// 현재 기록을 먼저 조회해 존재 여부 판단. 반환 = 토글 후 상태(true=눌림).
export async function toggleLike(
  userId: number,
  movieId: number,
  type: LikeType,
): Promise<boolean> {
  const existing = await request<Like[]>(
    `/likes?userId=${userId}&movieId=${movieId}&type=${type}`,
  );

  if (existing.length > 0) {
    await requestDelete(`/likes/${existing[0].id}`);
    return false;
  }

  await requestPost<Like>("/likes", { userId, movieId, type });
  return true;
}
