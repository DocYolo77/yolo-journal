import sharp from "sharp";

/**
 * Rasterizes one of lib/charts/svg-chart.ts's SVG strings to a PNG data
 * URI for embedding in the PDF export (@react-pdf/renderer has no
 * reliable raw-SVG embedding, but does support PNG/JPEG images) — same
 * SVG source as the web report view either way, just a different final
 * encoding.
 */
export async function svgToPngDataUri(svg: string, width = 900): Promise<string> {
  const buffer = await sharp(Buffer.from(svg))
    .resize({ width })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
