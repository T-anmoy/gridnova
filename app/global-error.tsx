"use client";

// Last-resort boundary: renders when a root layout itself fails, so it cannot
// rely on the site's providers, fonts or stylesheet. Plain inline styles in the
// brand colours, English only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#091c3c",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main id="main-content" role="alert" style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.75)" }}>
            Grid Nova Energy could not load this page. Please try again.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Ref: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 28,
              minHeight: 44,
              padding: "0 28px",
              borderRadius: 999,
              border: 0,
              background: "#f7a800",
              color: "#091c3c",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
