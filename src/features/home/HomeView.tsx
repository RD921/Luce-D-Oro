import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Award, Truck, RefreshCw, Gem, Clock } from 'lucide-react';
import { api, type Product } from '../../services/api';
import { ProductCard } from '../catalog/ProductCard';
import styles from './HomeView.module.css';

interface HomeViewProps {
  onNavigateCategory: (slug: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const HomeView = ({ onNavigateCategory, onSelectProduct }: HomeViewProps) => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

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
        <div className={styles.heroBackground}>
          <img
            src="/images/hero-editorial.jpg"
            alt="Composição de joias finas em ouro 18k Luce D'Oro sobre seda marfim"
            className={styles.heroImage}
          />
          <div className={styles.heroGradient} />
        </div>

        <div className="container">
          <div className={styles.heroContent}>
            <div className={styles.heroPill}>
              <Sparkles size={13} color="#B89758" />
              <span>ALTA JOALHERIA CONTEMPORÂNEA</span>
            </div>

            <h1 className={styles.heroTitle}>
              Detalhes que contam a sua história.
            </h1>

            <p className={styles.heroSubtitle}>
              Joias forjadas em ouro nobre 18k com acabamento primoroso. O encontro harmonioso entre o luxo discreto e a autenticidade contemporânea.
            </p>

            <div className={styles.heroCtaRow}>
              <button
                onClick={() => onNavigateCategory('pulseiras')}
                className={`btn-primary ${styles.heroCta}`}
                id="hero-cta-btn"
              >
                <span>Descubra a coleção</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: CATEGORIAS EM DESTAQUE */}
      <section className={styles.categoriesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCategoryTag}>UNIVERSO LUCE D'ORO</span>
            <h2 className={styles.sectionTitle}>Nossas Coleções</h2>
            <div className={styles.goldDivider} />
          </div>

          <div className={styles.categoriesGrid}>
            {/* Pulseiras */}
            <div
              className={styles.categoryCard}
              onClick={() => onNavigateCategory('pulseiras')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.categoryImageWrapper}>
                <img
                  src="/images/category-pulseiras.jpg"
                  alt="Coleção de Pulseiras em Ouro 18k"
                  className={styles.categoryImage}
                />
                <div className={styles.categoryCardOverlay} />
              </div>
              <div className={styles.categoryInfo}>
                <span className={styles.categorySub}>EXPLORAR</span>
                <h3 className={styles.categoryTitle}>Pulseiras</h3>
                <span className={styles.categoryLink}>
                  <span>Ver coleção</span>
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>

            {/* Correntes */}
            <div
              className={styles.categoryCard}
              onClick={() => onNavigateCategory('correntes')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.categoryImageWrapper}>
                <img
                  src="/images/category-correntes.jpg"
                  alt="Coleção de Correntes e Gargantilhas em Ouro 18k"
                  className={styles.categoryImage}
                />
                <div className={styles.categoryCardOverlay} />
              </div>
              <div className={styles.categoryInfo}>
                <span className={styles.categorySub}>EXPLORAR</span>
                <h3 className={styles.categoryTitle}>Correntes</h3>
                <span className={styles.categoryLink}>
                  <span>Ver coleção</span>
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>

