import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type User } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  canAdmin: boolean;
  isLoading: boolean;
  authModalOpen: boolean;
  authModalEmail: string;
  authModalContextMessage: string | null;
  openAuthModal: (email?: string, contextMessage?: string) => void;
  closeAuthModal: () => void;
  ordersModalOpen: boolean;
  setOrdersModalOpen: (open: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyOwnerSetup: (setupKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalEmail, setAuthModalEmail] = useState<string>('');
  const [authModalContextMessage, setAuthModalContextMessage] = useState<string | null>(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState<boolean>(false);

  const { showToast } = useToast();

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res.user) {
        setUser(res.user);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Validate existing session on application start
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const res = await api.auth.me();
        if (isMounted && res.user) {
          setUser(res.user);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const openAuthModal = useCallback((email = '', contextMessage?: string) => {
    setAuthModalEmail(email);
    setAuthModalContextMessage(contextMessage || null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalContextMessage(null);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.auth.login(email, pass);
    setUser(res.user);
    closeAuthModal();
    if (res.user.role === 'owner' && res.user.email.toLowerCase() === 'rodrigoarrezzi@icloud.com') {
      showToast(`Bem-vindo, Rodrigo Arrezzi! Central de Comando autorizada.`, 'success');
    } else {
      showToast(`Bem-vindo(a) de volta, ${res.user.name.split(' ')[0]}!`, 'success');
    }
  };

  const register = async (data: { name: string; email: string; password: string; confirmPassword: string }) => {
    const res = await api.auth.register(data);
    setUser(res.user);
    closeAuthModal();
    showToast(`Conta criada com sucesso! Bem-vindo(a), ${res.user.name.split(' ')[0]}!`, 'success');
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setOrdersModalOpen(false);
    showToast('Você saiu da sua conta.', 'info');
  };

  const verifyOwnerSetup = async (setupKey: string) => {
    const res = await api.admin.verifyOwner(setupKey);
    await refreshUser();
    showToast(res.message, 'success');
  };

  const isAuthenticated = Boolean(user);
  // Strict client-side check aligned with backend
  const isOwner = Boolean(
    user && user.role === 'owner' && user.email.toLowerCase() === 'rodrigoarrezzi@icloud.com'
  );

  // Dono ou equipe com algum nível de acesso (o servidor continua sendo quem decide de verdade)
  const canAdmin = isOwner || Boolean(user?.isStaff);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isOwner,
        canAdmin,
        isLoading,
        authModalOpen,
        authModalEmail,
        authModalContextMessage,
        openAuthModal,
        closeAuthModal,
        ordersModalOpen,
        setOrdersModalOpen,
        login,
        register,
        logout,
        refreshUser,
        verifyOwnerSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
