import "server-only";
import QRCode from "qrcode";

const OPTIONS = { margin: 1, errorCorrectionLevel: "M" as const };
const COLOR = { dark: "#1a1a1a", light: "#ffffff" };

/** Inline SVG markup for pages. */
export function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, { ...OPTIONS, type: "svg", color: COLOR });
}

/** PNG for email clients, which don't render inline SVG. */
export function qrPng(value: string): Promise<Buffer> {
  return QRCode.toBuffer(value, { ...OPTIONS, type: "png", width: 320, color: COLOR });
}
