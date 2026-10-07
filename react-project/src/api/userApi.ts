import type { User } from "../interfaces/User.ts";
import { request, requestPost, requestPatch } from "./http.ts";

// 전체 사용자 목록
export function getUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

// 단일 사용자
export function getUser(id: number): Promise<User> {
  return request<User>(`/users/${id}`);
}

// loginId로 사용자 조회 (로그인 검증·중복 체크용). json-server 필터는 배열을 반환.
export function getUserByLoginId(loginId: string): Promise<User[]> {
  return request<User[]>(`/users?loginId=${encodeURIComponent(loginId)}`);
}

// 회원가입 — 신규 사용자 생성 (id는 json-server가 자동 부여)
export function createUser(input: {
  loginId: string;
  password: string;
  nickname: string;
}): Promise<User> {
  return requestPost<User>("/users", input);
}

// 사용자 관리자 권한 변경 (authority 토글)
export function updateUserAuthority(
  id: number,
  authority: boolean,
): Promise<User> {
  return requestPatch<User>(`/users/${id}`, { authority });
}
