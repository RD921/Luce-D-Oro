import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type CartResponse } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface CartContextType {
  cart: CartResponse | null;
  isLoading: boolean;
  cartDrawerOpen: boolean;
  checkoutModalOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  setCheckoutModalOpen: (open: boolean) => void;
  addItem: (productId: string, variantTitle: string, quantity?: number) => Promise<boolean>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);

  // Sync cart with authentication state
  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      setCartDrawerOpen(false);
      setCheckoutModalOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.cart.getCart();
      setCart(data);
    } catch {
      setCart(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const openCartDrawer = () => {
    if (!isAuthenticated) return;
    setCartDrawerOpen(true);
  };

  const closeCartDrawer = () => {
    setCartDrawerOpen(false);
  };

  const addItem = async (productId: string, variantTitle: string, quantity = 1): Promise<boolean> => {
    // If not authenticated, open login with contextual message
    if (!isAuthenticated) {
      openAuthModal('', 'Acesse sua conta para adicionar itens à sua sacola exclusiva.');
      return false;
    }

    try {
      await api.cart.addItem(productId, variantTitle, quantity);
      await refreshCart();
      showToast('Item adicionado à sua sacola.', 'success');
      setCartDrawerOpen(true);
      return true;
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar item.', 'error');
      return false;
    }
  };

  const updateItem = async (itemId: number, quantity: number) => {
    if (!isAuthenticated) return;
    try {
      await api.cart.updateItem(itemId, quantity);
      await refreshCart();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar item.', 'error');
    }
  };

  const removeItem = async (itemId: number) => {
    if (!isAuthenticated) return;
    try {
      await api.cart.removeItem(itemId);
      await refreshCart();
      showToast('Item removido da sacola.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover item.', 'error');
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        cartDrawerOpen,
        checkoutModalOpen,
        openCartDrawer,
        closeCartDrawer,
        setCheckoutModalOpen,
        addItem,
        updateItem,
        removeItem,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
