"""
rag_core.py - 영화 추천 챗봇 RAG 핵심 로직

  질문 -> [검색 계획 LLM] -> JSON -> 코드가 검증 -> 필터/정렬/벡터검색 선택 실행 -> 답변 생성(Exaone)

  - chatbot_server.py(FastAPI)가 rag_answer()를 호출합니다.
  - 모듈을 import하면 Milvus 연결, 모델 객체, 감독/장르 목록 로딩이 한 번만 수행됩니다.
  - 설정은 같은 폴더의 .env 또는 환경변수로 바꿀 수 있고, 값을 비우면 아래 기본값을 사용합니다.
      MILVUS_URI(http://127.0.0.1:19530) MILVUS_TOKEN(선택) MILVUS_COLLECTION(movie_profiles)
      OLLAMA_URL(http://127.0.0.1:11434) EMBED_MODEL(bge-m3) LLM_MODEL(exaone3.5:7.8b)
      TOP_K(4) LLM_TEMPERATURE(0.2) VOCAB_TTL_SEC(3600)
"""

import datetime as dt
import json
import logging
import os
import re
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama, OllamaEmbeddings
from pymilvus import MilvusClient

load_dotenv(Path(__file__).resolve().parent / ".env")

log = logging.getLogger("rag")


def env(name, default=None):
    """환경변수 조회. 설정되지 않았거나 값이 비어 있으면 default를 반환한다."""
    value = os.getenv(name)
    return value if value is not None and value.strip() else default


# ============================================================
# 1. 설정
# ============================================================
MILVUS_URI = env("MILVUS_URI", "http://127.0.0.1:19530")
MILVUS_TOKEN = env("MILVUS_TOKEN")
COLLECTION_NAME = env("MILVUS_COLLECTION", "movie_profiles")

OLLAMA_URL = env("OLLAMA_URL", "http://127.0.0.1:11434")
EMBED_MODEL = env("EMBED_MODEL", "bge-m3")
LLM_MODEL = env("LLM_MODEL", "exaone3.5:7.8b")
LLM_TEMPERATURE = float(env("LLM_TEMPERATURE", "0.2"))

TOP_K = int(env("TOP_K", "4"))
VOCAB_TTL_SEC = int(env("VOCAB_TTL_SEC", "3600"))     # 감독/장르 목록을 다시 읽는 주기

OUTPUT_FIELDS = [
    "movie_id", "title", "release_date", "release_year",
    "genres", "director", "avg_rating", "review_count", "text",
]
LIGHT_FIELDS = [f for f in OUTPUT_FIELDS if f != "text"]   # 정렬용 조회에는 본문(text)을 가져오지 않는다
QUERY_MAX = 16384                                          # Milvus query 1회 조회 상한

# ============================================================
# 2~4. Milvus / 임베딩 / LLM 초기화
# ============================================================
_milvus_kwargs = {"uri": MILVUS_URI}
if MILVUS_TOKEN:
    _milvus_kwargs["token"] = MILVUS_TOKEN
milvus_client = MilvusClient(**_milvus_kwargs)
if not milvus_client.has_collection(COLLECTION_NAME):
    raise RuntimeError(f"Milvus 컬렉션 '{COLLECTION_NAME}'이(가) 없습니다. 동기화 스크립트를 먼저 실행하세요.")

embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)
llm = ChatOllama(model=LLM_MODEL, base_url=OLLAMA_URL, temperature=LLM_TEMPERATURE)
# 검색 계획 전용 LLM: 결정적 출력(temperature 0) + JSON 모드
planner_llm = ChatOllama(model=LLM_MODEL, base_url=OLLAMA_URL, temperature=0, format="json")

