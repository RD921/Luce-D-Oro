import { useState, useEffect } from 'react';
import { Image, X, Plus, Edit2, Trash2, Search, XCircle } from 'lucide-react';
import { useSite } from '../../../context/SiteContext';
import { api, type Product } from '../../../services/api';
import { fmt, UploadButton, ImageField } from './shared';
import { VariantsModal } from './VariantsModal';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: PRODUCTS
// ============================================================
export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [photosOf, setPhotosOf] = useState<Product | null>(null);
  const [variantsOf, setVariantsOf] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [verArquivados, setVerArquivados] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setProducts(await api.admin.getProducts()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    Boolean(p.is_archived) === verArquivados &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_id.toLowerCase().includes(search.toLowerCase()))
  );
  const qtdArquivados = products.filter(p => p.is_archived).length;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja arquivar o produto "${name}"? Ele não será exibido na loja.`)) return;
    try {
      await api.admin.deleteProduct(id);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const restaurar = async (p: Product) => {
    try { await api.admin.restoreProduct(p.id); await load(); } catch (e: any) { alert(e.message); }
  };
  const apagarDeVez = async (p: Product) => {
    if (!confirm(`Apagar "${p.name}" DE VEZ? Isso não tem volta.`)) return;
    try { await api.admin.deleteProductForever(p.id); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.filterRow}>
        <button className={`${styles.btnSmall} ${verArquivados ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setVerArquivados(v => !v)}>
          {verArquivados ? '← Voltar aos ativos' : `Arquivados (${qtdArquivados})`}
        </button>
        <Search size={14} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
        <input
          className={styles.searchInput}
          placeholder="Buscar produto ou categoria…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
          onClick={() => setCreating(true)}
        >
          <Plus size={13} /> Novo Produto
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loader}><div className={styles.spinner}/> Carregando…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Foto</th><th>Nome</th><th>Categoria</th>
                  <th>Preço</th><th>Estoque</th><th>Destaque</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className={styles.emptyState}>Nenhum produto encontrado.</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <img
                        src={p.image_primary}
                        alt={p.name}
                        className={styles.productImg}
                        style={{ cursor: 'pointer' }}
                        title="Clique para trocar as fotos"
                        onClick={() => setPhotosOf(p)}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                      />
                    </td>
                    <td>
                      <div className={styles.productName}>{p.name}</div>
                      <div className={styles.productSlug}>{p.slug}</div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{p.category_id}</td>
                    <td>
                      <div className={styles.price}>{fmt(p.price)}</div>
                      {p.old_price && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-dim)', textDecoration: 'line-through' }}>
                          {fmt(p.old_price)}
                        </div>
                      )}
                    </td>
                    <td className={p.stock === 0 ? styles.stockOut : p.stock <= 3 ? styles.stockLow : styles.stockOk}>
                      {p.stock}
                    </td>
                    <td>
                      {p.is_featured ? (
                        <span className={`${styles.tag} ${styles.tagGold}`}>★ Destaque</span>
                      ) : (
                        <span className={styles.tag}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btnIcon} title="Trocar fotos" onClick={() => setPhotosOf(p)}>
                          <Image size={13} />
                        </button>
                        <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} title="Variações e estoque de cada uma" onClick={() => setVariantsOf(p)}>
                          Variações{(p.variant_stock?.length ?? 0) > 0 ? ` (${p.variant_stock!.length})` : ''}
                        </button>
                        <button
                          className={styles.btnIcon}
                          title="Editar"
                          onClick={() => setEditing(p)}
                        >
                          <Edit2 size={13} />
                        </button>
                        {p.is_archived ? (
                          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => restaurar(p)}>Restaurar</button>
                        ) : (
                          <button
                            className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                            title="Arquivar (tira da loja, mantém o histórico)"
                            onClick={() => handleDelete(p.id, p.name)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ color: 'var(--adm-red)' }} title="Apagar de vez" onClick={() => apagarDeVez(p)}>Apagar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {variantsOf && <VariantsModal product={variantsOf} onClose={() => setVariantsOf(null)} onSaved={() => { setVariantsOf(null); load(); }} />}
      {photosOf && <PhotosModal product={photosOf} onClose={() => setPhotosOf(null)} onSaved={() => { setPhotosOf(null); load(); }} />}
      {(editing || creating) && (
        <ProductModal
          product={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </>
  );
}


// ---- Editor de fotos do produto ----
export function PhotosModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [principal, setPrincipal] = useState(product.image_primary);
  const [extras, setExtras] = useState<string[]>(product.images ?? []);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const todas = [principal, ...extras].filter(Boolean);
  const virarPrincipal = (u: string) => { setExtras(e => [principal, ...e.filter(x => x !== u)].filter(Boolean)); setPrincipal(u); };
  const remover = (u: string) => {
    if (u === principal) {
      if (extras.length === 0) { setError('O produto precisa de pelo menos uma foto. Envie outra antes de remover esta.'); return; }
      setPrincipal(extras[0]); setExtras(extras.slice(1));
    } else setExtras(e => e.filter(x => x !== u));
    setError('');
  };
  const adicionar = (u: string) => {
    if (!u) return;
    if (!principal) setPrincipal(u);
    else setExtras(e => (e.includes(u) || u === principal ? e : [...e, u]));
  };
  const trocarPrincipal = (u: string) => {
    // troca a foto principal pela nova; a antiga sai da galeria
    setPrincipal(u);
    setExtras(e => e.filter(x => x !== u));
  };

  const salvar = async () => {
    if (!principal) { setError('Escolha a foto principal.'); return; }
    setSaving(true); setError('');
    try { await api.admin.setProductPhotos(product.id, principal, extras); onSaved(); }
    catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Fotos — {product.name}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: '1rem' }}>
            {todas.map((u, i) => (
              <div key={u} style={{ border: `1px solid ${u === principal ? 'var(--adm-gold)' : 'var(--adm-border-md)'}`, borderRadius: 6, overflow: 'hidden', background: 'var(--adm-bg-input)' }}>
                <img src={u} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.65rem', color: u === principal ? 'var(--adm-gold)' : 'var(--adm-text-muted)' }}>{u === principal ? '★ Principal' : `Foto ${i + 1}`}</span>
                  {u !== principal && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => virarPrincipal(u)}>Tornar principal</button>}
                  <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ color: 'var(--adm-red)' }} onClick={() => remover(u)}>Remover</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <UploadButton label="Adicionar foto" onUploaded={adicionar} />
            <UploadButton label="Trocar a principal" onUploaded={trocarPrincipal} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className={styles.formInput} placeholder="…ou cole o endereço (link) de uma imagem" value={url} onChange={e => setUrl(e.target.value)} />
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={!url.trim()} onClick={() => { adicionar(url.trim()); setUrl(''); }}>Adicionar</button>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar fotos'}</button>
        </div>
      </div>
    </div>
  );
}


