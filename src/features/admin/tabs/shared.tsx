import React, { useState } from 'react';
import { Image, Upload } from 'lucide-react';
import { api } from '../../../services/api';
import { MediaPicker } from '../MediaLibrary';
import styles from '../AdminPanel.module.css';


// ============================================================
// HELPERS
// ============================================================
export const fmt = (v: number | undefined | null) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


export const fmtDate = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });


export const statusClass = (s: string) => {
  const map: Record<string, string> = {
    Confirmado: styles.statusConfirmed,
    'Em preparação': styles.statusPending,
    Enviado: styles.statusShipped,
    Entregue: styles.statusDelivered,
    Cancelado: styles.statusCancelled,
  };
  return map[s] || styles.statusPending;
};


export const ORDER_STATUSES = ['Confirmado', 'Em preparação', 'Enviado', 'Entregue', 'Cancelado'];


// Botão "Enviar do computador": manda a foto para o servidor e devolve o endereço dela
export function UploadButton({ onUploaded, label = 'Enviar do computador' }: { onUploaded: (url: string) => void; label?: string }) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSending(true);
    setErr('');
    try {
      const r = await api.admin.uploadImage(file);
      onUploaded(r.url);
    } catch (ex: any) {
      setErr(ex.message || 'Não foi possível enviar a imagem.');
    }
    setSending(false);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ cursor: sending ? 'wait' : 'pointer' }}>
        <Upload size={13} /> {sending ? 'Enviando…' : label}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={pick} disabled={sending} />
      </label>
      {err && <span style={{ color: '#e57373', fontSize: '0.75rem' }}>{err}</span>}
    </span>
  );
}


// Campo de imagem: cole um link OU envie um arquivo do computador
export function ImageField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [biblioteca, setBiblioteca] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className={styles.formInput} style={{ flex: 1, minWidth: 180 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Cole um link ou envie um arquivo'} />
        <UploadButton onUploaded={onChange} />
        <button type="button" className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setBiblioteca(true)}><Image size={13} /> Biblioteca</button>
      </div>
      {biblioteca && <MediaPicker onPick={onChange} onClose={() => setBiblioteca(false)} />}
      {value && <img src={value} alt="" className={styles.bannerPreview} onError={() => {}} />}
    </>
  );
}