# ============================================================
# 5. RAG Prompt
# ============================================================
prompt = ChatPromptTemplate.from_template(
    """
당신은 영화 정보를 알려주는 영화 전문 챗봇입니다.

아래는 사용자의 질문과 관련하여 영화 데이터베이스에서
검색된 영화 정보입니다.

반드시 아래 검색 결과를 우선적으로 참고하여 답변하세요.

검색 결과에 없는 내용은 사실인 것처럼 만들어내지 마세요.
검색 결과만으로 답변하기 어려운 경우에는
"검색된 영화 정보만으로는 정확하게 답변하기 어렵습니다."
라고 답변하세요.

검색 결과 맨 위의 [검색 조건]은 시스템이 적용한 필터와 정렬 기준입니다.
검색 결과는 그 기준의 정렬 순서이며, 평점은 결과에 적힌 '평균 평점'(5점 만점) 수치를 그대로 인용하세요.

검색 결과:
--------------------
{context}
--------------------

질문:
{question}

답변:
"""
)

# ============================================================
# 어휘 로딩 (감독명 / 장르)
# ============================================================

def _norm(s):
    """공백/하이픈/점을 제거하고 소문자로: '장 뤽-고다르' -> '장뤽고다르'"""
    return re.sub(r"[\s\-·.,]", "", s or "").lower()


def _esc(s):
    """Milvus filter 문자열 리터럴용 이스케이프"""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def load_vocab():
    rows = milvus_client.query(
        collection_name=COLLECTION_NAME, filter="movie_id >= 0",
        output_fields=["director", "genres"], limit=QUERY_MAX,
    )
    directors, genres = set(), set()
    for r in rows:
        for n in re.split(r"[,/]", r.get("director") or ""):
            if n.strip():
                directors.add(n.strip())
        for g in r.get("genres") or []:
            genres.add(g)
    return directors, genres


DIRECTORS, GENRES = load_vocab()
_vocab_loaded_at = time.monotonic()
_vocab_lock = threading.Lock()


def _maybe_refresh_vocab():
    """동기화 배치로 데이터가 바뀌어도 서버 재시작 없이 반영되도록 주기적으로 목록을 다시 읽는다."""
    global DIRECTORS, GENRES, _vocab_loaded_at
    if time.monotonic() - _vocab_loaded_at < VOCAB_TTL_SEC:
        return
    with _vocab_lock:
        if time.monotonic() - _vocab_loaded_at < VOCAB_TTL_SEC:
            return
        try:
            DIRECTORS, GENRES = load_vocab()
            log.info("감독 %d명, 장르 %d개 목록 갱신", len(DIRECTORS), len(GENRES))
        except Exception as e:                       # 갱신 실패 시 기존 목록 유지
            log.warning("어휘 목록 갱신 실패(기존 목록 유지): %s", e)
        _vocab_loaded_at = time.monotonic()

# ============================================================
# 검색 계획 프롬프트
# ============================================================

