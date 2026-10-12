import { API_BASE_URL } from '@/lib/config';
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// NOTE: the wizard no longer uses this route — it uploads straight to the
// backend from the browser (a Vercel Function rejects bodies over 4.5 MB, below
// the wizard's 10 MB limit). It is kept, with the same honest
// storage_not_configured handling, for small server-side callers.
//
// Proxies one file upload for an already-created ProposalInputs row to the
// real backend endpoint (grid-nova-ai-backend's
// POST /api/v1/proposal-inputs/{id}/upload). A thin pass-through, not a
// second copy of the backend's validation: it forwards the browser's
// multipart body as-is (real bytes, not JSON) and relays whatever the
// backend decides — including a real 503 when R2 storage isn't configured,
// which must reach the caller as an honest failure, never a fake success.

const API_BASE = API_BASE_URL;

export async function POST(request: Request, ctx: RouteContext<"/api/proposal-inputs/[id]/upload">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ success: false, error: "Invalid assessment id." }, { status: 400 });
  }

  const session = await auth();
  const token = await session.getToken();
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Please sign in as a Grid Nova staff member before uploading files.",
        code: "not_authenticated",
      },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid upload body." }, { status: 400 });
  }

  let res: Response;
  try {
    // Pass the FormData straight through — fetch sets the correct
    // multipart/form-data boundary itself; setting Content-Type by hand
    // would break it.
    res = await fetch(`${API_BASE}/api/v1/proposal-inputs/${id}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    if (detail && typeof detail === "object" && detail.code === "storage_not_configured") {
      return NextResponse.json(
        {
          success: false,
          code: "storage_not_configured",
          error: "File storage isn't connected yet — this file was NOT saved. The rest of the assessment was submitted.",
        },
        { status: 503 }
      );
    }
    const message = typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : `Upload failed (${res.status})`;
    return NextResponse.json({ success: false, error: message }, { status: res.status });
  }

  return NextResponse.json({ success: true, data });
}
