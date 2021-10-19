import * as Marketo from 'node-marketo-rest';
export class LeadAwareMixin {
  client: Marketo;
  leadDescription: any;
  delayInSeconds = 3;

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {
    await this.delay(this.delayInSeconds);
    const partitions = await this.client.lead.partitions();
    const partition = partitions.result.find(option => option.id === partitionId);

    if (!partition) {
      return Promise.resolve({ error: { partition: false } });
    }

    return this.client.lead.createOrUpdate([lead], { lookupField: 'email', partitionName: partition ? partition.name : 'Default' });
  }

  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    await this.delay(this.delayInSeconds);
    const fields = await this.describeLeadFields();
    const fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);
    let response:any = {};
    const mustHaveFields = [
      justInCaseField,
      'email',
      'updatedAt',
      'createdAt',
      'lastName',
      'firstName',
      'id',
      'leadPartitionId',
    ].filter(f => !!f);

    if (fieldList.join(',').length > 7168 && fieldList.length >= 1000) {
      response = await this.client.lead.find(field, [value], { fields: mustHaveFields });
    } else if (fieldList.join(',').length > 7168) {
      response = await this.marketoRequestHelperFuntion(fieldList, mustHaveFields, field, value);
    } else {
      response = await this.client.lead.find(field, [value], { fields: fieldList });
    }

    // If a partition ID was provided, filter the returned leads accordingly.
    if (partitionId && response && response.result && response.result.length) {
      response.result = response.result.filter((lead: Record<string, any>) => {
        return lead.leadPartitionId && lead.leadPartitionId === partitionId;
      });
    }

    return response;
  }

  public async findLeadByEmail(email: string, justInCaseField: string = null, partitionId: number = null) {
    await this.delay(this.delayInSeconds);
    const fields = await this.describeLeadFields();
    const fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);
    let response:any = {};
    const mustHaveFields = [
      justInCaseField,
      'email',
      'updatedAt',
      'createdAt',
      'lastName',
      'firstName',
      'id',
      'leadPartitionId',
    ].filter(f => !!f);

    if (fieldList.join(',').length > 7168 && fieldList.length >= 1000) {
      response = await this.client.lead.find('email', [email], { fields: mustHaveFields });
    } else if (fieldList.join(',').length > 7168) {
      response = await this.marketoRequestHelperFuntion(fieldList, mustHaveFields, 'email', email);
    } else {
      response = await this.client.lead.find('email', [email], { fields: fieldList });
    }

    // If a partition ID was provided, filter the returned leads accordingly.
    if (partitionId && response && response.result && response.result.length) {
      response.result = response.result.filter((lead: Record<string, any>) => {
        return lead.leadPartitionId && lead.leadPartitionId === partitionId;
      });
    }

    return response;
  }

  private async marketoRequestHelperFuntion(fieldList, mustHaveFields, field, value) {
    const response:any = {};
    let allFields:{ [key: string]: string; } = {};

    for (let i = 0; i < fieldList.length && i <= 800; i += 200) {
      const currFields = i ? fieldList.slice(i, i + 200) : [...mustHaveFields, ...fieldList.slice(i, i + 200)];
      const currResponse = await this.client.lead.find(field, [value], { fields: currFields });
      allFields = { ...allFields, ...currResponse.result[0] };
      if (!i) {
        response.requestId = currResponse.requestId;
        response.success = currResponse.success;
      }
    }
    response.result = [allFields];

    return response;
  }

  public async deleteLeadById(leadId: number, email: string = null) {
    await this.delay(this.delayInSeconds);
    // @todo Contribute this back up to the package.
    return this.client._connection.postJson(
      '/v1/leads.json',
      { input: [{ id: leadId }] },
      { query: { _method: 'DELETE' } },
    );
  }

  public async describeLeadFields() {
    await this.delay(this.delayInSeconds);
    // This safely reduces the number of API calls that might have to be made
    // in lead field check steps, but is an imcomplete solution.
    // @todo Incorporate true caching based on https://github.com/run-crank/cli/pull/40
    if (!this.leadDescription) {
      this.leadDescription = await this.client.lead.describe();
    }

    return this.leadDescription;
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
