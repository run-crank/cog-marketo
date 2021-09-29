import * as Marketo from 'node-marketo-rest';
export class LeadAwareMixin {
  client: Marketo;
  leadDescription: any;

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {
    const partitions = await this.client.lead.partitions();
    const partition = partitions.result.find(option => option.id === partitionId);

    if (!partition) {
      return Promise.resolve({ error: { partition: false } });
    }

    return this.client.lead.createOrUpdate([lead], { lookupField: 'email', partitionName: partition ? partition.name : 'Default' });
  }

  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    const fields = await this.describeLeadFields();
    let fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);

    // If the length of the get request would be over 7KB, then the request
    // would fail. Instead, just hard-code the list of fields to be returned.
    // @todo There is a bug in Marketo's workaround for this, preventing a
    // "real" solution (e.g. PUT request with _method=GET and fields list in
    // request body).
    if (fieldList.join(',').length > 7168) {
      fieldList = [
        justInCaseField,
        'email',
        'updatedAt',
        'createdAt',
        'lastName',
        'firstName',
        'id',
        'leadPartitionId',
      ].filter(f => !!f);
    }

    const response = await this.client.lead.find(field, [value], { fields: fieldList });

    // If a partition ID was provided, filter the returned leads accordingly.
    if (partitionId && response && response.result && response.result.length) {
      response.result = response.result.filter((lead: Record<string, any>) => {
        return lead.leadPartitionId && lead.leadPartitionId === partitionId;
      });
    }

    return response;
  }

  public async findLeadByEmail(email: string, justInCaseField: string = null, partitionId: number = null) {
    const fields = await this.describeLeadFields();
    let fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);

    // If the length of the get request would be over 7KB, then the request
    // would fail. Instead, just hard-code the list of fields to be returned.
    // @todo There is a bug in Marketo's workaround for this, preventing a
    // "real" solution (e.g. PUT request with _method=GET and fields list in
    // request body).
    if (fieldList.join(',').length > 7168) {
      fieldList = [
        justInCaseField,
        'email',
        'updatedAt',
        'createdAt',
        'lastName',
        'firstName',
        'id',
        'leadPartitionId',
      ].filter(f => !!f);
    }

    const response = await this.client.lead.find('email', [email], { fields: fieldList });

    // If a partition ID was provided, filter the returned leads accordingly.
    if (partitionId && response && response.result && response.result.length) {
      response.result = response.result.filter((lead: Record<string, any>) => {
        return lead.leadPartitionId && lead.leadPartitionId === partitionId;
      });
    }

    return response;
  }

  public async deleteLeadById(leadId: number, email: string = null) {
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
