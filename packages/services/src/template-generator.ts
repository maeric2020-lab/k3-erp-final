import { XLSX, workbookToArrayBuffer } from './excel';
import type { ImportTemplate } from './import.service';

interface TemplateSpec {
  filename: string;
  sheet_name: string;
  headers: string[];
  example_row: (string | number | null)[];
}

const SPECS: Record<ImportTemplate, TemplateSpec> = {
  customers: {
    filename: 'customers_template.xlsx',
    sheet_name: 'Customers',
    headers: ['Name AR', 'Name EN', 'Type', 'Civil ID', 'Phone Primary', 'Phone Secondary', 'Email', 'Notes'],
    example_row: ['شركة المثال', 'Example Co.', 'company', '123456789012', '+96599887766', '', 'info@example.com', ''],
  },
  machines: {
    filename: 'machines_template.xlsx',
    sheet_name: 'Machines',
    headers: ['Category', 'Brand', 'Refrigerant', 'Outdoor Model', 'Indoor Model', 'Capacity HP', 'Capacity TR', 'BTU/h', 'CFM', 'kW', 'Country Origin'],
    example_row: ['SPLT', 'Coolex', 'R410A', 'C24OD', 'C24ID', 2.0, null, 24000, null, null, 'Kuwait'],
  },
  services: {
    filename: 'services_template.xlsx',
    sheet_name: 'Services',
    headers: ['Service Name', 'Name AR', 'Service Type', 'Technical Code', 'Capacity HP', 'Unit'],
    example_row: ['Compressor replacing', 'استبدال كمبريسور', 'New compressor replacing', 'ZR81KCE', 6.5, 'piece'],
  },
  parts: {
    filename: 'parts_template.xlsx',
    sheet_name: 'Parts',
    headers: ['Part Name', 'Name AR', 'Part Category', 'Brand', 'Model', 'Country', 'Unit', 'Cost Price', 'Selling Price'],
    example_row: ['Compressor 6HP R410A', 'كمبريسور 6 حصان', 'COMPRESSOR', 'Copeland', 'ZR81KCE', 'USA', 'piece', 120.5, 165.0],
  },
  gas: {
    filename: 'gas_template.xlsx',
    sheet_name: 'Gas',
    headers: ['Refrigerant', 'Cost Price Per KG', 'Selling Price Per KG'],
    example_row: ['R410A', 5.0, 8.5],
  },
  service_pricing: {
    filename: 'service_pricing_template.xlsx',
    sheet_name: 'Service Pricing',
    headers: ['Category Section', 'Service Type', 'Service Code', 'Service Name', 'Capacity HP', 'Cost Price', 'CASH', 'CO', 'CW', 'CWC', 'UG'],
    example_row: ['Maintenance services', 'New compressor replacing', 'SRV-00001', 'Compressor 6HP R410A', 6.0, 120, 165, 165, 'Include', 'Include', 'Include'],
  },
  contract_pricing: {
    filename: 'contract_pricing_template.xlsx',
    sheet_name: 'Contract Pricing',
    headers: ['Category', 'Brand', 'Refrigerant', 'Outdoor Model', 'Indoor Model', 'Capacity HP', 'BTU/h', 'CO', 'CW', 'CWC', 'COG', 'CWG', 'CWCG'],
    example_row: ['SPLT', 'Coolex', 'R410A', 'C24OD', 'C24ID', 2.0, 24000, 18, 24, 30, 60, 80, 100],
  },
};

export function generateTemplate(template: ImportTemplate): { filename: string; buffer: ArrayBuffer } {
  const spec = SPECS[template];
  if (!spec) throw new Error(`Unknown template: ${template}`);
  const ws = XLSX.utils.aoa_to_sheet([spec.headers, spec.example_row]);
  // Set column widths to header length + a bit
  ws['!cols'] = spec.headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.sheet_name);
  const buffer = workbookToArrayBuffer(wb);
  return { filename: spec.filename, buffer };
}

export function listTemplates(): Array<{ template: ImportTemplate; filename: string; sheet_name: string }> {
  return (Object.keys(SPECS) as ImportTemplate[]).map((k) => ({
    template: k,
    filename: SPECS[k].filename,
    sheet_name: SPECS[k].sheet_name,
  }));
}
