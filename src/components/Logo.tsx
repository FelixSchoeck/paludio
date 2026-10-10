import wordmarkUrl from '../assets/logo-schrift.svg';

/** Bildmarke mit Schriftzug „Paludio – Zukunft wächst im Moor“ (Bildmarke allein: public/favicon.svg) */
export function Wordmark() {
  return <img className="wordmark" src={wordmarkUrl} width={1658} height={471} alt="Paludio – Zukunft wächst im Moor" />;
}
