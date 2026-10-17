import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Eye, EyeOff, X, ArrowLeft, Loader2, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import styles from './AuthModal.module.css';

type AuthView = 'login' | 'forgot-password' | 'register';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalEmail,
    authModalContextMessage,
    closeAuthModal,
    login,
    register,
  } = useAuth();
  const { showToast } = useToast();

  const [currentView, setCurrentView] = useState<AuthView>('login');

  // Progressive Login States
  // isPasswordRevealed: false = only email visible; true = email + password revealed vertically
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAcceptedTerms, setRegAcceptedTerms] = useState(true);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (authModalOpen) {
      setCurrentView('login');
      setEmail(authModalEmail || '');
      setForgotEmail(authModalEmail || '');
      setRegEmail(authModalEmail || '');
      setPassword('');
      setIsPasswordRevealed(false);
      setErrorMessage(null);
      setForgotSubmitted(false);

      // Focus email after opening
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [authModalOpen, authModalEmail]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && authModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  // Validate email syntax
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Step 1 -> Step 2: Validate Email and Reveal Password Field
  const handleProceedToPassword = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMessage('Por favor, digite seu e-mail.');
      emailInputRef.current?.focus();
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage('Formato de e-mail inválido. Ex: nome@exemplo.com');
      emailInputRef.current?.focus();
      return;
    }

    // Brief processing animation for polish
    setIsCheckingEmail(true);
    try {
      await api.auth.validateEmail(cleanEmail);
      setIsPasswordRevealed(true);
      // Autofocus password input after smooth expansion
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 250);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao validar e-mail.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordRevealed) {
      await handleProceedToPassword();
      return;
    }

    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Por favor, informe sua senha.');
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Forgot Password
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!forgotEmail.trim() || !isValidEmail(forgotEmail.trim())) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.forgotPassword(forgotEmail.trim());
      setForgotSubmitted(true);
      showToast('Instruções geradas com sucesso.', 'info');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim() || regName.trim().length < 3) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    if (!isValidEmail(regEmail.trim())) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    if (!regAcceptedTerms) {
      setErrorMessage('É necessário aceitar os Termos e Políticas para criar sua conta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao criar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemoHelena = () => {
    setEmail('cliente@cddeouro.com.br');
    setPassword('Senha@123');
    setIsPasswordRevealed(true);
    setErrorMessage(null);
  };

  return (
    <div className={styles.overlay} onClick={closeAuthModal} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div
        className={styles.popoverCard}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className={styles.closeBtn}
          onClick={closeAuthModal}
          aria-label="Fechar painel de autenticação"
        >
          <X size={18} />
        </button>

        {/* Contextual Message Banner (if visitor tried to add to cart, etc.) */}
        {authModalContextMessage && (
          <div className={styles.contextBanner}>
            <Sparkles size={14} className={styles.contextIcon} />
            <span>{authModalContextMessage}</span>
          </div>
        )}

        {/* ================= VIEW 1: PROGRESSIVE LOGIN ================= */}
        {currentView === 'login' && (
          <form onSubmit={handleLoginSubmit} noValidate>
            <div className={styles.headerArea}>
              <h2 id="auth-modal-title" className={styles.title}>Entre na sua conta</h2>
              <p className={styles.subtitle}>Acesse sua conta para acompanhar suas compras</p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className={styles.errorAlert} role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Field with Compact Arrow Button */}
            <div className={styles.inputGroup}>
              <label htmlFor="auth-email" className={styles.inputLabel}>
                E-mail
              </label>
              <div className={styles.emailRow}>
                <input
                  ref={emailInputRef}
                  id="auth-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isPasswordRevealed) {
                      e.preventDefault();
                      handleProceedToPassword();
                    }
                  }}
                  placeholder="Digite seu e-mail"
                  className={styles.textInput}
                  disabled={isSubmitting}
                  autoComplete="email"
                  required
                />
                {!isPasswordRevealed && (
                  <button
                    type="button"
                    onClick={handleProceedToPassword}
                    className={styles.arrowButton}
                    disabled={isCheckingEmail}
                    aria-label="Avançar para digitar a senha"
                    id="auth-next-step-btn"
                  >
                    {isCheckingEmail ? (
                      <Loader2 size={16} className={styles.spinner} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* PROGRESSIVE REVELATION: Password Section (Vertically Expanded) */}
            <div className={`${styles.passwordExpansionArea} ${isPasswordRevealed ? styles.expanded : ''}`}>
              {isPasswordRevealed && (
                <div className={styles.passwordInnerContent}>
                  <div className={styles.inputGroup}>
                    <div className={styles.labelRow}>
                      <label htmlFor="auth-password" className={styles.inputLabel}>
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentView('forgot-password');
                          setForgotEmail(email);
                          setErrorMessage(null);
                        }}
                        className={styles.inlineLink}
                      >
                        Redefinir senha
                      </button>
                    </div>
                    <div className={styles.passwordFieldWrapper}>
                      <input
                        ref={passwordInputRef}
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Digite sua senha"
                        className={styles.textInput}
                        disabled={isSubmitting}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={styles.eyeToggleBtn}
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Main 'Entrar' Button */}
                  <button
                    type="submit"
                    className={`btn-primary ${styles.submitBtn}`}
                    disabled={isSubmitting}
                    id="auth-submit-login-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className={styles.spinner} />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <span>Entrar</span>
                    )}
                  </button>

                  {/* Demo helper */}
                  <div className={styles.demoHelper}>
                    <button
                      type="button"
                      onClick={handleFillDemoHelena}
                      className={styles.demoFillBtn}
                      title="Preencher dados de teste cadastrados no sistema"
                    >
                      <Sparkles size={12} />
                      <span>Preencher conta de demonstração (Helena)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className={styles.bottomArea}>
              <div className={styles.footerRow}>
                <span className={styles.footerPrompt}>Ainda não possui conta?</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('register');
                    setRegEmail(email);
                    setErrorMessage(null);
                  }}
                  className={styles.footerLink}
                >
                  Criar conta
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ================= VIEW 2: FORGOT PASSWORD ================= */}
        {currentView === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} noValidate>
            <div className={styles.backRow}>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('login');
                  setErrorMessage(null);
                }}
                className={styles.backButton}
                aria-label="Voltar para o login"
              >
                <ArrowLeft size={16} />
                <span>Voltar ao login</span>
              </button>
            </div>

            <div className={styles.headerArea}>
              <h2 className={styles.title}>Recuperar acesso</h2>
              <p className={styles.subtitle}>
                Informe seu e-mail cadastrado para receber instruções seguras de redefinição de senha.
              </p>
            </div>

            {errorMessage && (
              <div className={styles.errorAlert} role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {forgotSubmitted ? (
              <div className={styles.successBox}>
                <div className={styles.checkCircle}>
                  <Check size={20} />
                </div>
                <h3 className={styles.successTitle}>Solicitação enviada</h3>
                <p className={styles.successText}>
                  Se houver uma conta correspondente ao e-mail <strong>{forgotEmail}</strong>, você receberá um link temporário para definir uma nova senha em instantes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('login');
                    setForgotSubmitted(false);
                  }}
                  className={`btn-primary ${styles.submitBtn}`}
                  style={{ marginTop: '1.5rem' }}
                >
                  Retornar ao Login
                </button>
              </div>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="forgot-email" className={styles.inputLabel}>
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Digite seu e-mail"
                    className={styles.textInput}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`btn-primary ${styles.submitBtn}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className={styles.spinner} />
                      <span>Enviando instruções...</span>
                    </>
                  ) : (
                    <span>Enviar instruções</span>
                  )}
                </button>
              </>
            )}
          </form>
        )}

        {/* ================= VIEW 3: REGISTER ================= */}
        {currentView === 'register' && (
          <form onSubmit={handleRegisterSubmit} noValidate>
            <div className={styles.backRow}>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('login');
                  setErrorMessage(null);
                }}
                className={styles.backButton}
                aria-label="Voltar para o login"
              >
                <ArrowLeft size={16} />
                <span>Voltar ao login</span>
              </button>
            </div>

            <div className={styles.headerArea}>
              <h2 className={styles.title}>Criar sua conta</h2>
              <p className={styles.subtitle}>
                Junte-se à Luce D'Oro para uma experiência exclusiva de joalheria.
              </p>
            </div>

            {errorMessage && (
              <div className={styles.errorAlert} role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="reg-name" className={styles.inputLabel}>
                Nome completo
              </label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ex: Helena Vasconcelos"
                className={styles.textInput}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="reg-email" className={styles.inputLabel}>
                E-mail
              </label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                className={styles.textInput}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="reg-password" className={styles.inputLabel}>
                Senha (mínimo 6 caracteres)
              </label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Crie sua senha segura"
                className={styles.textInput}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="reg-confirm" className={styles.inputLabel}>
                Confirmação de senha
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
                className={styles.textInput}
                required
              />
            </div>

            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={regAcceptedTerms}
                  onChange={(e) => setRegAcceptedTerms(e.target.checked)}
                  className={styles.checkboxInput}
                />
                <span>Declaro que li e concordo com a Política de Privacidade e Termos de Uso Luce D'Oro.</span>
              </label>
            </div>

            <button
              type="submit"
              className={`btn-primary ${styles.submitBtn}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  <span>Criando conta...</span>
                </>
              ) : (
                <span>Criar Conta</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
