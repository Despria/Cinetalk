// 좋아요·찜 토글 기록 (별도 likes 컬렉션).
// 영화 자체 필드가 아닌 독립 컬렉션 → 사용자별 좋아요/찜 구분 가능.
export type LikeType = "like" | "favorite";

export interface Like {
  id: number;
  userId: number;
  movieId: number;
  type: LikeType;
}
