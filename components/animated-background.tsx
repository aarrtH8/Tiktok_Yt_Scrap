export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="aurora-gradient" />
      <div className="grid-overlay" />
      <div className="noise-overlay" />

      <div
        className="floating-orb"
        style={{
          background:
            'radial-gradient(circle, rgba(147,197,253,0.55), rgba(99,102,241,0.15))',
          top: '10%',
          left: '5%',
        }}
      />
      <div
        className="floating-orb"
        style={{
          background:
            'radial-gradient(circle, rgba(248,113,113,0.45), rgba(244,114,182,0.1))',
          bottom: '5%',
          right: '8%',
          animationDelay: '4s',
        }}
      />
      <div
        className="floating-orb"
        style={{
          background:
            'radial-gradient(circle, rgba(192,132,252,0.4), rgba(59,130,246,0.1))',
          top: '35%',
          right: '38%',
          animationDuration: '22s',
        }}
      />
    </div>
  );
}
