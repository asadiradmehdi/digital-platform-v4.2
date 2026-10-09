'use client';
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="zpa-state err" role="alert">
      <h3>خطا در بارگذاری این بخش</h3>
      <p>اطلاعات دریافت نشد. چند لحظه بعد دوباره تلاش کنید.</p>
      <button className="zpa-btn" onClick={reset}>تلاش دوباره</button>
    </div>
  );
}
