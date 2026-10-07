import { NavLink } from "react-router-dom";

import "./Header.css";
import type { User } from "../../interfaces/User.ts";

interface Props {
  /** 현재 로그인한 사용자 (없으면 null) */
  currentUser: User | null;

  /** 로그인 버튼 클릭 */
  onLoginClick: () => void;

  /** 로그아웃 버튼 클릭 */
  onLogout: () => void;
}

function Header({ currentUser, onLoginClick, onLogout }: Props) {
  const navItems = [
    { to: "/", label: "홈", end: true },
    { to: "/best", label: "베스트", end: false },
    { to: "/new", label: "등록", end: false },
    ...(currentUser?.authority
      ? [{ to: "/admin", label: "관리", end: false }]
      : []),
  ];

  return (
    <header>
      <div className="header-container">
        <div className="header-brand">
          <NavLink to="/" className="logo">
            CineTalk
          </NavLink>

          <nav className="header-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `header-nav-link ${isActive ? "active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {currentUser ? (
          <div className="header-user">
            <span className="header-nickname">{currentUser.nickname}님</span>

            <button className="btn" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        ) : (
          <button className="btn" onClick={onLoginClick}>
            로그인
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
