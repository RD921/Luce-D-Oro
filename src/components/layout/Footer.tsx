import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck, Award, Lock, Sparkles, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './Footer.module.css';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer = ({ onNavigate }: FooterProps) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const { showToast } = useToast();

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
                <span>CÍRCULO EXCLUSIVO</span>
              </div>
              <h3 className={styles.newsletterTitle}>Receba lançamentos e convites privados</h3>
              <p className={styles.newsletterDesc}>
                Cadastre seu e-mail para ter acesso antecipado a novas edições limitadas e conteúdos editoriais da joalheria.
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
                Joalheria contemporânea com peças exclusivas em ouro nobre, design autoral e acabamento primoroso. Detalhes que contam a sua história com discrição e sofisticação atemporal.
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
                <li>
                  <button onClick={() => onNavigate('category', 'pulseiras')} className={styles.footerLink}>
                    Pulseiras
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('category', 'correntes')} className={styles.footerLink}>
                    Correntes
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('category', 'brincos')} className={styles.footerLink}>
                    Brincos
                  </button>
                </li>
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
                <li><span className={styles.footerStatic}>Concierge: contato@cddeouro.com.br</span></li>
                <li><span className={styles.footerStatic}>WhatsApp: (11) 98765-4321</span></li>
                <li><span className={styles.footerStatic}>Segunda a Sexta, das 09h às 19h</span></li>
                <li><span className={styles.footerStatic}>Entregas & Trocas Cortesia</span></li>
              </ul>
            </div>

            {/* Column 4: Institucional & Transparência */}
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Institucional</h4>
              <ul className={styles.linkList}>
                <li><span className={styles.footerStatic}>Sobre a Luce D'Oro</span></li>
                <li><span className={styles.footerStatic}>Nossos Mestres Ourives</span></li>
                <li><span className={styles.footerStatic}>Política de Privacidade</span></li>
                <li><span className={styles.footerStatic}>Termos de Uso</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className={styles.bottomBar}>
            <p className={styles.copyright}>
              © {new Date().getFullYear()} Luce D'Oro Joalheria Contemporânea. Todos os direitos reservados. CNPJ 48.912.304/0001-92.
            </p>

            <div className={styles.securityBadges}>
              <div className={styles.secItem}>
                <Lock size={13} color="#B89758" />
                <span>SSL 256 bits</span>
              </div>
              <div className={styles.secItem}>
                <ShieldCheck size={13} color="#B89758" />
                <span>Pagamento Seguro</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
