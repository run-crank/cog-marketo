import * as Marketo from 'node-marketo-rest';

const DEFAULT_FIELDS: string[] = ['email', 'createdAt', 'updatedAt', 'id', 'firstName', 'lastName'];

export class LeadAwareMixin {
  client: Marketo;
  leadDescription: any;

  public async createOrUpdateLead(lead: Record<string, any>) {
    return this.client.lead.createOrUpdate([lead], { lookupField: 'email' });
  }

  public async findLeadByEmail(email: string, options: Record<string, any> = null) {
    if (options) {
      options.fields = options.fields || [];
      options.fields = Array.from(new Set(options.fields.concat(DEFAULT_FIELDS))).join(','); //// Ensure unique fields
      console.log(options.fields);
      return this.client.lead.find('email', [email], options);
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
    // This safely reduces the number of API calls that might have to be made
    // in lead field check steps, but is an imcomplete solution.
    // @todo Incorporate true caching based on https://github.com/run-crank/cli/pull/40
    if (!this.leadDescription) {
      this.leadDescription = await this.client.lead.describe();
    }

    return this.leadDescription;
  }
}
