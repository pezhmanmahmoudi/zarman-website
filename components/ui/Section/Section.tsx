import styles from './Section.module.css';

interface SectionProps {
  children: React.ReactNode;
  id?: string;
  variant?: 'major' | 'compact';
  className?: string;
}

export const Section = ({ children, id, variant = 'major', className = '' }: SectionProps) => {
  return (
    <section id={id} className={`${styles.section} ${styles[variant]} ${className}`}>
      {children}
    </section>
  );
};