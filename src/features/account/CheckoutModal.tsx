import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, CreditCard, QrCode, Lock, Loader2, ArrowRight, Truck, Landmark } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

type Opcoes = Awaited<ReturnType<typeof api.checkout.options>>;
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
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [shippingId, setShippingId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [cardHolder, setCardHolder] = useState(user?.name || '');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 8842');
  const [installments, setInstallments] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const subtotalCarrinho = cart?.total || 0;
  useEffect(() => {
    if (!checkoutModalOpen) return;
    let vivo = true;
    api.checkout.options(subtotalCarrinho).then((o) => {
      if (!vivo) return;
      setOpcoes(o);
      setShippingId((atual) => (o.shipping.some((x) => x.id === atual) ? atual : o.shipping[0]?.id ?? ''));
      setPaymentId((atual) => (o.payments.some((x) => x.id === atual) ? atual : o.payments[0]?.id ?? ''));
    }).catch(() => { if (vivo) setErrorMessage('Não foi possível carregar as opções de entrega e pagamento.'); });
    return () => { vivo = false; };
  }, [checkoutModalOpen, subtotalCarrinho]);

  if (!checkoutModalOpen) return null;

  const total = subtotalCarrinho;
  const entrega = opcoes?.shipping.find((x) => x.id === shippingId);
  const pagamento = opcoes?.payments.find((x) => x.id === paymentId);
  const ehCartao = pagamento?.kind === 'card';
  const descontoPagamento = pagamento ? Math.round(total * pagamento.discountPercent) / 100 : 0;
  const frete = entrega?.price ?? 0;
  const finalTotal = Math.max(0, total - descontoPagamento) + frete;
  const parcelasMax = pagamento?.maxInstallments ?? 1;
  const opcoesParcelas = Array.from({ length: parcelasMax }, (_, i) => i + 1).filter((n) => n === 1 || n === parcelasMax || n % 3 === 0);

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
      if (!pagamento) { setErrorMessage('Escolha uma forma de pagamento.'); setIsSubmitting(false); return; }

      const res = await api.orders.create({
        shippingAddress: addressString,
        paymentMethodId: pagamento.id,
        installments: ehCartao ? Math.min(Number(installments) || 1, parcelasMax) : 1,
        shippingMethodId: entrega?.id,
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

            {/* Shipping Options */}
            {opcoes && opcoes.shipping.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>2. Forma de Entrega</h3>
                <div className={styles.paymentMethodsGrid}>
                  {opcoes.shipping.map((m) => (
                    <label key={m.id} className={`${styles.paymentCard} ${shippingId === m.id ? styles.paymentCardActive : ''}`}>
                      <input type="radio" name="shipping" value={m.id} checked={shippingId === m.id} onChange={() => setShippingId(m.id)} className={styles.radioInput} />
                      <Truck size={18} color={shippingId === m.id ? '#B89758' : '#767676'} />
                      <div className={styles.paymentText}>
                        <span className={styles.paymentTitle}>{m.name}</span>
                        <span className={styles.paymentSubtitle}>{m.prazo} · {m.free ? 'Cortesia' : formatPrice(m.price)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Options */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{opcoes && opcoes.shipping.length > 0 ? '3' : '2'}. Método de Pagamento</h3>
              <div className={styles.paymentMethodsGrid}>
                {(opcoes?.payments ?? []).map((m) => (
                  <label key={m.id} className={`${styles.paymentCard} ${paymentId === m.id ? styles.paymentCardActive : ''}`}>
                    <input type="radio" name="payment" value={m.id} checked={paymentId === m.id} onChange={() => { setPaymentId(m.id); setInstallments('1'); }} className={styles.radioInput} />
                    {m.kind === 'pix' ? <QrCode size={18} color={paymentId === m.id ? '#B89758' : '#767676'} />
                      : m.kind === 'card' ? <CreditCard size={18} color={paymentId === m.id ? '#B89758' : '#767676'} />
                      : <Landmark size={18} color={paymentId === m.id ? '#B89758' : '#767676'} />}
                    <div className={styles.paymentText}>
                      <span className={styles.paymentTitle}>{m.name}</span>
                      {m.discountPercent > 0
                        ? <span className={styles.paymentDiscountBadge}>{m.discountPercent}% de Desconto</span>
                        : <span className={styles.paymentSubtitle}>{m.kind === 'card' && m.maxInstallments > 1 ? `Até ${m.maxInstallments}x sem juros` : m.description}</span>}
                    </div>
                  </label>
                ))}
                {opcoes && opcoes.payments.length === 0 && <p className={styles.subtitle}>Nenhuma forma de pagamento disponível no momento.</p>}
              </div>

              {ehCartao && (
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
                        {opcoesParcelas.map((n) => (
                          <option key={n} value={n}>{n}x de {formatPrice(finalTotal / n)} (sem juros)</option>
                        ))}
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
              {pagamento && descontoPagamento > 0 && (
                <div className={`${styles.summaryLine} ${styles.discountLine}`}>
                  <span>Desconto {pagamento.name} ({pagamento.discountPercent}%)</span>
                  <span>- {formatPrice(descontoPagamento)}</span>
                </div>
              )}
              {entrega && (
                <div className={styles.summaryLine}>
                  <span>{entrega.name}</span>
                  <span>{entrega.free ? 'Cortesia' : formatPrice(entrega.price)}</span>
                </div>
              )}
              <div className={`${styles.summaryLine} ${styles.summaryTotalLine}`}>
                <span>Total a Pagar</span>
                <span>{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              className={`btn-primary ${styles.submitOrderBtn}`}
              disabled={isSubmitting || !pagamento}
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
