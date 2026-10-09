export default function AdminLoading() {
  return (
    <div role="status" aria-label="در حال بارگذاری">
      <div className="zpa-skel" style={{ width: 220, minHeight: 32, marginBottom: 22 }} />
      <div className="zpa-grid" style={{ marginBottom: 16 }}>
        <div className="zpa-skel" /><div className="zpa-skel" /><div className="zpa-skel" />
      </div>
      <div className="zpa-skel" style={{ minHeight: 220 }} />
    </div>
  );
}
