import { useState } from "react";
import Modal from "../../components/Modal/Modal.tsx";
import "../../components/Form.css";
import "./SignupModal.css";

/** 회원가입 폼 데이터. passwordConfirm은 App에서 일치 여부 검증용. */
export interface SignupForm {
  loginId: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
}

interface SignupModalProps {
  /** 모달 표시 여부 */
  open: boolean;

  /** 모달 닫기 */
  onClose: () => void;

  /** 가입 버튼 클릭 시 폼 데이터를 상위로 전달 (검증·생성은 App이 수행) */
  onSubmit: (form: SignupForm) => void;

  /** 로그인 모달로 전환 */
  onSwitchLogin: () => void;
}

function SignupModal({
  open,
  onClose,
  onSubmit,
  onSwitchLogin,
}: SignupModalProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");

  const handleSubmit = () => {
    onSubmit({ loginId, password, passwordConfirm, nickname });
  };

  return (
    <Modal open={open} onClose={onClose} size="small">
      <div className="signup-modal">
        <div className="form-header">
          <h2 className="form-title">회원가입</h2>
        </div>

        <form className="form-body">
          <div className="form-group">
            <label>아이디</label>

            <input
              className="interactive-control"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>닉네임</label>

            <input
              className="interactive-control"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
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

          <div className="form-group">
            <label>비밀번호 확인</label>

            <input
              type="password"
              className="interactive-control"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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

            <button type="button" className="btn" onClick={handleSubmit}>
              가입하기
            </button>
          </div>
        </form>

        <div className="signup-switch">
          이미 계정이 있나요?{" "}
          <button type="button" className="link-btn" onClick={onSwitchLogin}>
            로그인
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default SignupModal;