PLANNER_PROMPT = """당신은 영화 검색 질의 분석기입니다. 사용자의 질문을 읽고 검색 조건을 JSON 하나로만 출력하세요.
설명, 코드블록, 주석은 출력하지 마세요.

오늘 날짜: {today}
사용 가능한 장르: {genres}

출력 형식 (해당 없는 값은 null 또는 [] ):
{"directors": [], "genres": [], "genre_mode": "any", "year_from": null, "year_to": null,
 "min_rating": null, "max_rating": null, "sort": "relevance", "limit": 5, "semantic_query": null}

필드 설명
- directors: 질문에 나온 감독 이름(질문에 쓰인 그대로)
- genres: 위 '사용 가능한 장르'에 있는 장르만. 두 장르를 모두 만족해야 하면 genre_mode="all", 하나라도 맞으면 "any"
- year_from, year_to: 개봉연도 범위(정수). "2025년"이면 둘 다 2025, "2020년대"면 2020과 2029, "올해/작년"은 오늘 날짜 기준
- min_rating, max_rating: 5점 만점 기준 평점 범위. "4점 이상"이면 min_rating=4.0
- sort: "relevance"(질문과 비슷한 순) | "rating_desc"(평점 높은 순) | "rating_asc"(평점 낮은 순) | "newest"(최신순) | "oldest"(오래된 순)
- limit: 보여줄 영화 수(1~10). "가장/제일/하나"처럼 1편을 묻는 질문이면 1, 아니면 5
- semantic_query: 분위기, 감정, 주제, 줄거리, 관람 상황처럼 DB 값으로 걸러낼 수 없는 의미적 요구를 한 문장으로. 없으면 null

규칙
- 감독, 장르, 개봉연도, 평점처럼 DB 값으로 거를 수 있는 조건은 해당 필드에 넣고, 나머지(가족과 함께, 눈물 나는, 우주 배경 등)는 semantic_query에 넣으세요.
- "평점이 가장 높은/제일 좋은/평점순"은 rating_desc, "평점이 낮은"은 rating_asc, "최신/최근/신작"은 newest, "오래된/고전"은 oldest.
- "인터스텔라 같은 영화"처럼 특정 영화와 비슷한 영화를 찾는 질문은 semantic_query에 그 설명을 넣고 sort는 relevance로 두세요.
- 조건이 전혀 없는 일반 추천 질문은 모든 값을 비우고 semantic_query에 질문을 그대로 넣으세요.

예시
질문: 고다르 감독의 영화 중 평점이 가장 높은 영화는?
{"directors": ["고다르"], "genres": [], "genre_mode": "any", "year_from": null, "year_to": null, "min_rating": null, "max_rating": null, "sort": "rating_desc", "limit": 1, "semantic_query": null}

질문: 2025년에 개봉한 액션 영화 중 평점 높은 순으로 보여줘
{"directors": [], "genres": ["액션"], "genre_mode": "any", "year_from": 2025, "year_to": 2025, "min_rating": null, "max_rating": null, "sort": "rating_desc", "limit": 5, "semantic_query": null}

질문: 가족이랑 같이 볼 만한 따뜻한 영화 추천해줘
{"directors": [], "genres": ["가족"], "genre_mode": "any", "year_from": null, "year_to": null, "min_rating": null, "max_rating": null, "sort": "relevance", "limit": 5, "semantic_query": "가족 모두 함께 볼 수 있는 따뜻한 영화"}

질문: 평점 4점 이상인 SF 영화 중에 눈물 나는 영화 있어?
{"directors": [], "genres": ["SF"], "genre_mode": "any", "year_from": null, "year_to": null, "min_rating": 4.0, "max_rating": null, "sort": "relevance", "limit": 5, "semantic_query": "눈물이 나는 감동적인 영화"}

질문: 최근 개봉한 공포 영화 3개만 알려줘
{"directors": [], "genres": ["공포"], "genre_mode": "any", "year_from": null, "year_to": null, "min_rating": null, "max_rating": null, "sort": "newest", "limit": 3, "semantic_query": null}

질문: 우주를 배경으로 한 영화 추천해줘
{"directors": [], "genres": [], "genre_mode": "any", "year_from": null, "year_to": null, "min_rating": null, "max_rating": null, "sort": "relevance", "limit": 5, "semantic_query": "우주를 배경으로 한 영화"}

질문: {question}
"""

# ============================================================
# 규칙 기반 보조 로직 (LLM 실패 시 대체 + 감독명 안전망)
# ============================================================

def find_directors(question):
    """질문 속 감독명을 DB 표기 그대로 반환 (전체 이름 우선, 없으면 성 3글자 이상)."""
    q = _norm(question)
    full = [d for d in DIRECTORS if _norm(d) and _norm(d) in q]
    if full:
        return full
    partial = []
    for d in DIRECTORS:
        parts = d.split()
        if parts and len(_norm(parts[-1])) >= 3 and _norm(parts[-1]) in q:
            partial.append(d)
    return partial


HIGH_RE = re.compile(r"(평점|별점).{0,6}(높|최고|1위)|(높은|최고)(평점|별점)|평점순")
LOW_RE = re.compile(r"(평점|별점).{0,6}(낮|최저)|(낮은|최저)(평점|별점)")


def rating_sort_intent(question):
    q = question.replace(" ", "")
    if LOW_RE.search(q):
        return "low"
    if HIGH_RE.search(q):
        return "high"
    return None


def _empty_plan():
    return {"directors": [], "missing_directors": [], "genres": [], "genre_mode": "any",
            "year_from": None, "year_to": None, "min_rating": None, "max_rating": None,
            "sort": "relevance", "limit": TOP_K, "semantic_query": None}


