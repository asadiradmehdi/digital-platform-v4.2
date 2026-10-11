/** Branded route loader: the orbit signature plus shimmering placeholder rows, so navigation feels instant. */
export default function Loading() {
  return (
    <main className="zp-load zp-root" role="status" aria-label="در حال بارگذاری">
      <svg className="zp-load-orb" viewBox="0 0 120 60" aria-hidden="true">
        <g transform="rotate(-12 60 30)">
          <ellipse cx="60" cy="30" rx="54" ry="16" fill="none" stroke="#D4A24C" strokeOpacity=".7" strokeWidth="1.6" />
          <g className="d"><circle cx="114" cy="30" r="3.6" fill="#D4A24C" /></g>
        </g>
      </svg>
      <div className="zp-load-rows" aria-hidden="true"><i /><i /><i /></div>
    </main>
  );
}
