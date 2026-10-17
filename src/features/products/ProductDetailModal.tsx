import { useState } from 'react';
import { X, ShieldCheck, Truck, RefreshCw, ChevronDown, ChevronUp, ShoppingBag, Sparkles } from 'lucide-react';
import type { Product } from '../../services/api';
import { useCart } from '../../context/CartContext';
import styles from './ProductDetailModal.module.css';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailModal = ({ product, onClose }: ProductDetailModalProps) => {
  const { addItem } = useCart();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string>(product?.variants[0] || '');
  const [isAdding, setIsAdding] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>('materials');

  if (!product) return null;

  const currentVariant = selectedVariant || product.variants[0];

  const formatPrice = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addItem(product.id, currentVariant, 1);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleAccordion = (id: string) => {
    setActiveAccordion((prev) => (prev === id ? null : id));
  };

  const images = product.images.length > 0 ? product.images : [product.image_primary];

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="product-detail-name">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar detalhes da joia">
          <X size={20} />
        </button>

        <div className={styles.grid}>
          {/* Left Column: Gallery */}
          <div className={styles.galleryColumn}>
            <div className={styles.mainImageWrapper}>
              <img
                src={images[selectedImageIndex] || product.image_primary}
                alt={product.name}
                className={styles.mainImage}
              />
              <div className={styles.exclusiveBadge}>
                <Sparkles size={12} color="#B89758" />
                <span>Ouro 18k Nobre</span>
              </div>
            </div>

            {images.length > 1 && (
              <div className={styles.thumbnailsRow}>
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`${styles.thumbBtn} ${selectedImageIndex === idx ? styles.thumbActive : ''}`}
                    aria-label={`Visualizar foto ${idx + 1}`}
                  >
                    <img src={img} alt="" className={styles.thumbImage} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Details & Purchase */}
          <div className={styles.infoColumn}>
            <span className={styles.categoryBadge}>{product.category_id.toUpperCase()}</span>
            <h1 id="product-detail-name" className={styles.name}>{product.name}</h1>

            <div className={styles.priceContainer}>
              <div className={styles.priceRow}>
                <span className={styles.price}>{formatPrice(product.price)}</span>
                {product.old_price && (
                  <span className={styles.oldPrice}>{formatPrice(product.old_price)}</span>
                )}
              </div>
              <p className={styles.installmentText}>
                em até 10x de <strong>{formatPrice(product.price / 10)}</strong> sem juros no cartão ou <strong>{formatPrice(product.price * 0.95)}</strong> no Pix (5% OFF)
              </p>
            </div>

            <p className={styles.shortDescription}>{product.description}</p>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className={styles.variantSection}>
                <label className={styles.variantLabel}>
                  Variação Selecionada: <strong>{currentVariant}</strong>
                </label>
                <div className={styles.variantsPills}>
                  {product.variants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`${styles.variantPill} ${currentVariant === variant ? styles.variantPillActive : ''}`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock status */}
            <div className={styles.stockNotice}>
              <span className={styles.stockDot} />
              <span>
                {product.stock > 5 ? 'Disponível em estoque • Envio imediato' : `Restam apenas ${product.stock} unidades disponíveis`}
              </span>
            </div>

            {/* CTA Add to Bag */}
            <button
              onClick={handleAddToCart}
              className={`btn-primary ${styles.addToCartBtn}`}
              disabled={isAdding || product.stock <= 0}
              id="product-add-to-cart-btn"
            >
              <ShoppingBag size={18} />
              <span>{isAdding ? 'Adicionando à Sacola...' : 'Adicionar à Sacola'}</span>
            </button>

            {/* Value Props */}
            <div className={styles.valueProps}>
              <div className={styles.valueItem}>
                <Truck size={16} color="#B89758" />
                <span>Frete Cortesia acima de R$ 500</span>
              </div>
              <div className={styles.valueItem}>
                <ShieldCheck size={16} color="#B89758" />
                <span>Garantia Vitalícia do Ouro</span>
              </div>
              <div className={styles.valueItem}>
                <RefreshCw size={16} color="#B89758" />
                <span>Primeira Troca Cortesia em 30 Dias</span>
              </div>
            </div>

            {/* Accordions */}
            <div className={styles.accordions}>
              {/* Materials & Specs */}
              <div className={styles.accordionItem}>
                <button
                  onClick={() => toggleAccordion('materials')}
                  className={styles.accordionHeader}
                  aria-expanded={activeAccordion === 'materials'}
                >
                  <span>Especificações & Materiais Nobres</span>
                  {activeAccordion === 'materials' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {activeAccordion === 'materials' && (
                  <div className={styles.accordionBody}>
                    <p><strong>Composição:</strong> {product.materials}</p>
                    <p style={{ marginTop: '0.4rem' }}><strong>Dimensões:</strong> {product.dimensions}</p>
                  </div>
                )}
              </div>

              {/* Warranty */}
              <div className={styles.accordionItem}>
                <button
                  onClick={() => toggleAccordion('warranty')}
                  className={styles.accordionHeader}
                  aria-expanded={activeAccordion === 'warranty'}
                >
                  <span>Certificado de Garantia Luce D'Oro</span>
                  {activeAccordion === 'warranty' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {activeAccordion === 'warranty' && (
                  <div className={styles.accordionBody}>
                    <p>{product.warranty}</p>
                    <p style={{ marginTop: '0.4rem' }}>Acompanha livreto assinado com certificado oficial de teor do metal e número individual de rastreio.</p>
                  </div>
                )}
              </div>

              {/* Care Instructions */}
              <div className={styles.accordionItem}>
                <button
                  onClick={() => toggleAccordion('care')}
                  className={styles.accordionHeader}
                  aria-expanded={activeAccordion === 'care'}
                >
                  <span>Cuidados & Conservação</span>
                  {activeAccordion === 'care' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {activeAccordion === 'care' && (
                  <div className={styles.accordionBody}>
                    <p>{product.care_instructions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
