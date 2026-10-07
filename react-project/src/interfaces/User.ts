export interface User {
  id: number;
  loginId: string;
  password: string;
  nickname: string;
  /** 관리자 여부 (true=관리자). 미지정 시 일반 사용자. */
  authority?: boolean;
}
