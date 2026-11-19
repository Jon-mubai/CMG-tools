import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { saveSession, type Session } from '@/session';

type Props = { onLogin: (s: Session) => void };

const DEFAULT_CONTACT = 'https://qm.qq.com/q/cj5xob7DmU';
const QR_REFRESH_SEC = 12;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        icon?: string;
        width?: string | number;
        height?: string | number;
      };
    }
  }
  interface Window {
    QRCode?: {
      toCanvas: (canvas: HTMLCanvasElement, text: string, opts: object, cb: (err: Error | null) => void) => void;
    };
  }
}

function CrewFace() {
  return (
    <div className="crew-face">
      <span className="crew-eye"><i className="crew-pupil" /></span>
      <span className="crew-eye"><i className="crew-pupil" /></span>
    </div>
  );
}

function ContactQr() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(QR_REFRESH_SEC);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState(DEFAULT_CONTACT);

  useEffect(() => {
    api.get<{ contactAdminUrl?: string }>('/api/v1/meta/config')
      .then((cfg) => {
        if (cfg?.contactAdminUrl) setUrl(cfg.contactAdminUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let timer = 0;
    let tick = 0;
    function draw() {
      const canvas = canvasRef.current;
      const qr = window.QRCode;
      if (!canvas || !qr?.toCanvas) {
        setFailed(true);
        return;
      }
      const sep = url.includes('?') ? '&' : '?';
      qr.toCanvas(canvas, `${url}${sep}_t=${Date.now()}`, {
        width: 200,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }, (err) => setFailed(!!err));
      setLeft(QR_REFRESH_SEC);
    }
    draw();
    tick = window.setInterval(() => setLeft((n) => (n <= 1 ? QR_REFRESH_SEC : n - 1)), 1000);
    timer = window.setInterval(draw, QR_REFRESH_SEC * 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(tick);
    };
  }, [url]);

  return (
    <div className="auth-contact">
      <div className="auth-qr-wrap">
        <canvas ref={canvasRef} width={200} height={200} aria-label="联系管理员二维码" style={{ display: failed ? 'none' : 'block' }} />
        {failed && <div className="auth-qr-fallback">二维码加载失败，请确认已加载 /vendor 脚本后重试</div>}
      </div>
      <p className="auth-qr-tip">请使用手机扫描二维码联系管理员 · {left}s 后刷新</p>
    </div>
  );
}

export function LoginPage({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'contact'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const u = username.trim();
    if (!u || !password) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ accessToken?: string; token?: string; user?: { username?: string; name?: string } }>(
        '/api/v1/auth/login',
        { username: u, password },
      );
      const token = data.accessToken || data.token || '';
      if (!token) throw new Error('登录响应缺少 token');
      const session: Session = {
        token,
        username: data.user?.username || u,
        displayName: data.user?.name || u,
        source: 'api',
      };
      saveSession(session);
      onLogin(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      if (/fetch|network|failed|ECONN/i.test(msg) || msg === 'Failed to fetch') {
        setError('后端未连接，请先启动 API（3001）后再登录');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="authGate" className="auth-gate is-open">
      <div className="auth-shell">
        <div className="auth-pane auth-pane-brand">
          <div className="auth-brand-top">
            <div className="auth-brand-logo">
              <span className="auth-brand-icon" aria-hidden="true">
                <iconify-icon icon="ant-design:home-filled" width="18" height="18" />
              </span>
              <span className="auth-brand-name">Warehouse Management</span>
            </div>
          </div>
          <div className="auth-banner auth-banner-crew" aria-hidden="true">
            <div className="crew-stage">
              <div className="crew-body crew-tall" data-crew data-depth="0.35"><CrewFace /></div>
              <div className="crew-body crew-black" data-crew data-depth="0.55"><CrewFace /></div>
              <div className="crew-body crew-orange" data-crew data-depth="0.75"><CrewFace /></div>
              <div className="crew-body crew-yellow" data-crew data-depth="0.9">
                <CrewFace />
                <span className="crew-mouth" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="auth-pane-foot">
            © 2026 WMS Cloud · 隐私政策<span className="auth-pane-foot-sep"> · </span>系统由 MuBai | Archie 提供技术支持
          </div>
        </div>

        <div className="auth-pane auth-pane-form">
          <div className="auth-form-header">
            <h2 className="auth-form-title">
              登录 <span className="auth-brand-accent">WMS-Tec</span>
            </h2>
          </div>
          <div className="auth-tabs">
            <button type="button" className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>账号登录</button>
            <button type="button" className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>联系管理员</button>
          </div>
          <div className="auth-views">
            {tab === 'login' ? (
              <div data-auth-view="login">
                <form onSubmit={submit} autoComplete="off">
                  <div className="auth-field">
                    <label htmlFor="authUsername">账号名称</label>
                    <div className="auth-input-wrap">
                      <iconify-icon className="auth-input-ico" icon="ant-design:user-outlined" width="16" height="16" />
                      <input
                        id="authUsername"
                        className="field-control has-ico"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入账号名称"
                        maxLength={32}
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="authPassword">密码</label>
                    <div className="auth-input-wrap auth-input-wrap-pwd">
                      <iconify-icon className="auth-input-ico" icon="ant-design:lock-outlined" width="16" height="16" />
                      <input
                        id="authPassword"
                        className="field-control has-ico has-pwd-toggle"
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入登录密码"
                        maxLength={64}
                      />
                      <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd((v) => !v)} aria-label="显示或隐藏密码">
                        <iconify-icon icon={showPwd ? 'ant-design:eye-outlined' : 'ant-design:eye-invisible-outlined'} width="16" height="16" />
                      </button>
                    </div>
                  </div>
                  <div className="auth-error" role="alert">{error}</div>
                  <div className="auth-actions">
                    <button type="submit" className="btn btn-primary auth-login-btn" disabled={loading}>
                      {loading ? '登录中…' : '登录'}
                    </button>
                  </div>
                </form>
                <p className="auth-hint">
                  没有账号？
                  <button type="button" className="auth-link-btn" onClick={() => setTab('contact')}>联系管理员</button>
                </p>
              </div>
            ) : (
              <div data-auth-view="contact">
                <ContactQr />
              </div>
            )}
          </div>
          <div className="auth-social auth-social-fixed">
            <div className="auth-social-divider" aria-hidden="true" />
            <div className="auth-social-row">
              <a className="auth-social-link auth-social-xhs" href="https://www.xiaohongshu.com/" target="_blank" rel="noopener noreferrer" title="小红书" aria-label="小红书">
                <svg className="auth-xhs-wordmark" width="56" height="22" viewBox="0 0 160 48" aria-hidden="true">
                  <text x="80" y="36" textAnchor="middle" fill="#FF2442" fontSize="42" fontWeight="900" letterSpacing="2">小红书</text>
                </svg>
              </a>
              <a className="auth-social-link auth-social-gh" href="https://github.com/Jon-mubai/CMG-tool" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
                <iconify-icon icon="ant-design:github-filled" width="22" height="22" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
