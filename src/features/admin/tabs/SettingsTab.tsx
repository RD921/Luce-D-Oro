import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useSite } from '../../../context/SiteContext';
import { api } from '../../../services/api';
import { SeoSettings, IntegrationsPanel, NotificationsPanel } from '../SettingsExtras';
import { type SettingsSub } from './constantes';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: SETTINGS
// ============================================================
export function SettingsTab() {
  const { refreshContent } = useSite();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getSettings().then(s => {
      // Lojas antigas guardam estes dados com outros nomes: mostra o valor existente nos campos novos
      const alias: Record<string, string> = { store_email: 'contact_email', store_phone: 'contact_whatsapp', store_slogan: 'store_tagline', store_instagram: 'instagram' };
      const completo = { ...s };
      for (const [novo, antigo] of Object.entries(alias)) if (!completo[novo] && s[antigo]) completo[novo] = s[antigo];
      setSettings(completo);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      void refreshContent();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/></div>;

  const SETTING_FIELDS: { key: string; label: string; placeholder?: string; type?: string }[] = [
    { key: 'store_name', label: 'Nome da Loja', placeholder: "Luce D'Oro" },
    { key: 'store_slogan', label: 'Slogan', placeholder: 'Joalheria Contemporânea' },
    { key: 'store_email', label: 'E-mail de Contato', placeholder: 'contato@cddeouro.com.br', type: 'email' },
    { key: 'store_phone', label: 'Telefone / WhatsApp', placeholder: '+55 11 99999-9999' },
    { key: 'store_instagram', label: 'Instagram (@ ou URL)', placeholder: '@cddeouro' },
    { key: 'store_cnpj', label: 'CNPJ', placeholder: '00.000.000/0001-00' },
    { key: 'store_address', label: 'Endereço Completo', placeholder: 'Rua das Joias, 100 — São Paulo, SP' },
    { key: 'meta_description', label: 'Meta Description (SEO)', placeholder: 'Joias folheadas e semi-joias premium' },
  ];

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Configurações da Loja</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
          {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : saved ? <><CheckCircle size={13} /> Salvo!</> : 'Salvar Configurações'}
        </button>
      </div>

      <div className={styles.tableWrapper} style={{ padding: '1.5rem' }}>
        <div className={styles.formGrid}>
          {SETTING_FIELDS.map(f => (
            <div key={f.key} className={styles.formGroup}>
              <label className={styles.formLabel}>{f.label}</label>
              <input
                type={f.type || 'text'}
                className={styles.formInput}
                value={settings[f.key] || ''}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}



// ============================================================
// CONFIGURAÇÕES: Geral | Arquitetura
// ============================================================
export function SettingsSection({ sub }: { sub: SettingsSub }) {
  if (sub === 'geral') return <SettingsTab />;
  if (sub === 'seo') return <SeoSettings />;
  if (sub === 'integracoes') return <IntegrationsPanel />;
  return <NotificationsPanel />;
}
