export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 34, width: 220 }} />
      <div className="grid cols-4" style={{ marginTop: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ height: 14, width: "55%" }} />
            <div className="skeleton" style={{ height: 30, width: "80%", marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    </div>
  );
}
