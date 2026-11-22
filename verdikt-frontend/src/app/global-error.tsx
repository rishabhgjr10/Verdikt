"use client";

/** Last resort when the root layout itself fails: it replaces the whole document, so it brings its own html and body. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#09090b", color: "#f4f4f5", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Verdikt hit a problem</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", margin: "0 0 24px" }}>Reload the page to try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: "8px 16px", borderRadius: 12, border: 0, background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
