import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Truck, Gem } from 'lucide-react';
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
      {/* HERO EDITORIAL: foto em largura total, texto à esquerda */}
      <section className={styles.heroSection} style={{ backgroundImage: `url(${hero.image})` }}>
        <div className={styles.heroShade} />
        <div className="container">
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>{hero.pill}</span>
            <h1 className={styles.heroTitle}>{hero.title}</h1>
            <p className={styles.heroSubtitle}>{hero.subtitle}</p>
            <button onClick={handleHeroCta} className={styles.linkCta} id="hero-cta-btn">
              <span>{hero.cta}</span>
              <ArrowRight size={16} strokeWidth={1.2} />
            </button>
          </div>
        </div>
      </section>

      {/* PROCESSO / MATERIAIS */}
      <section className={styles.processSection}>
        <div className="container">
          <div className={styles.processGrid}>
            <div className={styles.processText}>
              <span className={styles.eyebrow}>{c('materials_tag')}</span>
              <h2 className={styles.processTitle}>{c('materials_title')}</h2>
              <p className={styles.processLead}>{c('materials_lead')}</p>
              <button onClick={() => onNavigateCategory(categories[0]?.slug || 'pulseiras')} className={styles.linkCta}>
                <span>Ver coleções</span>
                <ArrowRight size={16} strokeWidth={1.2} />
              </button>
            </div>
            <div className={styles.processImage}>
              <img src={c('materials_image')} alt="Ourivesaria artesanal" />
              <span className={styles.processCaption}>{c('materials_pill')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAIXA DE CONFIANÇA */}
      <section className={styles.trustStrip}>
        <div className="container">
          <div className={styles.trustRow}>
            {[
              { Icon: Gem, t: 'trust1_title', d: 'trust1_desc' },
              { Icon: ShieldCheck, t: 'trust2_title', d: 'trust2_desc' },
              { Icon: Truck, t: 'trust3_title', d: 'trust3_desc' },
              { Icon: Sparkles, t: 'trust4_title', d: 'trust4_desc' },
            ].map(({ Icon, t, d }) => (
              <div key={t} className={styles.trustCell}>
                <Icon size={22} strokeWidth={1.2} />
                <h3>{c(t)}</h3>
                <p>{c(d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COLEÇÕES */}
      <section className={styles.collectionsSection}>
        <div className="container">
          <div className={styles.collectionsHead}>
            <div>
              <span className={styles.eyebrow}>{c('collections_tag')}</span>
              <h2 className={styles.collectionsTitle}>{c('collections_title')}</h2>
            </div>
          </div>
          <div className={styles.collectionsGrid}>
            {categories.map((cat) => (
              <button key={cat.id} className={styles.collectionCard} onClick={() => onNavigateCategory(cat.slug)}>
                <img src={cat.image_url || '/images/hero-editorial.jpg'} alt={cat.name} />
                <span className={styles.collectionShade} />
                <span className={styles.collectionInfo}>
                  <span className={styles.collectionName}>{cat.name}</span>
                  <span className={styles.collectionLink}>Conferir produto <ArrowRight size={13} strokeWidth={1.2} /></span>
                </span>
              </button>
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

    </div>
  );
};
