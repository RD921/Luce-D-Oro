import type { Product } from '../../services/api';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  const formatPrice = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <article className={styles.card} onClick={() => onSelect(product)}>
      <div className={styles.imageContainer}>
        <img
          src={product.image_primary}
          alt={product.name}
          className={styles.image}
          loading="lazy"
        />
        {product.old_price && (
          <span className={styles.badgeSale}>Edição Limitada</span>
        )}
        <div className={styles.overlayAction}>
          <span className={styles.quickViewText}>Explorar Joia</span>
        </div>
      </div>

      <div className={styles.content}>
        <span className={styles.categoryName}>
          {product.category_id.toUpperCase()}
        </span>
        <h3 className={styles.name}>{product.name}</h3>

        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {product.old_price && (
            <span className={styles.oldPrice}>{formatPrice(product.old_price)}</span>
          )}
        </div>

        <p className={styles.installments}>
          em até 10x de {formatPrice(product.price / 10)} sem juros
        </p>

        {product.variants.length > 1 && (
          <div className={styles.variantNotice}>
            <span>{product.variants.length} opções disponíveis</span>
          </div>
        )}
      </div>
    </article>
  );
};
