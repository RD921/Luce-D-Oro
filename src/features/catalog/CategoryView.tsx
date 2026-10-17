import { useState, useEffect } from 'react';
import { ArrowUpDown, Sparkles, Loader2 } from 'lucide-react';
import { api, type Product } from '../../services/api';
import { ProductCard } from './ProductCard';
import { useSite } from '../../context/SiteContext';
import styles from './CategoryView.module.css';

interface CategoryViewProps {
  categorySlug: string;
  onSelectProduct: (product: Product) => void;
}

export const CategoryView = ({ categorySlug, onSelectProduct }: CategoryViewProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [materialFilter, setMaterialFilter] = useState<string>('all');

  const { categories } = useSite();
  const categoriaAtual = categories.find((c) => c.slug === categorySlug);

  const currentMeta = categoriaAtual
    ? {
        title: categoriaAtual.name,
        subtitle: 'COLEÇÃO PERMANENTE',
        description: categoriaAtual.description || "Explore o catálogo exclusivo Luce D'Oro e descubra joias criadas com matérias-primas nobres e rigor artesanal.",
        banner: categoriaAtual.image_url || '/images/hero-editorial.jpg',
      }
    : {
        title: 'Nossa Coleção',
        subtitle: 'JOALHERIA CONTEMPORÂNEA',
        description: "Explore o catálogo exclusivo Luce D'Oro e descubra joias criadas com matérias-primas nobres e rigor artesanal.",
        banner: '/images/hero-editorial.jpg',
      };

  useEffect(() => {
    setLoading(true);
    api.catalog
      .getProducts({
        category: categorySlug,
        sort: sortBy,
      })
      .then((data) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [categorySlug, sortBy]);

  const filteredProducts = products.filter((p) => {
    if (materialFilter === 'zirconia') {
      return p.materials.toLowerCase().includes('zircônia');
    }
    return true;
  });

  return (
    <div className={styles.categoryPage}>
      {/* Editorial Category Header */}
      <section className={styles.editorialBanner}>
        <div className={styles.bannerBackground} style={{ backgroundImage: `url(${currentMeta.banner})` }}>
          <div className={styles.bannerOverlay} />
        </div>
        <div className="container">
          <div className={styles.bannerContent}>
            <div className={styles.goldBadge}>
              <Sparkles size={12} color="#B89758" />
              <span>{currentMeta.subtitle}</span>
            </div>
            <h1 className={styles.bannerTitle}>{currentMeta.title}</h1>
            <p className={styles.bannerDesc}>{currentMeta.description}</p>
          </div>
        </div>
      </section>

      {/* Filter and Sorting Toolbar */}
      <div className={styles.toolbarWrapper}>
        <div className="container">
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.productCount}>
                <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'joia encontrada' : 'joias encontradas'}
              </span>

              <div className={styles.filterPills}>
                <button
                  onClick={() => setMaterialFilter('all')}
                  className={`${styles.filterPill} ${materialFilter === 'all' ? styles.filterPillActive : ''}`}
                >
                  Todas as Peças
                </button>
                <button
                  onClick={() => setMaterialFilter('zirconia')}
                  className={`${styles.filterPill} ${materialFilter === 'zirconia' ? styles.filterPillActive : ''}`}
                >
                  Cravejadas com Zircônia
                </button>
              </div>
            </div>

            <div className={styles.toolbarRight}>
              <div className={styles.sortSelectWrapper}>
                <ArrowUpDown size={14} color="#767676" />
                <label htmlFor="catalog-sort" className="sr-only">Ordenar por</label>
                <select
                  id="catalog-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={styles.sortSelect}
                >
                  <option value="featured">Destaques da Marca</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="newest">Mais Recentes</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <main className="container" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div className={styles.loadingBox}>
            <Loader2 size={32} className={styles.spinner} />
            <p>Carregando joias da coleção...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyResults}>
            <p className={styles.emptyTitle}>Nenhuma peça encontrada</p>
            <p className={styles.emptySubtitle}>Tente remover os filtros para visualizar outras criações da coleção.</p>
            <button onClick={() => setMaterialFilter('all')} className="btn-secondary" style={{ marginTop: '1rem' }}>
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
