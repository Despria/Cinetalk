import { requestPost } from "./http.ts";

// /upload 응답
interface UploadResponse {
  path: string;
}

/**
 * 외부 이미지 URL을 서버로 보내 다운로드한 뒤 로컬(posters/xxx.jpg)에 저장하고,
 * 브라우저에서 참조 가능한 상대경로를 반환한다.
 * - dev: Vite proxy 가 /api → 3001 로 전달
 * - build: 단일 json-server 커스텀 서버(server.cjs)가 POST /upload 처리
 */
export async function uploadPosterFromUrl(url: string): Promise<string> {
  const data = await requestPost<UploadResponse>("/upload", { url });
  return data.path;
}
