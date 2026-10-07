import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Header from "./components/Header/Header";
import Home from "./pages/Home/Home.tsx";
import Best from "./pages/Best/Best.tsx";
import MovieForm from "./pages/MovieForm/MovieForm.tsx";
import Admin from "./pages/Admin/Admin.tsx";
import NotFound from "./pages/NotFound/NotFound.tsx";

import LoginModal from "./modals/LoginModal/LoginModal.tsx";
import SignupModal, {
  type SignupForm,
} from "./modals/SignupModal/SignupModal.tsx";
import LoginResultModal, {
  type LoginStatus,
} from "./modals/LoginResultModal/LoginResultModal.tsx";
import ChatWidget from "./components/ChatWidget/ChatWidget.tsx";

import type { User } from "./interfaces/User.ts";
import { getUserByLoginId, getUser, createUser } from "./api/userApi.ts";

import "./App.css";

// 세션 복원 키 — 비밀번호가 아닌 userId(숫자)만 저장. localStorage에
// 비밀번호/loginId 등 민감 정보는 절대 넣지 않는다.
const SESSION_KEY = "cinetalk.session.userId";

function App() {
  // 인증 상태. 새로고침 시 localStorage의 userId로 복원(비밀번호 없이).
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  // 모달 제어
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  // 마운트 시 세션 복원: 저장된 userId로 사용자 정보 조회 (비밀번호 저장 안 함)
  useEffect(() => {
    const savedId = Number(localStorage.getItem(SESSION_KEY));
    if (!Number.isFinite(savedId) || savedId <= 0) {
      setRestoring(false);
      return;
    }
    getUser(savedId)
      .then((u) => setCurrentUser(u))
      .catch((err) => {
        // 사용자가 삭제됐거나 조회 실패 → 세션 정리
        console.error("세션 복원 실패:", err);
        localStorage.removeItem(SESSION_KEY);
      })
      .finally(() => setRestoring(false));
  }, []);

  // 결과 알림 모달 (로그인/회원가입 공용)
  const [result, setResult] = useState<{
    open: boolean;
    status: LoginStatus;
    message: string;
  }>({ open: false, status: "success", message: "" });

  const showResult = (status: LoginStatus, message: string) => {
    setResult({ open: true, status, message });
  };

  // 로그인: loginId로 조회 후 password 비교
  const handleLogin = async (loginId: string, password: string) => {
    try {
      const found = await getUserByLoginId(loginId);

      if (found.length > 0 && found[0].password === password) {
        const user = found[0];
        setCurrentUser(user);
        // 비밀번호가 아닌 userId만 저장 (세션 복원용)
        localStorage.setItem(SESSION_KEY, String(user.id));
        setLoginOpen(false);
        showResult("success", `${user.nickname}님, 환영합니다!`);
      } else {
        showResult("error", "아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (err) {
      console.error("로그인 실패:", err);
      showResult("error", "로그인 중 오류가 발생했습니다.");
    }
  };

  // 회원가입: 중복 체크 → 비밀번호 확인 → 생성
  const handleSignup = async (form: SignupForm) => {
    const { loginId, password, passwordConfirm, nickname } = form;

    if (!loginId || !nickname || !password) {
      showResult("error", "모든 항목을 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      showResult("error", "비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      const exists = await getUserByLoginId(loginId);
      if (exists.length > 0) {
        showResult("error", "이미 사용 중인 아이디입니다.");
        return;
      }

      await createUser({ loginId, password, nickname });
      setSignupOpen(false);
      setLoginOpen(true);
      showResult("success", "회원가입이 완료되었습니다. 로그인해주세요.");
    } catch (err) {
      console.error("회원가입 실패:", err);
      showResult("error", "회원가입 중 오류가 발생했습니다.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  // 로그인 ↔ 회원가입 모달 전환
  const switchToSignup = () => {
    setLoginOpen(false);
    setSignupOpen(true);
  };

  const switchToLogin = () => {
    setSignupOpen(false);
    setLoginOpen(true);
  };

  // 세션 복원 중에는 라우트(특히 관리자 전용 /admin, /edit)가
  // currentUser=null 상태로 평가되어 홈으로 잘못 리다이렉트되는 것을 방지.
  if (restoring) {
    return <div className="app app-restoring">불러오는 중…</div>;
  }

  return (
    <div className="app">
      <Header
        currentUser={currentUser}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={handleLogout}
      />

      <Routes>
        <Route
          path="/"
          element={
            <Home
              currentUser={currentUser}
              onRequireLogin={() => setLoginOpen(true)}
            />
          }
        />
        <Route path="/best" element={<Best />} />
        <Route path="/new" element={<MovieForm />} />
        <Route
          path="/edit/:id"
          element={
            currentUser?.authority ? (
              <MovieForm />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            currentUser?.authority ? (
              <Admin currentUser={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleLogin}
        onSwitchSignup={switchToSignup}
      />

      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        onSubmit={handleSignup}
        onSwitchLogin={switchToLogin}
      />

      <LoginResultModal
        open={result.open}
        status={result.status}
        message={result.message}
        onClose={() => setResult((r) => ({ ...r, open: false }))}
      />

      {/* 플로팅 AI 채팅 위젯 (자체적으로 상태 관리, props 불필요) */}
      <ChatWidget />
    </div>
  );
}

export default App;
