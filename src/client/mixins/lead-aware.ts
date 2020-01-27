import * as Marketo from 'node-marketo-rest';
export class LeadAwareMixin {
  client: Marketo;

  public async createOrUpdateLead(lead: Record<string, any>) {
    return this.client.lead.createOrUpdate([lead], { lookupField: 'email' });
  }

  public async findLeadByEmail(email: string, opts: Record<string, any> = null) {
    if (opts) {
      return this.client.lead.find('email', [email], opts);
    }
    return this.client.lead.find('email', [email]);
  }

  public async deleteLeadById(leadId: number) {
    // @todo Contribute this back up to the package.
    return this.client._connection.postJson(
      '/v1/leads.json',
      { input: [{ id: leadId }] },
      { query: { _method: 'DELETE' } },
    );
  }

  public async describeLeadFields() {
    return this.client._connection.get(
      '/v1/leads/describe.json',
      { query: { _method: 'GET' } },
    );
  }
}
