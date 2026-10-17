import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, CreditCard, QrCode, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import styles from './CheckoutModal.module.css';

interface CheckoutModalProps {
  onOrderSuccess: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onOrderSuccess }) => {
  const { cart, checkoutModalOpen, setCheckoutModalOpen, refreshCart } = useCart();
  const { user } = useAuth();

  const [cep, setCep] = useState('01419-001');
  const [street, setStreet] = useState('Alameda Lorena, 1600 - Jardins');
  const [cityState, setCityState] = useState('São Paulo, SP');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('credit_card');
  const [cardHolder, setCardHolder] = useState(user?.name || '');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 8842');
  const [installments, setInstallments] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  if (!checkoutModalOpen) return null;

  const total = cart?.total || 0;
  const pixDiscount = total * 0.05;
  const finalTotal = paymentMethod === 'pix' ? total - pixDiscount : total;

  const formatPrice = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!street.trim()) {
      setErrorMessage('Por favor, informe seu endereço de entrega.');
      return;
    }

    setIsSubmitting(true);
    try {
      const addressString = `${street}, ${cityState} - CEP ${cep}`;
      const paymentDesc = paymentMethod === 'pix' ? 'Pix à Vista (5% OFF)' : `Cartão de Crédito em ${installments}x`;

      const res = await api.orders.create({
        shippingAddress: addressString,
        paymentMethod: paymentDesc,
      });

      setConfirmedOrderId(res.orderId);
      await refreshCart();
      onOrderSuccess(res.orderId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar o pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCheckoutModalOpen(false);
    setConfirmedOrderId(null);
  };

  return (
    <div className={styles.overlay} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Fechar checkout">
          <X size={20} />
        </button>

        {confirmedOrderId ? (
          <div className={styles.successContainer}>
            <div className={styles.successIconWrapper}>
              <CheckCircle2 size={48} color="#B89758" />
            </div>
            <h2 className={styles.successTitle}>Pedido Confirmado com Sucesso!</h2>
            <p className={styles.successOrderNum}>Número do Pedido: <strong>{confirmedOrderId}</strong></p>
            <p className={styles.successDesc}>
              Agradecemos pela preferência, {user?.name.split(' ')[0]}. Nossa equipe de mestres ourives iniciou o processo de embalagem com nosso estojo aveludado exclusivo e certificado de autenticidade.
            </p>
            <div className={styles.deliveryTimeline}>
              <div className={styles.timelineStep}>
                <span className={styles.stepDotActive} />
                <span className={styles.stepText}>Pedido Recebido</span>
              </div>
              <div className={styles.timelineLine} />
              <div className={styles.timelineStep}>
                <span className={styles.stepDot} />
                <span className={styles.stepText}>Embalagem Especial</span>
              </div>
              <div className={styles.timelineLine} />
              <div className={styles.timelineStep}>
                <span className={styles.stepDot} />
                <span className={styles.stepText}>Envio Seguro com Seguro Total</span>
              </div>
            </div>
            <button onClick={handleClose} className={`btn-primary ${styles.returnBtn}`}>
              Continuar Navegando
            </button>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder} className={styles.form}>
            <div className={styles.header}>
              <div className={styles.secureBadge}>
                <Lock size={13} color="#B89758" />
                <span>Checkout Criptografado & Seguro</span>
              </div>
              <h2 id="checkout-title" className={styles.title}>Finalizar Pedido</h2>
              <p className={styles.subtitle}>Confirme seu endereço e escolha a forma de pagamento.</p>
            </div>

            {errorMessage && (
              <div className={styles.errorAlert} role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Delivery Details */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>1. Endereço de Entrega</h3>
              <div className={styles.grid2}>
                <div>
                  <label className={styles.fieldLabel}>CEP</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel}>Cidade / UF</label>
                  <input
                    type="text"
                    value={cityState}
                    onChange={(e) => setCityState(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label className={styles.fieldLabel}>Endereço Completo</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
            </div>

            {/* Payment Options */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>2. Método de Pagamento</h3>
              <div className={styles.paymentMethodsGrid}>
                <label className={`${styles.paymentCard} ${paymentMethod === 'credit_card' ? styles.paymentCardActive : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="credit_card"
                    checked={paymentMethod === 'credit_card'}
                    onChange={() => setPaymentMethod('credit_card')}
                    className={styles.radioInput}
                  />
                  <CreditCard size={18} color={paymentMethod === 'credit_card' ? '#B89758' : '#767676'} />
                  <div className={styles.paymentText}>
                    <span className={styles.paymentTitle}>Cartão de Crédito</span>
                    <span className={styles.paymentSubtitle}>Até 10x sem juros</span>
                  </div>
                </label>

                <label className={`${styles.paymentCard} ${paymentMethod === 'pix' ? styles.paymentCardActive : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="pix"
                    checked={paymentMethod === 'pix'}
                    onChange={() => setPaymentMethod('pix')}
                    className={styles.radioInput}
                  />
                  <QrCode size={18} color={paymentMethod === 'pix' ? '#B89758' : '#767676'} />
                  <div className={styles.paymentText}>
                    <span className={styles.paymentTitle}>Pix Instantâneo</span>
                    <span className={styles.paymentDiscountBadge}>5% de Desconto</span>
                  </div>
                </label>
              </div>

              {paymentMethod === 'credit_card' && (
                <div className={styles.cardDetailsBox}>
                  <div>
                    <label className={styles.fieldLabel}>Nome no Cartão</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className={styles.input}
                      required
                    />
                  </div>
                  <div className={styles.grid2} style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className={styles.fieldLabel}>Número do Cartão</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>
                    <div>
                      <label className={styles.fieldLabel}>Parcelamento</label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                        className={styles.input}
                      >
                        <option value="1">1x de {formatPrice(total)} (sem juros)</option>
                        <option value="3">3x de {formatPrice(total / 3)} (sem juros)</option>
                        <option value="6">6x de {formatPrice(total / 6)} (sem juros)</option>
                        <option value="10">10x de {formatPrice(total / 10)} (sem juros)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className={styles.orderSummaryBox}>
              <div className={styles.summaryLine}>
                <span>Subtotal ({cart?.itemCount} peças)</span>
                <span>{formatPrice(total)}</span>
              </div>
              {paymentMethod === 'pix' && (
                <div className={`${styles.summaryLine} ${styles.discountLine}`}>
                  <span>Desconto Pix (5%)</span>
                  <span>- {formatPrice(pixDiscount)}</span>
                </div>
              )}
              <div className={styles.summaryLine}>
                <span>Frete Seguro Express</span>
                <span>Cortesia</span>
              </div>
              <div className={`${styles.summaryLine} ${styles.summaryTotalLine}`}>
                <span>Total a Pagar</span>
                <span>{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              className={`btn-primary ${styles.submitOrderBtn}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  <span>Processando Compra Segura...</span>
                </>
              ) : (
                <>
                  <span>Confirmar e Finalizar Pedido</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className={styles.trustFooter}>
              <ShieldCheck size={16} color="#B89758" />
              <span>Garantia de 1 ano • Troca cortesia em até 30 dias • Certificado Luce D'Oro</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
