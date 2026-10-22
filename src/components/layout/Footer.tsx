import { Award } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import styles from './Footer.module.css';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

const soDigitos = (t: string) => {
  const d = t.replace(/\D/g, '');
  return d.length <= 11 ? `55${d}` : d; // sem DDI: assume Brasil
};

export const Footer = (_props: FooterProps) => {
  const { c, contato } = useSite();

  return (
    <footer className={styles.footer}>
      {/* Main Footer Links */}
      <div className={styles.mainFooter}>
        <div className="container">
          <div className={styles.footerGrid}>
            {/* Column 1: Brand info */}
            <div className={styles.brandCol}>
              <div className={styles.brandLogo}>
                <img data-edit-key="logo_footer" src={c('logo_footer')} alt="Luce D'Oro" className={styles.footerLogoImg} />
                <span className={styles.brandName}>LUCE D'ORO</span>
              </div>
              <div className={styles.certBadge}>
                <Award size={15} color="#B89758" />
                <span>Garantia Vitalícia do Teor do Ouro</span>
              </div>
            </div>

            {/* Atendimento */}
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Atendimento</h4>
              <ul className={styles.linkList}>
                <li>
                  <a className={styles.footerLink} href={`mailto:${contato.email}`}>Concierge: {contato.email}</a>
                </li>
                <li>
                  <a className={styles.footerLink} href={`https://wa.me/${soDigitos(contato.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp: {contato.whatsapp}
                  </a>
                </li>
                <li><span className={styles.footerStatic} data-edit-key="footer_hours">{c('footer_hours')}</span></li>
                {contato.instagram && (
                  <li>
                    <a className={styles.footerLink} href={`https://instagram.com/${contato.instagram.replace(/^@/, '').trim()}`} target="_blank" rel="noopener noreferrer">
                      Instagram: {contato.instagram}
                    </a>
                  </li>
                )}
                {contato.endereco && <li><span className={styles.footerStatic}>{contato.endereco}</span></li>}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};
