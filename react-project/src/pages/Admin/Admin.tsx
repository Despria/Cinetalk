import { useEffect, useState } from "react";

import type { User } from "../../interfaces/User.ts";
import { getUsers, updateUserAuthority } from "../../api/userApi.ts";

import "./Admin.css";

interface Props {
  /** 현재 로그인한 관리자 (본인은 권한 회수 방지용) */
  currentUser: User | null;
}

function Admin({ currentUser }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  const loadUsers = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((err) => {
        console.error("사용자 목록 불러오기 실패:", err);
        setError("사용자 목록을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // 권한 토글 — 본인(현재 로그인한 관리자)과
  // 최초 슈퍼관리자(loginId === "admin")는 회수 불가
  const isProtected = (user: User) =>
    (!!currentUser && user.id === currentUser.id) || user.loginId === "admin";

  const handleToggle = async (user: User) => {
    if (isProtected(user)) return;
    const next = !user.authority;
    setPendingId(user.id);
    try {
      await updateUserAuthority(user.id, next);
      setUsers((list) =>
        list.map((u) => (u.id === user.id ? { ...u, authority: next } : u)),
      );
    } catch (err) {
      console.error("권한 변경 실패:", err);
      setError("권한 변경에 실패했습니다.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">🛡 관리자 페이지</h1>
        <p className="admin-subtitle">
          사용자 관리자 권한을 부여하거나 회수할 수 있습니다.
        </p>
      </div>

      {error && (
        <p className="admin-error" style={{ color: "var(--primary-light)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : (
        <div className="admin-table">
          <div className="admin-row admin-row-head">
            <span className="col-id">ID</span>
            <span className="col-nick">닉네임</span>
            <span className="col-login">로그인 ID</span>
            <span className="col-auth">권한</span>
            <span className="col-action">관리</span>
          </div>

          {users.map((u) => {
            const isAdmin = !!u.authority;
            const isMe = !!currentUser && currentUser.id === u.id;
            const protectedUser = isProtected(u);
            return (
              <div className="admin-row" key={u.id}>
                <span className="col-id">{u.id}</span>
                <span className="col-nick">
                  {u.nickname}
                  {isMe && <span className="admin-self-tag">나</span>}
                  {u.loginId === "admin" && (
                    <span className="admin-self-tag">슈퍼관리자</span>
                  )}
                </span>
                <span className="col-login">{u.loginId}</span>
                <span className={`col-auth ${isAdmin ? "is-admin" : ""}`}>
                  {isAdmin ? "관리자" : "일반"}
                </span>
                <span className="col-action">
                  {protectedUser ? (
                    <span className="admin-locked">변경 불가</span>
                  ) : (
                    <button
                      type="button"
                      className={`admin-toggle-btn ${isAdmin ? "revoke" : "grant"}`}
                      disabled={pendingId === u.id}
                      onClick={() => handleToggle(u)}
                      title={
                        isAdmin ? "관리자 권한 회수" : "관리자 권한 부여"
                      }
                    >
                      {pendingId === u.id
                        ? "처리 중…"
                        : isAdmin
                          ? "회수"
                          : "부여"}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default Admin;
