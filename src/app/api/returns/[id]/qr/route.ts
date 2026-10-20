import { getReturn } from "@/lib/data/returns";
import { verifyOrderAccessToken } from "@/lib/orders/token";
import { qrPng } from "@/lib/returns/qr";

/**
 * PNG QR code for a return, for emails (mail clients don't render inline
 * SVG). Requires the order's signed token, like the return page itself.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/returns/[id]/qr">) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");
  const record = await getReturn(id);
  if (!record || !verifyOrderAccessToken(record.orderId, token)) {
    return new Response("Not found", { status: 404 });
  }
  const png = await qrPng(record.label?.code ?? record.number);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
