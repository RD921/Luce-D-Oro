import React from 'react';
import { X, Plus, Minus, Trash2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import styles from './CartDrawer.module.css';

interface CartDrawerProps {
  onOpenCheckout: () => void;
  onNavigateCatalog: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenCheckout, onNavigateCatalog }) => {
  const { isAuthenticated } = useAuth();
  const { cart, cartDrawerOpen, closeCartDrawer, updateItem, removeItem } = useCart();

  // STRICT RULE: Do not render if not authenticated
  if (!isAuthenticated || !cartDrawerOpen) {
    return null;
  }

  const items = cart?.items || [];
  const total = cart?.total || 0;
  const freeShippingAvailable = cart?.freeShippingAvailable !== false;
  const freeShippingThreshold = cart?.freeShippingThreshold || 500;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - total);
  const freeShippingProgress = Math.min(100, (total / freeShippingThreshold) * 100);

  const formatPrice = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCheckoutClick = () => {
    closeCartDrawer();
    onOpenCheckout();
  };

  return (
    <div className={styles.overlay} onClick={closeCartDrawer} role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 id="cart-drawer-title" className={styles.title}>Sua Sacola</h2>
            <span className={styles.itemCount}>
              {cart?.itemCount || 0} {cart?.itemCount === 1 ? 'peça selecionada' : 'peças selecionadas'}
            </span>
          </div>
          <button
            onClick={closeCartDrawer}
            className={styles.closeBtn}
            aria-label="Fechar sacola"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        {freeShippingAvailable && (
        <div className={styles.shippingBarContainer}>
          {total >= freeShippingThreshold ? (
            <div className={styles.shippingAchieved}>
              <Sparkles size={14} color="#B89758" />
              <span>Você conquistou <strong>Frete Cortesia</strong> para todo o Brasil.</span>
            </div>
          ) : (
            <div className={styles.shippingPending}>
              <span>
                Adicione mais <strong>{formatPrice(remainingForFreeShipping)}</strong> para ganhar Frete Cortesia.
              </span>
            </div>
          )}
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>
        )}

        {/* Items List */}
        <div className={styles.itemsList}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
              <p className={styles.emptyTitle}>Sua sacola está vazia</p>
              <p className={styles.emptyDesc}>
                Explore as coleções da Luce D'Oro e encontre joias exclusivas para contar a sua história.
              </p>
              <button
                onClick={() => {
                  closeCartDrawer();
                  onNavigateCatalog();
                }}
                className={`btn-secondary ${styles.emptyCta}`}
              >
                Descobrir Joias
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <img
                  src={item.image_primary}
                  alt={item.name}
                  className={styles.itemImage}
                />
                <div className={styles.itemDetails}>
                  <div className={styles.itemTopRow}>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    <button
                      onClick={() => removeItem(item.id)}
                      className={styles.itemRemoveBtn}
                      aria-label={`Remover ${item.name} da sacola`}
                      title="Remover item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <span className={styles.itemVariant}>{item.variant_title}</span>
                  <div className={styles.itemBottomRow}>
                    <div className={styles.qtyControl}>
                      <button
                        onClick={() => updateItem(item.id, item.quantity - 1)}
                        className={styles.qtyBtn}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus size={13} />
                      </button>
                      <span className={styles.qtyNumber}>{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                        className={styles.qtyBtn}
                        aria-label="Aumentar quantidade"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className={styles.itemPrice}>
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with totals and checkout */}
        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Subtotal</span>
              <span className={styles.summaryValue}>{formatPrice(total)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Frete</span>
              <span className={styles.summaryValue}>
                {freeShippingAvailable && total >= freeShippingThreshold ? 'Cortesia' : 'Escolhido no checkout'}
              </span>
            </div>
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span className={styles.totalLabel}>Total Estimado</span>
              <span className={styles.totalValue}>{formatPrice(total)}</span>
            </div>

            <p className={styles.installmentNote}>
              ou em até 10x de {formatPrice(total / 10)} sem juros no cartão
            </p>

            <button
              onClick={handleCheckoutClick}
              className={`btn-primary ${styles.checkoutBtn}`}
              id="cart-checkout-btn"
            >
              <span>Finalizar Compra Segura</span>
              <ArrowRight size={16} />
            </button>

            <div className={styles.guaranteeNote}>
              <ShieldCheck size={15} color="#B89758" />
              <span>Garantia Vitalícia do Ouro • Embalagem para Presente Inclusa</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
