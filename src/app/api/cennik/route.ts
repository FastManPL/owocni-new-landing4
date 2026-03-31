import { NextResponse } from 'next/server';

/**
 * Odbiór formularza cennika (@owocni/cennik-form) — ten sam serwer co LP.
 * Body: multipart/form-data (pola jak w OwocniForm.sendFormData).
 *
 * Tu dopinasz logikę: zapis do CRM, e-mail, Bitrix itd. Na razie: walidacja + 200.
 */

export async function POST(request: Request) {
  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json(
        { ok: false, error: 'expected_multipart' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const email = (formData.get('email') as string | null)?.trim() || '';
    const name = (formData.get('name') as string | null)?.trim() || '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    // W prod: zapis / integracja wewnętrzna (bez zewnętrznych webhooków).
    if (process.env.NODE_ENV === 'development') {
      const keys = [...formData.keys()];
      console.debug('[api/cennik] received fields:', keys.length, {
        form_type: formData.get('form_type'),
        product: formData.get('product'),
        email: email.slice(0, 3) + '…',
        name: name || '(empty)',
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