// Product form modal
export function ProductModal({ product, onClose, onSaved }: { product?: Product; onClose: () => void; onSaved: () => void }) {
  const { categories } = useSite();
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name || '',
    slug: product?.slug || '',
    category_id: product?.category_id || categories[0]?.id || 'pulseiras',
    price: product?.price ?? 0,
    old_price: product?.old_price ?? '',
    cost_price: product?.cost_price ?? '',
    description: product?.description || '',
    materials: product?.materials || '',
    care_instructions: product?.care_instructions || '',
    dimensions: product?.dimensions || '',
    warranty: product?.warranty || '12 meses',
    stock: product?.stock ?? 0,
    is_featured: product?.is_featured ? true : false,
    image_primary: product?.image_primary || '',
    images: product?.images?.join('\n') || '',
    variants: product?.variants?.join('\n') || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Auto-slug from name
  const handleNameChange = (v: string) => {
    set('name', v);
    if (isNew) {
      set('slug', v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.image_primary) {
      setError('Nome, preço e imagem principal são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<Product> = {
        ...form,
        price: Number(form.price),
        old_price: form.old_price !== '' ? Number(form.old_price) : null,
        cost_price: form.cost_price !== '' ? Number(form.cost_price) : undefined,
        stock: Number(form.stock),
        is_featured: form.is_featured,
        images: form.images.split('\n').map(s => s.trim()).filter(Boolean),
        variants: form.variants.split('\n').map(s => s.trim()).filter(Boolean),
      };
      if (isNew) await api.admin.createProduct(payload);
      else await api.admin.updateProduct(product!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Novo Produto' : `Editar: ${product?.name}`}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && (
            <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}>
              <XCircle size={14} />
              <div className={styles.alertMsg}>{error}</div>
            </div>
          )}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome do Produto *</label>
              <input className={styles.formInput} value={form.name} onChange={e => handleNameChange(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Slug (URL)</label>
              <input className={styles.formInput} value={form.slug} onChange={e => set('slug', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria *</label>
              <select className={styles.formInput} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {!categories.some(c => c.id === form.category_id) && form.category_id && <option value={form.category_id}>{form.category_id} (desativada)</option>}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Estoque</label>
              <input type="number" className={styles.formInput} value={form.stock} onChange={e => set('stock', e.target.value)} min={0} disabled={(product?.variant_stock?.length ?? 0) > 0} />
              {(product?.variant_stock?.length ?? 0) > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Soma das variações. Altere em “Variações”.</span>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preço de Venda (R$) *</label>
              <input type="number" className={styles.formInput} value={form.price} onChange={e => set('price', e.target.value)} step="0.01" min={0} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preço Antigo / De (R$)</label>
              <input type="number" className={styles.formInput} value={form.old_price} onChange={e => set('old_price', e.target.value)} step="0.01" min={0} placeholder="Opcional" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Custo (R$)</label>
              <input type="number" className={styles.formInput} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} step="0.01" min={0} placeholder="Opcional" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Garantia</label>
              <input className={styles.formInput} value={form.warranty} onChange={e => set('warranty', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Principal *</label>
              <ImageField value={form.image_primary} onChange={v => set('image_primary', v)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagens adicionais (uma por linha)</label>
              <textarea className={styles.formInput} rows={3} value={form.images} onChange={e => set('images', e.target.value)} />
              <div style={{ marginTop: 6 }}>
                <UploadButton label="Adicionar foto do computador" onUploaded={url => set('images', form.images ? form.images.replace(/\s+$/, '') + '\n' + url : url)} />
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Variantes disponíveis (uma por linha)</label>
              <textarea className={styles.formInput} rows={3} value={form.variants} onChange={e => set('variants', e.target.value)} disabled={(product?.variant_stock?.length ?? 0) > 0} placeholder="Ex: 14K Ouro Amarelo&#10;18K Ouro Rosé" />
              <span style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Para controlar o estoque de cada variação, use o botão “Variações” na lista de produtos.</span>
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea className={styles.formInput} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Materiais</label>
              <textarea className={styles.formInput} rows={2} value={form.materials} onChange={e => set('materials', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cuidados</label>
              <textarea className={styles.formInput} rows={2} value={form.care_instructions} onChange={e => set('care_instructions', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Dimensões</label>
              <input className={styles.formInput} value={form.dimensions} onChange={e => set('dimensions', e.target.value)} placeholder="Ex: Comprimento 18cm" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formCheckbox}>
                <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
                Produto em destaque na home
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </div>
  );
}
