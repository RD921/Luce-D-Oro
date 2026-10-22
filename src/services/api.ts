// Luce D'Oro - API Client Service

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'customer' | string;
  isVerified?: boolean;
  isOwner?: boolean;
  isStaff?: boolean;
  areas?: Record<string, 'r' | 'rw'>;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order?: number;
  is_active?: number;
  product_count?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  price: number;
  old_price: number | null;
  cost_price?: number;
  is_archived?: number;
  description: string;
  materials: string;
  care_instructions: string;
  dimensions: string;
  warranty: string;
  stock: number;
  is_featured: boolean | number;
  image_primary: string;
  images: string[];
  variants: string[];
  variant_stock?: Array<{ title: string; stock: number }>;
  created_at?: string;
}

export interface CartItem {
  id: number;
  product_id: string;
  variant_title: string;
  quantity: number;
  name: string;
  price: number;
  image_primary: string;
  stock: number;
}

export interface CartResponse {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  total: number;
  freeShippingThreshold: number;
  freeShippingAvailable?: boolean;
  hasFreeShipping: boolean;
}

export interface OrderItem {
  id: number;
  product_id: string;
  product_name: string;
  variant_title: string;
  unit_price: number;
  quantity: number;
  image_url: string;
}

export interface Order {
  id: string;
  user_id?: number;
  total: number;
  status: string;
  shipping_address: string;
  payment_method: string;
  shipping_method?: string | null;
  shipping_cost?: number;
  coupon_discount?: number;
  payment_discount?: number;
  tracking_code?: string;
  internal_notes?: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  items: OrderItem[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  cta_text?: string;
  cta_link?: string;
  image_desktop: string;
  image_mobile?: string;
  is_active: number;
  display_order: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed' | string;
  discount_value: number;
  min_spend: number;
  is_active: number;
  usage_count: number;
  expires_at?: string | null;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: string;
  product_name?: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  user_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export interface AdminAlert {
  id: string;
  type: 'warning' | 'info' | 'danger';
  title: string;
  message: string;
  link?: string;
}

export type StockProduct = Omit<Product, 'variants'> & { variants: Array<{ title: string; stock: number }> };

export interface AdminShipping { id: string; name: string; description: string; price: number; days_min: number; days_max: number; free_above: number | null; is_active: number; display_order: number }
export interface AdminPayment { id: string; name: string; description: string; kind: string; discount_percent: number; max_installments: number; is_active: number; display_order: number }

export interface DashboardInsights {
  periodo: string;
  dias: number;
  serie: Array<{ dia: string; pedidos: number; receita: number }>;
  anterior: { pedidos: number; receita: number } | null;
  porCategoria: Array<{ nome: string; receita: number; itens: number }>;
  pagamentos: Array<{ metodo: string; pedidos: number; receita: number }>;
  novosClientes: number;
  aguardando: number;
  estoque: { venda: number; custo: number; pecas: number };
}

export interface AdminDashboardData {
  period: string;
  ordersCount: number;
  revenue: number;
  averageTicket: number;
  statusCounts: Record<string, number>;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: any[];
  topProducts: any[];
  recentOrders: any[];
  activeCoupons: number;
  totalCustomers: number;
}

// Token helper for cross-origin or local backup
const TOKEN_KEY = 'cd_de_ouro_session_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = tokenStorage.get();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // sends cookies
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Ocorreu um erro na requisição. Tente novamente.');
  }

  return data as T;
}