def fallback_plan(question):
    plan = _empty_plan()
    intent = rating_sort_intent(question)
    plan["directors"] = find_directors(question)
    if intent:
        plan["sort"] = "rating_desc" if intent == "high" else "rating_asc"
        plan["limit"] = 1 if re.search(r"가장|제일|최고|최저", question) else TOP_K
    else:
        plan["semantic_query"] = question
    return plan

# ============================================================
# 검색 계획 생성 + 검증/보정
# ============================================================

SORTS = {"relevance", "rating_desc", "rating_asc", "newest", "oldest"}


def call_planner(question):
    p = (PLANNER_PROMPT.replace("{today}", dt.date.today().isoformat())
                       .replace("{genres}", ", ".join(sorted(GENRES)))
                       .replace("{question}", question))
    text = planner_llm.invoke(p).content.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    return json.loads(text)


def _as_list(v):
    """LLM이 리스트 대신 문자열 하나를 주는 경우를 처리 ('액션' -> ['액션'])"""
    if isinstance(v, str):
        return [v] if v.strip() else []
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def _to_int(v, lo, hi):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def _to_rating(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if 0 <= x <= 5 else None          # 5점 만점이 아닌 값(예: 8점)은 폐기


def resolve_directors(names, question):
    """LLM이 준 감독명을 DB 표기로 변환. (찾은 감독, DB에 없는 감독) 반환."""
    found = set(find_directors(question))      # 결정론적 매칭을 안전망으로 합친다
    missing = []
    for n in names:
        nn = _norm(n)
        if len(nn) < 2:
            continue
        hit = {d for d in DIRECTORS
               if _norm(d) == nn or (len(nn) >= 3 and nn in _norm(d)) or (_norm(d) and _norm(d) in nn)}
        if hit:
            found |= hit
        else:
            missing.append(n)
    return sorted(found), missing


def sanitize_plan(raw, question):
    raw = raw if isinstance(raw, dict) else {}
    plan = _empty_plan()

    plan["directors"], plan["missing_directors"] = resolve_directors(_as_list(raw.get("directors")), question)
    if plan["directors"]:                       # 일부라도 찾았으면 '없음' 처리하지 않는다
        plan["missing_directors"] = []

    dropped = []
    for g in _as_list(raw.get("genres")):
        m = next((x for x in GENRES if _norm(x) == _norm(g)), None)
        if m and m not in plan["genres"]:
            plan["genres"].append(m)
        elif not m:
            dropped.append(g)                   # DB에 없는 장르는 의미 검색어로 넘긴다
    plan["genre_mode"] = "all" if raw.get("genre_mode") == "all" else "any"

    plan["year_from"] = _to_int(raw.get("year_from"), 1888, 2100)
    plan["year_to"] = _to_int(raw.get("year_to"), 1888, 2100)
    if plan["year_from"] and plan["year_to"] and plan["year_from"] > plan["year_to"]:
        plan["year_from"], plan["year_to"] = plan["year_to"], plan["year_from"]

    plan["min_rating"] = _to_rating(raw.get("min_rating"))
    plan["max_rating"] = _to_rating(raw.get("max_rating"))

    plan["sort"] = raw.get("sort") if raw.get("sort") in SORTS else "relevance"
    plan["limit"] = _to_int(raw.get("limit"), 1, 10) or TOP_K

    sq = raw.get("semantic_query")
    sq = sq.strip() if isinstance(sq, str) and sq.strip() else None
    if dropped:
        sq = " ".join(filter(None, [sq] + dropped))

    has_filter = bool(plan["directors"] or plan["genres"] or plan["year_from"] or plan["year_to"]
                      or plan["min_rating"] is not None or plan["max_rating"] is not None)
    if sq is None and plan["sort"] == "relevance":
        if has_filter:
            plan["sort"] = "rating_desc"        # 조건만 있고 정렬 지시가 없으면 평점 높은 순
        else:
            sq = question                       # 조건이 전혀 없으면 기존 벡터 검색
    plan["semantic_query"] = sq
    return plan


def make_plan(question):
    try:
        return sanitize_plan(call_planner(question), question)
    except Exception as e:                      # 연결 오류, JSON 파싱 오류 등
        log.warning("검색 계획 LLM 실패 -> 규칙 기반으로 대체: %s", e)
        return fallback_plan(question)

# ============================================================
# 계획 -> Milvus filter
# ============================================================

def build_filter(plan):
    conds = []
    if plan["directors"]:
        conds.append("(" + " or ".join(f'director like "%{_esc(d)}%"' for d in plan["directors"]) + ")")
    if plan["genres"]:
        fn = "array_contains_all" if plan["genre_mode"] == "all" else "array_contains_any"
        conds.append(f'{fn}(genres, {json.dumps(plan["genres"], ensure_ascii=False)})')
    if plan["year_from"] is not None:
        conds.append(f'release_year >= {plan["year_from"]}')
    if plan["year_to"] is not None:
        conds.append(f'release_year <= {plan["year_to"]}')
    if plan["min_rating"] is not None:
        conds.append(f'avg_rating >= {plan["min_rating"]}')
    if plan["max_rating"] is not None:
        conds.append(f'avg_rating <= {plan["max_rating"]}')
    # 평점 기준 조건/정렬에는 리뷰가 없는 영화(평점 0)가 섞이지 않게 한다
    if plan["sort"] in ("rating_desc", "rating_asc") or plan["min_rating"] is not None or plan["max_rating"] is not None:
        conds.append("review_count > 0")
    return " and ".join(conds)

# ============================================================
# 6. Milvus 검색 / 실행
# ============================================================

def search_movies(question, top_k=TOP_K, filter_expr=None):
    """질문 임베딩 후 벡터 검색. filter_expr가 있으면 그 조건 안에서만 검색한다."""
    query_vector = embeddings.embed_query(question)
    kwargs = {
        "collection_name": COLLECTION_NAME,
        "data": [query_vector],
        "anns_field": "vector",
        "limit": top_k,
        "search_params": {"metric_type": "COSINE", "params": {"ef": 64}},
        "output_fields": OUTPUT_FIELDS,
    }
    if filter_expr:
        kwargs["filter"] = filter_expr
    return milvus_client.search(**kwargs)[0]


def apply_sort(items, sort):
    e = lambda it: it["entity"]
    if sort == "rating_desc":
        items.sort(key=lambda it: (e(it).get("avg_rating") or 0, e(it).get("review_count") or 0), reverse=True)
    elif sort == "rating_asc":
        items.sort(key=lambda it: (e(it).get("avg_rating") or 0, -(e(it).get("review_count") or 0)))
    elif sort == "newest":          # 개봉일이 같으면 평점 높은 순
        items.sort(key=lambda it: (e(it).get("release_date") or "", e(it).get("avg_rating") or 0), reverse=True)
    elif sort == "oldest":
        items.sort(key=lambda it: (e(it).get("release_date") or "9999", -(e(it).get("avg_rating") or 0)))
    return items


def fetch_full(ids):
    """movie_id 목록의 전체 정보(text 포함)를 같은 순서로 가져온다."""
    if not ids:
        return []
    rows = milvus_client.query(collection_name=COLLECTION_NAME, filter=f"movie_id in {list(ids)}",
                               output_fields=OUTPUT_FIELDS, limit=len(ids))
    by_id = {r["movie_id"]: r for r in rows}
    return [{"entity": by_id[i], "distance": None} for i in ids if i in by_id]


def execute_plan(plan):
    """(결과 목록, 조건에 맞는 전체 편수 또는 None) 반환"""
    flt = build_filter(plan)
    sq, sort, limit = plan["semantic_query"], plan["sort"], plan["limit"]

    if sq:                                      # 의미 검색 (+ 필터)
        pool = limit if sort == "relevance" else max(limit * 6, 30)
        hits = search_movies(sq, top_k=pool, filter_expr=flt or None)
        items = [{"entity": h["entity"], "distance": h["distance"]} for h in hits]
        if sort != "relevance":
            items = apply_sort(items, sort)[:limit]
        return items, None

    # 구조화 질문: 조건에 맞는 영화를 모두 가져와 코드에서 정렬한다
    rows = milvus_client.query(collection_name=COLLECTION_NAME, filter=flt or "movie_id >= 0",
                               output_fields=LIGHT_FIELDS, limit=QUERY_MAX)
    items = apply_sort([{"entity": r, "distance": None} for r in rows], sort)
    shown = max(limit, 3)                       # 1위 외에 참고용 후보를 함께 넘긴다
    return fetch_full([it["entity"]["movie_id"] for it in items[:shown]]), len(rows)


SORT_LABEL = {"relevance": "질문과의 유사도 순", "rating_desc": "평점 높은 순", "rating_asc": "평점 낮은 순",
              "newest": "최신순", "oldest": "오래된 순"}


def describe_plan(plan, total=None, shown=0):
    parts = []
    if plan["directors"]:
        parts.append("감독: " + ", ".join(plan["directors"]))
    if plan["genres"]:
        parts.append("장르: " + (" + " if plan["genre_mode"] == "all" else " / ").join(plan["genres"]))
    if plan["year_from"] or plan["year_to"]:
        parts.append(f"개봉연도: {plan['year_from'] or ''}~{plan['year_to'] or ''}")
    if plan["min_rating"] is not None:
        parts.append(f"평점 {plan['min_rating']} 이상")
    if plan["max_rating"] is not None:
        parts.append(f"평점 {plan['max_rating']} 이하")
    if plan["semantic_query"]:
        parts.append(f"의미 검색어: {plan['semantic_query']}")
    parts.append(f"정렬: {SORT_LABEL[plan['sort']]}")
    text = " | ".join(parts)
    if total is not None:
        text += f" | 조건에 맞는 영화 총 {total}편 중 정렬 순서대로 상위 {shown}편"
    return text

# ============================================================
# 7. 검색 결과를 LLM Context로 변환
# ============================================================

def fmt_score(result):
    """유사도 문자열. 구조화 질문(query 경로)의 결과는 유사도가 없어 distance가 None이다."""
    score = result.get("distance")
    return f"{score:.4f}" if score is not None else "-"


def format_results(results):
    documents = []
    for i, result in enumerate(results, start=1):
        entity = result["entity"]
        score_line = f"유사도: {fmt_score(result)}\n" if result.get("distance") is not None else ""
        document = f"""
[검색 결과 {i}]
{score_line}영화 ID: {entity.get("movie_id")}
영화 제목: {entity.get("title")}
개봉일: {entity.get("release_date")}
개봉년도: {entity.get("release_year")}
장르: {entity.get("genres")}
감독: {entity.get("director")}
평균 평점: {entity.get("avg_rating")}
리뷰 수: {entity.get("review_count")}

영화 정보:
{entity.get("text", "")}
"""
        documents.append(document.strip())
    return "\n\n".join(documents)

# ============================================================
# 8. RAG 답변
# ============================================================

def rag_answer(question):
    """(답변 텍스트, 검색 결과 목록) 반환. 검색 결과 항목은 {"entity": {...}, "distance": float|None}"""
    _maybe_refresh_vocab()
    plan = make_plan(question)
    log.info("검색 계획: %s", json.dumps(plan, ensure_ascii=False))

    # DB에 없는 감독만 지목한 경우: 다른 영화로 대체하지 않고 바로 답한다.
    if plan["missing_directors"] and not plan["directors"]:
        return f"데이터베이스에서 {', '.join(plan['missing_directors'])} 감독의 영화를 찾을 수 없습니다.", []

    results, total = execute_plan(plan)
    if not results:
        return f"조건({describe_plan(plan)})에 맞는 영화를 데이터베이스에서 찾을 수 없습니다.", []

    # 적용된 검색 조건을 컨텍스트 맨 앞에 알려, LLM이 전체 대비 몇 편인지/정렬 기준을 알게 한다.
    context = f"[검색 조건] {describe_plan(plan, total, len(results))}\n\n{format_results(results)}"
    messages = prompt.format_messages(context=context, question=question)
    return llm.invoke(messages).content, results
