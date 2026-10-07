import type { User } from "./User.ts";

export interface Review {
  id: number;
  movieId: number;
  userId: number;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt?: string;
  // json-server _expand=user 로 조인된 작성자 정보 (선택)
  user?: User;
}