export const api = {
  auth: {
    validateEmail: (email: string) =>
      request<{ valid: boolean }>('/api/auth/validate-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    login: async (email: string, password: string) => {
      const res = await request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.token) {
        tokenStorage.set(res.token);
      }
      return res;
    },

    register: async (payload: { name: string; email: string; password: string; confirmPassword: string }) => {
      const res = await request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.token) {
        tokenStorage.set(res.token);
      }
      return res;
    },

    me: () => request<{ user: User }>('/api/auth/me'),

    logout: async () => {
      try {
        await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
      } finally {
        tokenStorage.clear();
      }
    },

    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  },

  catalog: {
    getCategories: () => request<Category[]>('/api/catalog/categories'),

    getProducts: (params?: { category?: string; sort?: string; search?: string; featured?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.sort) query.append('sort', params.sort);
      if (params?.search) query.append('search', params.search);
      if (params?.featured) query.append('featured', 'true');
      return request<Product[]>(`/api/catalog/products?${query.toString()}`);
    },

    getProductBySlug: (slug: string) => request<Product>(`/api/catalog/products/${slug}`),
  },

  cart: {
    getCart: () => request<CartResponse>('/api/cart'),

    addItem: (productId: string, variantTitle: string, quantity = 1) =>
      request<{ success: boolean; message: string }>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, variantTitle, quantity }),
      }),

    updateItem: (itemId: number, quantity: number) =>
      request<{ success: boolean }>(`/api/cart/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      }),

    removeItem: (itemId: number) =>
      request<{ success: boolean; message: string }>(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      }),
  },

  orders: {
    list: () => request<Order[]>('/api/orders'),

    create: (payload: { shippingAddress: string; paymentMethod?: string; paymentMethodId?: string; installments?: number; shippingMethodId?: string; couponCode?: string }) =>
      request<{ success: boolean; orderId: string; total: number; shippingCost?: number; paymentDiscount?: number; message: string }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  checkout: {
    options: (subtotal: number) =>
      request<{
        shipping: Array<{ id: string; name: string; description: string; prazo: string; basePrice: number; price: number; free: boolean; freeAbove: number | null }>;
        payments: Array<{ id: string; name: string; description: string; kind: string; discountPercent: number; maxInstallments: number }>;
      }>(`/api/checkout/options?subtotal=${encodeURIComponent(subtotal)}`),
  },

  banners: {
    list: () => request<Banner[]>('/api/banners'),
  },

  settings: {
    get: () => request<Record<string, string>>('/api/settings'),
  },

  content: {
    get: () => request<Record<string, string>>('/api/content'),
  },

  coupons: {
    validate: (code: string, cartTotal: number) =>
      request<{
        valid: boolean;
        code: string;
        discountType: string;
        discountValue: number;
        discountAmount: number;
      }>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, cartTotal }),
      }),
  },

  // EXCLUSIVE OWNER ADMIN ENDPOINTS
  admin: {
    getSetupStatus: () =>
      request<{
        authorizedOwnerEmail: string;
        authorizedOwnerName: string;
        isRegistered: boolean;
        isInitialized: boolean;
        requiresVerification: boolean;
      }>('/api/admin/setup/status'),

    verifyOwner: (setupKey: string) =>
      request<{ success: boolean; message: string; role: string }>('/api/admin/setup/verify-owner', {
        method: 'POST',
        body: JSON.stringify({ setupKey }),
      }),

    getDashboard: (period = 'all') =>
      request<AdminDashboardData>(`/api/admin/dashboard?period=${period}`),

    getProducts: () => request<Product[]>('/api/admin/products'),

    createProduct: (data: Partial<Product>) =>
      request<{ success: boolean; id: string; message: string }>('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateProduct: (id: string, data: Partial<Product>) =>
      request<{ success: boolean; message: string }>(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteProduct: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/products/${id}`, {
        method: 'DELETE',
      }),

    getOrders: (params?: { status?: string; q?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.q) query.append('q', params.q);
      return request<Order[]>(`/api/admin/orders?${query.toString()}`);
    },

    updateOrderStatus: (id: string, payload: { status: string; trackingCode?: string; internalNotes?: string }) =>
      request<{ success: boolean; message: string }>(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    getStock: () => request<{ products: StockProduct[]; movements: StockMovement[] }>('/api/admin/stock'),

    adjustStock: (productId: string, quantityChange: number, reason: string) =>
      request<{ success: boolean; message: string; newStock: number }>('/api/admin/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({ productId, quantityChange, reason }),
      }),

    getBanners: () => request<Banner[]>('/api/admin/banners'),

    createBanner: (data: Partial<Banner>) =>
      request<{ success: boolean; id: string; message: string }>('/api/admin/banners', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateBanner: (id: string, data: Partial<Banner>) =>
      request<{ success: boolean; message: string }>(`/api/admin/banners/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteBanner: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/banners/${id}`, {
        method: 'DELETE',
      }),

    getSettings: () => request<Record<string, string>>('/api/admin/settings'),

    updateSettings: (data: Record<string, string>) =>
      request<{ success: boolean; message: string }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getCoupons: () => request<Coupon[]>('/api/admin/coupons'),

    createCoupon: (data: Partial<Coupon>) =>
      request<{ success: boolean; id: string; message: string }>('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateCoupon: (id: string, data: Partial<Coupon>) =>
      request<{ success: boolean; message: string }>(`/api/admin/coupons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteCoupon: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
      }),

    getCustomers: () => request<any[]>('/api/admin/customers'),

    getCustomer: (id: number) =>
      request<{ cliente: any; resumo: { pedidos: number; gasto: number }; pedidos: any[] }>(`/api/admin/customers/${id}`),

    // ---- Equipe (somente proprietário) ----
    getTeam: () =>
      request<{
        membros: Array<{ id: number; name: string; email: string; role: string; created_at: string }>;
        papeis: Array<{ id: string; label: string; descricao: string; areas: Record<string, string> }>;
      }>('/api/admin/team'),
    addTeamMember: (email: string, role: string) =>
      request<{ success: boolean; message: string }>('/api/admin/team', { method: 'POST', body: JSON.stringify({ email, role }) }),
    setTeamRole: (id: number, role: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/team/${id}`, { method: 'PUT', body: JSON.stringify({ role }) }),
    removeTeamMember: (id: number) =>
      request<{ success: boolean; message: string }>(`/api/admin/team/${id}`, { method: 'DELETE' }),

    // ---- Conteúdo da loja (textos e imagens) ----
    getContent: () =>
      request<Array<{ key: string; label: string; group: string; type: 'text' | 'textarea' | 'image'; def: string; value: string; customized: boolean }>>('/api/admin/content'),

    updateContent: (values: Record<string, string>) =>
      request<{ success: boolean; message: string }>('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify({ values }),
      }),

    // ---- Categorias ----
    getCategories: () => request<Category[]>('/api/admin/categories'),

    createCategory: (data: Partial<Category>) =>
      request<{ success: boolean; id: string; message: string }>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateCategory: (id: string, data: Partial<Category>) =>
      request<{ success: boolean; message: string }>(`/api/admin/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteCategory: (id: string, moveTo?: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/categories/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`, {
        method: 'DELETE',
      }),

    reorderCategories: (ids: string[]) =>
      request<{ success: boolean; message: string }>('/api/admin/categories-order', { method: 'PUT', body: JSON.stringify({ ids }) }),

    // ---- Fotos, estoque exato, exclusão de produtos ----
    setProductPhotos: (id: string, image_primary: string, images: string[]) =>
      request<{ success: boolean; image_primary: string; images: string[]; message: string }>(`/api/admin/products/${id}/photos`, {
        method: 'PUT',
        body: JSON.stringify({ image_primary, images }),
      }),
    setStock: (productId: string, quantity: number, reason: string) =>
      request<{ success: boolean; newStock: number; message: string }>('/api/admin/stock/set', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity, reason }),
      }),
    restoreProduct: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/products/${id}/restore`, { method: 'POST' }),
    deleteProductForever: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/products/${id}/permanent`, { method: 'DELETE' }),

    // ---- Frete, pagamento e variações ----
    getShipping: () => request<AdminShipping[]>('/api/admin/shipping'),
    createShipping: (d: Partial<AdminShipping>) => request<{ success: boolean; id: string; message: string }>('/api/admin/shipping', { method: 'POST', body: JSON.stringify(d) }),
    updateShipping: (id: string, d: Partial<AdminShipping>) => request<{ success: boolean; message: string }>(`/api/admin/shipping/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteShipping: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/shipping/${id}`, { method: 'DELETE' }),
    getPayments: () => request<AdminPayment[]>('/api/admin/payment-methods'),
    createPayment: (d: Partial<AdminPayment>) => request<{ success: boolean; id: string; message: string }>('/api/admin/payment-methods', { method: 'POST', body: JSON.stringify(d) }),
    updatePayment: (id: string, d: Partial<AdminPayment>) => request<{ success: boolean; message: string }>(`/api/admin/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletePayment: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/payment-methods/${id}`, { method: 'DELETE' }),
    getVariants: (id: string) =>
      request<{ usaVariantes: boolean; variantes: Array<{ title: string; stock: number }>; titulosAntigos: string[]; estoqueTotal: number }>(`/api/admin/products/${id}/variants`),
    setVariants: (id: string, variantes: Array<{ title: string; stock: number }>) =>
      request<{ success: boolean; estoqueTotal: number; message: string }>(`/api/admin/products/${id}/variants`, { method: 'PUT', body: JSON.stringify({ variantes }) }),
    setVariantStock: (productId: string, variant: string, quantity: number, reason: string) =>
      request<{ success: boolean; message: string }>('/api/admin/stock/set', { method: 'POST', body: JSON.stringify({ productId, variant, quantity, reason }) }),

    getInsights: (period = '30d') =>
      request<DashboardInsights>(`/api/admin/dashboard/insights?period=${period}`),

    // ---- Upload de imagem (arquivo do computador) ----
    uploadImage: async (file: File) => {
      if (file.size > 6 * 1024 * 1024) throw new Error('A imagem tem mais de 6 MB. Reduza o tamanho e tente de novo.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      return request<{ url: string; bytes: number }>('/api/admin/uploads', {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
    },

    getAuditLogs: () => request<AuditLog[]>('/api/admin/audit-logs'),
    getArchitecture: () => request<ArchitectureOverview>('/api/admin/architecture/overview'),

    getAlerts: () => request<AdminAlert[]>('/api/admin/alerts'),
  },
};

export interface ArchitectureOverview {
  geradoEm: string;
  ultimaAtividade: string | null;
  site: { id: string; nome: string; dominio: string | null; tecnologia: string; ambiente: string; estadoConexao: string; armazenamento: string; publicacao: string };
  contagens: Record<string, number>;
  usuariosPorPapel: Array<{ role: string; n: number }>;
  armazenamento: { arquivos: number; bytes: number; bancoBytes: number; backups: number };
  servidor: { node: string; plataforma: string; uptimeSegundos: number; memoriaMB: number };
  verificacoes: Array<{ id: string; titulo: string; estado: 'ok' | 'falha' | 'nao_verificado' | 'atencao'; detalhe: string }>;
  papeis: Array<{ id: string; label: string; descricao: string; areas: Record<string, string> | 'todas' }>;
  seguranca: { tentativasNegadas7dias: number };
  eventosRecentes: Array<{ id: number; user_email: string | null; action: string; entity: string; entity_id: string | null; created_at: string }>;
  fases: Array<{ n: number; titulo: string; pronta: boolean }>;
}
