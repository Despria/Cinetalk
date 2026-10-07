# 임시 CSS 목록

> `style.css` 분산 작업(별도 진행 중)이 완료되기 전까지, 새로 만든 tsx에 대해
> **기능 확인용으로 임시 생성한 CSS 파일** 목록. 분산 작업 후 교체 또는 삭제 예정.

## 정책
- **기존 CSS 파일(`Form.css`, `Alert.css`, 각 컴포넌트 css)은 수정하지 않고 그대로 사용**한다.
- **`style.css`는 사용하지 않는다** (분산 작업 중).
- 새 tsx에 CSS가 필요하면 **기능만 확인할 수 있는 최소 형태**로 임시 구현 후, 이 목록에 기록한다.
- `style.css`에 있던 `:root` 색상 변수(`--primary`, `--gold` 등)가 현재 정의되지 않았으므로, 임시 CSS에서는 색상을 직접 지정한다.

## 임시 CSS 파일 목록

| 파일 | 용도 | 비고 |
|------|------|------|
| `src/modals/LoginResultModal/LoginResultModal.css` | `.btn` 기본 보조 스타일 | `alert-*` 클래스는 공용 `Alert.css`(수정 없이 그대로 import)에서 처리. `.btn` 본체만 보완. |
| `src/modals/SignupModal/SignupModal.css` | `.btn` / `.btn-secondary` / `.link-btn` / 전환 영역 보조 | `form-*` / `interactive-control`은 공용 `Form.css`를 그대로 사용. 버튼·링크 본체만 보완. |
| `src/modals/ReviewWriteModal/ReviewWriteModal.css` | 별 인터랙션(`.rating-star`) + `.btn` / `.btn-secondary` 보조 | `form-*` / `interactive-control`은 `Form.css`, 별 모양(`.star`/`.star.empty`)은 `ReviewCard.css`를 그대로 import. |
| `src/modals/ReviewResultModal/ReviewResultModal.css` | `.btn` 기본 보조 스타일 | `alert-*` 클래스는 공용 `Alert.css`에서 처리. `.btn` 본체만 보완. (LoginResultModal과 동일 구조) |

## 교체 시점
- `style.css` 분산 작업 완료 후, 각 컴포넌트가 자기 CSS만으로 스타일링되면 위 임시 파일의 `.btn` 보조 정의는 제거(또는 본 CSS로 흡수).
