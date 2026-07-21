import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock3, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpgradeRequired, setPasswordUpgradeRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (passwordUpgradeRequired && (newPassword.length < 8 || newPassword !== confirmPassword)) {
        toast.error('A nova senha deve possuir pelo menos 8 caracteres e os campos devem coincidir.');
        return;
      }
      const result = await login(loginUser, loginPassword, passwordUpgradeRequired ? newPassword : undefined);
      if (result === 'ok') {
        toast.success('Acesso autorizado. Bem-vindo ao painel.');
        navigate('/dashboard');
      } else if (result === 'upgrade_required') {
        setPasswordUpgradeRequired(true);
        toast.info('Defina uma nova senha com pelo menos 8 caracteres para concluir a migração.');
      } else if (result === 'rate_limited') {
        toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (result === 'unavailable') {
        toast.error('Serviço de autenticação temporariamente indisponível.');
      } else {
        toast.error('Credenciais inválidas. Verifique seu usuário e senha.');
      }
    } catch (error) {
      toast.error('Erro ao realizar login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <main className="concrem-login">
      <div className="concrem-login__shade" aria-hidden="true" />

      <section className="concrem-brand" aria-labelledby="login-brand-title">
        <motion.header
          className="concrem-brand__header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <img src="/concrem-login/logo-branco.png" alt="CONCREM" className="concrem-brand__logo" />
          <span>HELP DESK</span>
        </motion.header>

        <motion.div
          className="concrem-brand__copy"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 id="login-brand-title">
            Suporte que <em>conecta.</em><br />
            Soluções que <em>transformam.</em>
          </h1>
          <div className="concrem-brand__gold-line" aria-hidden="true" />
          <p>Tecnologia e eficiência para manter<br />a CONCREM sempre em movimento.</p>
        </motion.div>

        <motion.div
          className="concrem-status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          aria-label={`Sistemas operacionais. Horário atual: ${formattedTime}`}
        >
          <span className="concrem-status__dot" aria-hidden="true" />
          <span>SISTEMAS OK</span>
          <span className="concrem-status__separator" aria-hidden="true" />
          <Clock3 size={16} aria-hidden="true" />
          <time>{formattedTime}</time>
        </motion.div>
      </section>

      <section className="concrem-login__form-area" aria-label="Acesso ao Help Desk">
        <motion.div
          className="concrem-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <header className="concrem-card__header">
            <div className="concrem-card__mark">
              <img src="/favicon.ico" alt="" aria-hidden="true" />
            </div>
            <h2>Bem-vindo de volta</h2>
            <p>Acesse sua conta para continuar</p>
            <span className="concrem-card__gold-line" aria-hidden="true" />
          </header>

          <form onSubmit={handleLogin} className="concrem-form">
            <div className="concrem-field">
              <label htmlFor="usuario">Usuário</label>
              <div className="concrem-input-wrap">
                <UserRound aria-hidden="true" />
                <input
                  id="usuario"
                  name="usuario"
                  type="text"
                  autoComplete="username"
                  placeholder="Digite seu usuário"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="concrem-field">
              <div className="concrem-field__row">
                <label htmlFor="password">Senha</label>
                <button type="button" className="concrem-forgot">Esqueceu a senha?</button>
              </div>
              <div className="concrem-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="concrem-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {passwordUpgradeRequired && <>
              <div className="concrem-field"><label htmlFor="new-password">Nova senha</label><div className="concrem-input-wrap"><LockKeyhole aria-hidden="true" /><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} required /></div></div>
              <div className="concrem-field"><label htmlFor="confirm-password">Confirmar nova senha</label><div className="concrem-input-wrap"><LockKeyhole aria-hidden="true" /><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} required /></div></div>
            </>}

            <button type="submit" disabled={isLoading} className="concrem-submit">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className="concrem-spinner" aria-hidden="true" />
                    Autenticando...
                  </motion.span>
                ) : (
                  <motion.span key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Entrar no painel <ArrowRight aria-hidden="true" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </form>

          <footer className="concrem-card__footer">
            <span aria-hidden="true" />
            <ShieldCheck aria-hidden="true" />
            <p>Acesso seguro e protegido</p>
            <span aria-hidden="true" />
          </footer>
        </motion.div>
      </section>
    </main>
  );
};

export default Login;