            {/* Brincos */}
            <div
              className={styles.categoryCard}
              onClick={() => onNavigateCategory('brincos')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.categoryImageWrapper}>
                <img
                  src="/images/category-brincos.jpg"
                  alt="Coleção de Brincos e Argolas em Ouro 18k"
                  className={styles.categoryImage}
                />
                <div className={styles.categoryCardOverlay} />
              </div>
              <div className={styles.categoryInfo}>
                <span className={styles.categorySub}>EXPLORAR</span>
                <h3 className={styles.categoryTitle}>Brincos</h3>
                <span className={styles.categoryLink}>
                  <span>Ver coleção</span>
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3: PRODUTOS EM DESTAQUE */}
      <section className={styles.featuredSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCategoryTag}>SELEÇÃO EDITORIAL</span>
            <h2 className={styles.sectionTitle}>Joias em Destaque</h2>
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
                  src="/images/materials-macro.jpg"
                  alt="Detalhe macro de fecho gaveta em ouro 18k e ourivesaria artesanal"
                  className={styles.materialsImage}
                />
                <div className={styles.materialsPill}>
                  <Award size={14} color="#B89758" />
                  <span>Atelier de Ourivesaria</span>
                </div>
              </div>
            </div>

            <div className={styles.materialsTextCol}>
              <span className={styles.sectionCategoryTag}>RIGOR E MATÉRIA-PRIMA</span>
              <h2 className={styles.materialsTitle}>A Pureza do Ouro 18k e a Mestria do Acabamento</h2>
              <p className={styles.materialsLead}>
                Cada joia Luce D'Oro recebe 10 milésimos de Ouro 18k sobre liga nobre sem níquel, blindada com verniz nanocerâmico suíço que assegura brilho inalterado e toque aveludado na pele.
              </p>

              <div className={styles.specsList}>
                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <Gem size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>10 Milésimos de Ouro 18k</h4>
                    <p className={styles.specDesc}>Camada de altíssima espessura que confere a densidade e o tom caloroso do ouro puro.</p>
                  </div>
                </div>

                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <ShieldCheck size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>Verniz Suíço Nanotecnológico</h4>
                    <p className={styles.specDesc}>Proteção invisível contra oxidação e suor, 100% hipoalergênica e livre de níquel.</p>
                  </div>
                </div>

                <div className={styles.specItem}>
                  <div className={styles.specIcon}>
                    <Clock size={18} color="#B89758" />
                  </div>
                  <div>
                    <h4 className={styles.specTitle}>Garantia Vitalícia do Teor</h4>
                    <p className={styles.specDesc}>Certificado individual assinado com garantia total contra defeitos de fabricação.</p>
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
            <span className={styles.storyTag}>O MANIFESTO LUCE D'ORO</span>
            <h2 className={styles.storyTitle}>Luxo Silencioso, Elegância Eterna</h2>
            <p className={styles.storyParagraph}>
              Nascemos da convicção de que o verdadeiro luxo não precisa gritar para ser percebido. Ele reside no peso preciso de uma corrente que repousa sobre a pele, no clique perfeito de uma trava gaveta e no brilho dourado que atravessa gerações.
            </p>
            <p className={styles.storyParagraphSecondary}>
              A Luce D'Oro une a herança da ourivesaria clássica ao minimalismo da joalheria contemporânea, criando símbolos de afeto, conquista e identidade pessoal.
            </p>
            <div className={styles.signature}>
              <span className={styles.signatureMonogram}>CD</span>
              <span className={styles.signatureText}>Joalheria Contemporânea</span>
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
              <h3 className={styles.trustTitle}>Envio Seguro com Seguro Total</h3>
              <p className={styles.trustDesc}>
                Transporte monitorado com cobertura integral até as suas mãos. Frete cortesia para pedidos acima de R$ 500.
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <Award size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>Certificado de Garantia</h3>
              <p className={styles.trustDesc}>
                Todas as joias acompanham livreto numerado com certificado oficial de qualidade e autenticidade do ouro.
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <RefreshCw size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>Primeira Troca Cortesia</h3>
              <p className={styles.trustDesc}>
                Até 30 dias para experimentar suas peças com total tranquilidade no conforto de sua casa.
              </p>
            </div>

            <div className={styles.trustItem}>
              <div className={styles.trustIconCircle}>
                <ShieldCheck size={24} color="#B89758" />
              </div>
              <h3 className={styles.trustTitle}>Atendimento Concierge</h3>
              <p className={styles.trustDesc}>
                Especialistas à disposição via WhatsApp e e-mail para consultoria de estilos, medidas e presentes especiais.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
