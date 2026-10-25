export function AmbientBackground() {
  return (
    <div className="ambient-background fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="ambient-blob ambient-main absolute rounded-full blur-[140px] max-md:blur-[98px] motion-reduce:animate-none will-change-transform animate-ambient-drift" />
      <div className="ambient-blob ambient-magenta absolute rounded-full blur-[120px] max-md:blur-[84px] motion-reduce:animate-none will-change-transform animate-ambient-drift" />
      <div className="ambient-blob ambient-indigo absolute rounded-full blur-[130px] max-md:blur-[91px] motion-reduce:animate-none will-change-transform animate-ambient-drift" />
      <div className="ambient-blob ambient-core absolute rounded-full blur-[80px] max-md:blur-[56px] motion-reduce:animate-none will-change-transform animate-ambient-drift" />
      <div className="ambient-blob ambient-accent absolute rounded-full blur-[90px] max-md:blur-[63px] motion-reduce:animate-none will-change-transform animate-ambient-drift" />
    </div>
  );
}