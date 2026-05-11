import { requireScreen } from '@/lib/auth/require-screen';
import { CompanySettingsRepository } from '@k3/repositories';
import { ContractDocumentService } from '@k3/services';
import { notFound } from 'next/navigation';
import { ContractPrintClient } from './contract-print-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function ContractPrintPage({ params }: PageProps) {
  const ctx = await requireScreen('contracts', 'view');
  const svc = new ContractDocumentService(ctx.supabase);
  const settings = new CompanySettingsRepository(ctx.supabase);

  let doc;
  try {
    // Materialise default clauses if none exist yet
    await svc.materialiseClauses(params.id);
    doc = await svc.assemble(params.id);
  } catch (e) {
    notFound();
  }
  const company = await settings.get();

  return <ContractPrintClient doc={doc} company={company} />;
}
