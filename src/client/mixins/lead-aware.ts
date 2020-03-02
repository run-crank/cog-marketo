import * as Marketo from 'node-marketo-rest';
export class LeadAwareMixin {
  client: Marketo;

  public async createOrUpdateLead(lead: Record<string, any>) {
    return this.client.lead.createOrUpdate([lead], { lookupField: 'email' });
  }

  public async findLeadByEmail(email: string) {
    const fields = await this.describeLeadFields();
    return this.client.lead.find('email', [email], { fields: fields.result.map(field => field.rest).map(rest => rest.name) });
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
    return this.client.lead.describe();
  }
}
