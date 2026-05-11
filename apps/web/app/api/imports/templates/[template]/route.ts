import { NextResponse, type NextRequest } from 'next/server';
import { generateTemplate, type ImportTemplate } from '@k3/services';

const VALID = new Set([
  'customers', 'machines', 'services', 'parts', 'gas',
  'service_pricing', 'contract_pricing',
]);

interface Ctx { params: { template: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!VALID.has(params.template)) {
    return NextResponse.json({ error: 'unknown template' }, { status: 404 });
  }
  try {
    const { filename, buffer } = generateTemplate(params.template as ImportTemplate);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
