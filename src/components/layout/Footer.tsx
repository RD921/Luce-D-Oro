import { useState, type FormEvent } from 'react';
import { ArrowRight, Award, Sparkles, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useSite } from '../../context/SiteContext';
import styles from './Footer.module.css';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer = ({ onNavigate }: FooterProps) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const { showToast } = useToast();
  const { categories, c, contato } = useSite();

  const handleNewsletter = (e: FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim() && newsletterEmail.includes('@')) {
      setNewsletterSubscribed(true);
      showToast('Obrigado! Você agora faz parte do círculo exclusivo Luce D\'Oro.', 'success');
      setNewsletterEmail('');
    }
  };

  return (
    <footer className={styles.footer}>
      {/* Editorial Newsletter Strip */}
      <div className={styles.newsletterSection}>
        <div className="container">
          <div className={styles.newsletterCard}>
            <div className={styles.newsletterText}>
              <div className={styles.goldPill}>
                <Sparkles size={12} color="#B89758" />
                <span>{c('footer_news_tag')}</span>
              </div>
              <h3 className={styles.newsletterTitle}>{c('footer_news_title')}</h3>
              <p className={styles.newsletterDesc}>
                {c('footer_news_desc')}
              </p>
            </div>

            {newsletterSubscribed ? (
              <div className={styles.subscribedFeedback}>
                <Check size={18} color="#B89758" />
                <span>Inscrição confirmada com sucesso.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className={styles.newsletterForm}>
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Seu melhor e-mail"
                  className={styles.newsletterInput}
                  required
                />
                <button type="submit" className={`btn-primary ${styles.newsletterBtn}`} aria-label="Inscrever-se">
                  <span>Inscrever-se</span>
                  <ArrowRight size={15} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className={styles.mainFooter}>
        <div className="container">
          <div className={styles.footerGrid}>
            {/* Column 1: Brand info */}
            <div className={styles.brandCol}>
              <div className={styles.brandLogo}>
                <img src="/images/logo-header.png" alt="Luce D'Oro" className={styles.footerLogoImg} />
                <span className={styles.brandName}>LUCE D'ORO</span>
              </div>
              <p className={styles.brandBio}>
                {c('footer_bio')}
              </p>
              <div className={styles.certBadge}>
                <Award size={15} color="#B89758" />
                <span>Garantia Vitalícia do Teor do Ouro</span>
              </div>
            </div>

            {/* Column 2: Coleções */}
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Coleções</h4>
              <ul className={styles.linkList}>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <button onClick={() => onNavigate('category', cat.slug)} className={styles.footerLink}>
                      {cat.name}
                    </button>
                  </li>
                ))}
                <li>
                  <button onClick={() => onNavigate('home')} className={styles.footerLink}>
                    Destaques Editoriais
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Atendimento & Segurança */}
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Atendimento</h4>
              <ul className={styles.linkList}>
                <li><span className={styles.footerStatic}>Concierge: {contato.email}</span></li>
                <li><span className={styles.footerStatic}>WhatsApp: {contato.whatsapp}</span></li>
                <li><span className={styles.footerStatic}>{c('footer_hours')}</span></li>
                {contato.instagram && <li><span className={styles.footerStatic}>Instagram: {contato.instagram}</span></li>}
                {contato.endereco && <li><span className={styles.footerStatic}>{contato.endereco}</span></li>}
                <li><span className={styles.footerStatic}>{c('footer_extra')}</span></li>
              </ul>
            </div>

            {/* Column 4: Institucional & Transparência */}
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Institucional</h4>
              <ul className={styles.linkList}>
                <li><span className={styles.footerStatic}>{c('footer_inst1')}</span></li>
                <li><span className={styles.footerStatic}>{c('footer_inst2')}</span></li>
                <li><span className={styles.footerStatic}>{c('footer_inst3')}</span></li>
                <li><span className={styles.footerStatic}>{c('footer_inst4')}</span></li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};
