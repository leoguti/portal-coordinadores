import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy para imágenes de Airtable
 * Resuelve problemas de CORS al servir las imágenes a través de nuestro servidor
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Allowlist (auditoría 2026-07-08): solo dominios de Airtable y nuestro R2
  // público. Sin esto el endpoint era un proxy abierto a cualquier URL (SSRF /
  // abuso de ancho de banda).
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  const permitido =
    host.endsWith('.airtableusercontent.com') ||
    host.endsWith('.airtable.com') ||
    host === 'pub-7ae3d6e965b84710a236072921fe7e61.r2.dev';
  if (!permitido) {
    return new NextResponse('Domain not allowed', { status: 403 });
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
