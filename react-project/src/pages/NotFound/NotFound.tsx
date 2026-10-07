import { Link } from "react-router-dom";

import "./NotFound.css";

function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-code">404</div>
      <h1 className="not-found-title">페이지를 찾을 수 없습니다</h1>
      <p className="not-found-desc">
        주소가 잘못되었거나 삭제된 페이지일 수 있습니다.
      </p>
      <Link to="/" className="btn">
        홈으로 돌아가기
      </Link>
    </main>
  );
}

export default NotFound;
