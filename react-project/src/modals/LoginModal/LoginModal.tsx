import { useState } from "react";
import Modal from "../../components/Modal/Modal.tsx";
import "../../components/Form.css";
import "./LoginModal.css";

interface LoginModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 로그인 버튼 클릭 시 (loginId, password) 를 상위로 전달 (검증은 App이 수행) */
  onLogin: (loginId: string, password: string) => void;

  /** 회원가입 모달로 전환 */
  onSwitchSignup: () => void;
}

function LoginModal({
  open,
  onClose,
  onLogin,
  onSwitchSignup,
}: LoginModalProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginId, password);
  };

  return (
    <Modal open={open} onClose={onClose} size="small">
      <div className="login-modal">
        <div className="form-header">
          <h2 className="form-title">시네마 멤버십 로그인</h2>
        </div>

        <form className="form-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>아이디</label>

            <input
              className="interactive-control"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>비밀번호</label>

            <input
              type="password"
              className="interactive-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              취소
            </button>

            <button type="submit" className="btn">
              로그인
            </button>
          </div>
        </form>

        <div className="login-switch">
          계정이 없으신가요?{" "}
          <button type="button" className="link-btn" onClick={onSwitchSignup}>
            회원가입
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default LoginModal;
