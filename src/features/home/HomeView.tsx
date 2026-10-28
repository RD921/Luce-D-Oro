import { useState, useEffect } from 'react';
import { ArrowRight, ShoppingBag, ShieldCheck, Sparkles, Truck, Gem, Check, Eye } from 'lucide-react';
import { api, type Product } from '../../services/api';
import { useSite } from '../../context/SiteContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import styles from './HomeView.module.css';

interface HomeViewProps {
  onNavigateCategory: (slug: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const HomeView = ({ onNavigateCategory, onSelectProduct }: HomeViewProps) => {
  const { categories, c, ed, heroBanner } = useSite();
  const { addItem, openCartDrawer } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.catalog
      .getProducts()
      .then((data) => {
        if (mounted) {
          setProducts(data);
          setLoadingProducts(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingProducts(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddToCart = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (product.stock <= 0) return;
    setAddingId(product.id);
    try {
      const defaultVariant = product.variants?.[0] || 'Padrão';
      const success = await addItem(product.id, defaultVariant, 1);
      if (success) {
        openCartDrawer();
      }
    } finally {
      setTimeout(() => setAddingId(null), 1000);
    }
  };

  const formatBRL = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  // Apple-style categories presentation
  const categoryCards = [
    {
      title: 'Anéis',
      slug: 'aneis',
      image: '/images/category-aneis.jpg',
    },
    {
      title: 'Colares',
      slug: 'colares',
      image: '/images/category-colares.jpg',
    },
    {
      title: 'Brincos',
      slug: 'brincos',
      image: '/images/category-brincos-apple.jpg',
    },
    {
      title: 'Pulseiras',
      slug: 'pulseiras',
      image: '/images/category-pulseiras-apple.jpg',
    },
  ];

  return (
    <div className={styles.homeContainer}>
      {/* 1. HERO EDITORIAL APPLE-STYLE */}
      <section
        className={styles.heroSection}
        style={{ backgroundImage: `url(/images/hero-apple-editorial.jpg)` }}
      >
        <div className={styles.heroOverlay} />
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>
              {heroBanner?.badge || 'COLEÇÃO ESSÊNCIA'}
            </span>
            <h1 className={styles.heroTitle}>
              {heroBanner?.title || 'Brilho que atravessa o tempo.'}
            </h1>
            <p className={styles.heroSubtitle}>
              {heroBanner?.subtitle ||
                'Joias que unem elegância, autenticidade e o que realmente importa.'}
            </p>
            <div className={styles.heroActions}>
              <button
                onClick={() => onNavigateCategory(categories[0]?.slug || 'aneis')}
                className={styles.heroCtaBtn}
                id="hero-cta-btn"
              >
                <span>{heroBanner?.cta_text || 'Descobrir coleção'}</span>
                <ArrowRight size={16} strokeWidth={1.4} />
              </button>
            </div>
          </div>
          <div className={styles.heroScrollIndicator}>
            <span>Role para explorar</span>
            <span className={styles.arrowDown}>↓</span>
          </div>
        </div>
      </section>

      {/* 2. EXPLORE POR CATEGORIA */}
      <section className={styles.categoriesSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>ENCONTRE SUA PRÓXIMA JOIA</span>
          <h2 className={styles.sectionTitle}>Explore por categoria</h2>
        </div>

        <div className={styles.categoriesGrid}>
          {categoryCards.map((cat) => (
            <div
              key={cat.slug}
              className={styles.categoryCard}
              onClick={() => onNavigateCategory(cat.slug)}
            >
              <div className={styles.categoryImageWrapper}>
                <img src={cat.image} alt={cat.title} className={styles.categoryImage} />
              </div>
              <div className={styles.categoryFooter}>
                <span className={styles.categoryName}>{cat.title}</span>
                <span className={styles.categoryArrow}>→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. COLEÇÃO EM DESTAQUE (BANNER ESCURO PREMIUM) */}
      <section className={styles.featuredCollectionSection}>
        <div className={styles.featuredGrid}>
          <div className={styles.featuredContent}>
            <span className={styles.featuredBadge}>EDIÇÃO ESPECIAL</span>
            <h2 className={styles.featuredTitle}>O luxo nos detalhes.</h2>
            <p className={styles.featuredDescription}>
              Coleção exclusiva, com peças selecionadas para momentos inesquecíveis. Forjadas com a mais alta precisão da joalheria contemporânea.
            </p>
            <button
              onClick={() => onNavigateCategory('aneis')}
              className={styles.featuredBtn}
            >
              <span>Ver coleção</span>
              <ArrowRight size={16} strokeWidth={1.4} />
            </button>
          </div>
          <div className={styles.featuredImageCol}>
            <img
              src="/images/collection-featured-ring.jpg"
              alt="Coleção Especial Luce D'Oro"
              className={styles.featuredImage}
            />
          </div>
        </div>
      </section>

      {/* 4. VITRINE DE PRODUTOS REAIS (PEÇAS QUE ENCANTAM) */}
      <section className={styles.showcaseSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>ALTA JOALHERIA</span>
          <h2 className={styles.sectionTitle}>Peças que encantam</h2>
        </div>

        {loadingProducts ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p>Carregando seleção de joias...</p>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {products.map((product) => (
              <div
                key={product.id}
                className={styles.productCard}
                onClick={() => onSelectProduct(product)}
              >
                <div className={styles.productImageWrapper}>
                  <img
                    src={product.image_primary || '/images/hero-editorial.jpg'}
                    alt={product.name}
                    className={styles.productImage}
                  />
                  <div className={styles.cardHoverOverlay}>
                    <button
                      className={styles.quickViewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(product);
                      }}
                      title="Ver detalhes da joia"
                    >
                      <Eye size={16} />
                      <span>Ver Joia</span>
                    </button>
                    {product.stock > 0 && (
                      <button
                        className={`${styles.quickAddBtn} ${
                          addingId === product.id ? styles.quickAddSuccess : ''
                        }`}
                        onClick={(e) => handleAddToCart(e, product)}
                        title="Adicionar à sacola"
                      >
                        {addingId === product.id ? (
                          <>
                            <Check size={16} />
                            <span>Adicionado</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={16} />
                            <span>Adicionar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {product.stock <= 0 && (
                    <span className={styles.soldOutBadge}>Esgotado</span>
                  )}
                </div>

                <div className={styles.productInfo}>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <div className={styles.productPriceRow}>
                    <span className={styles.productPrice}>{formatBRL(product.price)}</span>
                    {product.old_price && product.old_price > product.price && (
                      <span className={styles.productOldPrice}>
                        {formatBRL(product.old_price)}
                      </span>
                    )}
                  </div>
                  <div className={styles.stockStatus}>
                    {product.stock > 0 ? (
                      <span className={styles.inStock}>
                        <span className={styles.stockDot} />
                        Disponível em estoque ({product.stock} un.)
                      </span>
                    ) : (
                      <span className={styles.outOfStock}>Indisponível no momento</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. SEÇÃO INSTITUCIONAL / EDITORIAL (MAIS QUE JOIAS, VERDADEIRAS HISTÓRIAS) */}
      <section id="historia-da-marca" className={styles.storySection}>
        <div className={styles.storyContainer}>
          <div className={styles.storyImageCol}>
            <img
              src="/images/story-necklace-model.jpg"
              alt="Luce D'Oro editorial"
              className={styles.storyImage}
            />
          </div>

          <div className={styles.storyContentCol}>
            <span className={styles.storyEyebrow} {...ed('story_tag')}>
              {c('story_tag') || 'NOSSAS COLEÇÕES'}
            </span>
            <h2 className={styles.storyTitle} {...ed('story_title')}>
              {c('story_title') || 'Mais que joias, verdadeiras histórias.'}
            </h2>
            <p className={styles.storyLead} {...ed('story_p1')}>
              {c('story_p1') ||
                'Cada peça da Luce D’Oro é criada para celebrar os seus momentos mais especiais. Com design autoral, materiais nobres e a sofisticação que você merece.'}
            </p>
            <p className={styles.storyDetail} {...ed('story_p2')}>
              {c('story_p2') ||
                'Joalheria feita com propósito, paixão e atenção minuciosa aos detalhes.'}
            </p>

            <div className={styles.storyActions}>
              <button
                onClick={() => onNavigateCategory(categories[0]?.slug || 'aneis')}
                className={styles.storyBtn}
              >
                <span>Conheça nossas coleções</span>
                <ArrowRight size={16} strokeWidth={1.4} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAIXA DE CONFIANÇA */}
      <section className={styles.trustStrip}>
        <div className={styles.trustContainer}>
          <div className={styles.trustRow}>
            {[
              {
                Icon: Gem,
                t: 'trust1_title',
                d: 'trust1_desc',
                dt: 'Ouro Nobre 18k',
                dd: 'Autenticidade e pureza comprovadas',
              },
              {
                Icon: ShieldCheck,
                t: 'trust2_title',
                d: 'trust2_desc',
                dt: 'Garantia Eterna',
                dd: 'Certificado oficial Luce D’Oro',
              },
              {
                Icon: Truck,
                t: 'trust3_title',
                d: 'trust3_desc',
                dt: 'Envio Assegurado',
                dd: 'Entrega rápida e rastreada em todo o Brasil',
              },
              {
                Icon: Sparkles,
                t: 'trust4_title',
                d: 'trust4_desc',
                dt: 'Design Exclusivo',
                dd: 'Criações atemporais e acabamento feito à mão',
              },
            ].map(({ Icon, t, d, dt, dd }) => (
              <div key={t} className={styles.trustCell}>
                <div className={styles.trustIconWrapper}>
                  <Icon size={24} strokeWidth={1.3} />
                </div>
                <h3 className={styles.trustCellTitle}>{c(t) || dt}</h3>
                <p className={styles.trustCellDesc}>{c(d) || dd}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
