// 공통 fetch 래퍼
// - dev: Vite proxy("/api" → json-server). 동일 오리진.
// - build(정적): json-server --static 단일 서버가 db 리소스를 /movies 등 직접 라우트로 제공.
//   base("./") + labport <base href> 기준 상대경로로 요청.
const BASE_URL = import.meta.env.DEV ? "/api" : import.meta.env.BASE_URL;

// base("/api" 또는 "./") + path("/movies") 를 안전하게 합침(슬래시 중복 제거).
function join(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

// GET
export async function request<T>(path: string): Promise<T> {
  const res = await fetch(join(BASE_URL, path));

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// POST (JSON body)
export async function requestPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(join(BASE_URL, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// PATCH (JSON body) — 부분 수정
export async function requestPatch<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(join(BASE_URL, path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// DELETE
export async function requestDelete(path: string): Promise<void> {
  const res = await fetch(join(BASE_URL, path), { method: "DELETE" });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
}
