import type { K3SupabaseClient, Database, Tables, TablesUpdate } from '@k3/shared-types';

export type CompanySettings = Tables<'company_settings'>;

export class CompanySettingsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  async get(): Promise<CompanySettings | null> {
    const { data, error } = await this.db
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw new Error(`Failed to load company settings: ${error.message}`);
    return data;
  }

  async update(patch: TablesUpdate<'company_settings'>): Promise<CompanySettings> {
    const { data, error } = await this.db
      .from('company_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to update company settings: ${error.message}`);
    return data;
  }

  /**
   * Public URL for the company logo (logos bucket is public).
   * Returns null when no logo is set.
   */
  async getLogoPublicUrl(): Promise<string | null> {
    const settings = await this.get();
    if (!settings?.logo_path) return null;
    const { data } = this.db.storage.from('logos').getPublicUrl(settings.logo_path);
    return data.publicUrl;
  }
}
