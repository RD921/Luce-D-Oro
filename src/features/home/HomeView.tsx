import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Award, Truck, RefreshCw, Gem, Clock } from 'lucide-react';
import { api, type Product } from '../../services/api';
import { ProductCard } from '../catalog/ProductCard';
import { useSite } from '../../context/SiteContext';
import styles from './HomeView.module.css';

interface HomeViewProps {
  onNavigateCategory: (slug: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const HomeView = ({ onNavigateCategory, onSelectProduct }: HomeViewProps) => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const { categories, c, heroBanner } = useSite();

  // Faixa principal: o primeiro banner ativo do painel (Banners). Sem banner, mostra o texto original.
  const hero = {
    pill: heroBanner?.badge || 'ALTA JOALHERIA CONTEMPORÂNEA',
    title: heroBanner?.title || 'Detalhes que contam a sua história.',
    subtitle: heroBanner?.subtitle ?? 'Joias forjadas em ouro nobre 18k com acabamento primoroso. O encontro harmonioso entre o luxo discreto e a autenticidade contemporânea.',
    cta: heroBanner?.cta_text || 'Descubra a coleção',
    image: heroBanner?.image_desktop || '/images/hero-luce-d-oro.png',
  };

  const handleHeroCta = () => {
    const link = (heroBanner?.cta_link || '').trim();
    if (/^https:\/\//.test(link)) window.location.href = link;
    else if (link.startsWith('#') && link.length > 1) onNavigateCategory(link.slice(1).toLowerCase());
    else onNavigateCategory(categories[0]?.slug || 'pulseiras');
  };

  useEffect(() => {
    api.catalog
      .getProducts({ featured: true })
      .then((data) => setFeaturedProducts(data.slice(0, 3)))
      .catch(() => setFeaturedProducts([]));
  }, []);

  return (
    <div className={styles.homeContainer}>
      {/* SEÇÃO 1: HERO PRINCIPAL EDITORIAL */}
      <section className={styles.heroSection}>
        <div className="container">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.heroPill}>
                <Sparkles size={13} color="#B89758" />
                <span>{hero.pill}</span>
              </div>

              <h1 className={styles.heroTitle}>
                {hero.title}
              </h1>

              <p className={styles.heroSubtitle}>
                {hero.subtitle}
              </p>

              <div className={styles.heroCtaRow}>
                <button
                  onClick={handleHeroCta}
                  className={`btn-primary ${styles.heroCta}`}
                  id="hero-cta-btn"
                >
                  <span>{hero.cta}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div className={styles.heroVisualCol}>
              <div className={styles.heroImageWrapper}>
                <img
                  src={hero.image}
                  alt="Luce D'Oro Joalheria Contemporânea"
                  className={styles.heroBrandImage}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: CATEGORIAS EM DESTAQUE */}
      <section className={styles.categoriesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCategoryTag}>{c('collections_tag')}</span>
            <h2 className={styles.sectionTitle}>{c('collections_title')}</h2>
            <div className={styles.goldDivider} />
          </div>

          <div className={styles.categoriesGrid}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={styles.categoryCard}
                onClick={() => onNavigateCategory(cat.slug)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.categoryImageWrapper}>
                  <img
                    src={cat.image_url || '/images/hero-editorial.jpg'}
                    alt={`Coleção de ${cat.name} em Ouro 18k`}
                    className={styles.categoryImage}
                  />
                  <div className={styles.categoryCardOverlay} />
                </div>
                <div className={styles.categoryInfo}>
                  <span className={styles.categorySub}>EXPLORAR</span>
                  <h3 className={styles.categoryTitle}>{cat.name}</h3>
                  <span className={styles.categoryLink}>
                    <span>Ver coleção</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 3: PRODUTOS EM DESTAQUE */}
      <section className={styles.featuredSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCategoryTag}>{c('featured_tag')}</span>
            <h2 className={styles.sectionTitle}>{c('featured_title')}</h2>
            <p className={styles.sectionDesc}>
              Uma curadoria de peças que sintetizam o ápice do design refinado e da excelência artesanal.
            </p>
          </div>

          <div className={styles.featuredGrid}>
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 4: QUALIDADE DOS MATERIAIS */}
      <section className={styles.materialsSection}>
        <div className="container">
          <div className={styles.materialsGrid}>
            <div className={styles.materialsImageCol}>
              <div className={styles.materialsImageWrapper}>
                <img
                  src={c('materials_image')}
                  alt="Detalhe macro de fecho gaveta em ouro 18k e ourivesaria artesanal"
                  className={styles.materialsImage}
                />
                <div className={styles.materialsPill}>
                  <Award size={14} color="#B89758" />
                  <span>{c('materials_pill')}</span>
                </div>
              </div>
            </div>

            <div className={styles.materialsTextCol}>
              <span className={styles.sectionCategoryTag}>{c('materials_tag')}</span>
              <h2 className={styles.materialsTitle}>{c('materials_title')}</h2>
              <p className={styles.materialsLead}>
                {c('materials_lead')}
              </p>

              <div className={styles.specsList}>
                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <Gem size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>{c('spec1_title')}</h4>
                    <p className={styles.specDesc}>{c('spec1_desc')}</p>
                  </div>
                </div>

                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <ShieldCheck size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>{c('spec2_title')}</h4>
                    <p className={styles.specDesc}>{c('spec2_desc')}</p>
                  </div>
                </div>

                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <Clock size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>{c('spec3_title')}</h4>
                    <p className={styles.specDesc}>{c('spec3_desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 5: HISTÓRIA DA MARCA */}
      <section className={styles.brandStorySection}>
        <div className="container">
          <div className={styles.storyCard}>
            <span className={styles.storyTag}>{c('story_tag')}</span>
            <h2 className={styles.storyTitle}>{c('story_title')}</h2>
            <p className={styles.storyParagraph}>
              {c('story_p1')}
            </p>
            <p className={styles.storyParagraphSecondary}>
              {c('story_p2')}
            </p>
            <div className={styles.signature}>
              <img src="/images/logo-header.png" alt="Luce D'Oro" className={styles.signatureLogo} />
              <span className={styles.signatureText}>{c('story_signature')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 6: CONFIANÇA E ATENDIMENTO CONCIERGE */}
      <section className={styles.trustSection}>
        <div className="container">
          <div className={styles.trustGrid}>
            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <Truck size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>{c('trust1_title')}</h3>
              <p className={styles.trustDesc}>
                {c('trust1_desc')}
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <Award size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>{c('trust2_title')}</h3>
              <p className={styles.trustDesc}>
                {c('trust2_desc')}
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <RefreshCw size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>{c('trust3_title')}</h3>
              <p className={styles.trustDesc}>
                {c('trust3_desc')}
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <ShieldCheck size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>{c('trust4_title')}</h3>
              <p className={styles.trustDesc}>
                {c('trust4_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
