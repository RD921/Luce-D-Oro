import { useEffect, useState } from 'react';
import { X, Package, Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, type Order } from '../../services/api';
import styles from './OrdersModal.module.css';

export const OrdersModal = () => {
  const { ordersModalOpen, setOrdersModalOpen, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (ordersModalOpen) {
      setLoading(true);
      api.orders
        .list()
        .then((data) => setOrders(data))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    }
  }, [ordersModalOpen]);

  if (!ordersModalOpen) return null;

  const formatPrice = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.overlay} onClick={() => setOrdersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="orders-title">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={() => setOrdersModalOpen(false)}
          aria-label="Fechar meus pedidos"
        >
          <X size={20} />
        </button>

        <div className={styles.header}>
          <div className={styles.iconCircle}>
            <Package size={22} color="#B89758" />
          </div>
          <div>
            <h2 id="orders-title" className={styles.title}>Meus Pedidos</h2>
            <p className={styles.subtitle}>Acompanhe o status e histórico das suas joias Luce D'Oro</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <Loader2 size={24} className={styles.spinner} />
            <p>Carregando seus pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Nenhum pedido realizado ainda</p>
            <p className={styles.emptyDesc}>
              Olá {user?.name.split(' ')[0]}, suas futuras compras e certificados de joias aparecerão aqui com rastreamento completo.
            </p>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {orders.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div>
                    <span className={styles.orderId}>{order.id}</span>
                    <div className={styles.orderDate}>
                      <Calendar size={13} />
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                  <div className={styles.orderStatusBadge}>
                    <Clock size={12} />
                    <span>{order.status}</span>
                  </div>
                </div>

                <div className={styles.itemsList}>
                  {order.items.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className={styles.itemThumb}
                      />
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.product_name}</span>
                        <span className={styles.itemSub}>{item.variant_title} • Qtd: {item.quantity}</span>
                      </div>
                      <span className={styles.itemPrice}>
                        {formatPrice(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.orderFooter}>
                  <div className={styles.addressLine}>
                    <MapPin size={13} color="#9C9891" />
                    <span>Entrega: {order.shipping_address}</span>
                  </div>
                  <div className={styles.totalLine}>
                    <span className={styles.totalLabel}>Total:</span>
                    <span className={styles.totalVal}>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
