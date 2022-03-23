import * as Marketo from 'node-marketo-rest';
export class LeadAwareMixin {
  client: Marketo;
  leadDescription: any;
  delayInSeconds;
  mustHaveFields = [
    'email',
    'updatedAt',
    'createdAt',
    'lastName',
    'firstName',
    'id',
    'leadPartitionId',
  ].filter(f => !!f);

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    const partitions = await this.client.lead.partitions();
    const partition = partitions.result.find(option => option.id === partitionId);

    if (!partition) {
      return Promise.resolve({ error: { partition: false } });
    }

    return this.client.lead.createOrUpdate([lead], { lookupField: 'email', partitionName: partition ? partition.name : 'Default' });
  }

  public async bulkCreateOrUpdateLead(leads: {}[], partitionId: number = 1) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    const partitions = await this.client.lead.partitions();
    const partition = partitions.result.find(option => option.id === partitionId);
    if (!partition) {
      return Promise.resolve({ error: { partition: false } });
    }

    const chunkedLeads = this.chunkArrayHelper(leads);

    // Make a separate API call for each chunk of 300 and return an array of the responses.
    const responseArray = [];
    for (let i = 0; i < chunkedLeads.length; i += 1) {
      const response = await this.client.lead.createOrUpdate(chunkedLeads[i], { lookupField: 'email', partitionName: partition ? partition.name : 'Default' });
      responseArray.push(response);
    }
    return responseArray;
  }

  public async bulkFindLeadsByEmail(emails: [], justInCaseField: string = null, partitionId: number = null) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    const fields = await this.describeLeadFields();
    const fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);
    let response;

    const chunkedEmails = this.chunkArrayHelper(emails);

    // Make a separate API call for each chunk of 300 and return an array of the responses.
    const responseArray = [];
    for (let i = 0; i < chunkedEmails.length; i += 1) {
      response = await this.client.lead.find('email', chunkedEmails[i], { fields: [justInCaseField, ...this.mustHaveFields] });
      responseArray.push(response);
    }

    // If a partition ID was provided, filter the returned leads accordingly.
    responseArray.forEach((response) => {
      if (partitionId && response && response.result && response.result.length) {
        response.result = response.result.filter((lead: Record<string, any>) => {
          return lead.leadPartitionId && lead.leadPartitionId === partitionId;
        });
      }
    });

    return responseArray;
  }

  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    const fields = await this.describeLeadFields();
    const fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);
    let response:any = {};

    if (fieldList.join(',').length > 7168 && fieldList.length >= 1000) {
      // If the length of the get request would be over 7KB, then the request
      // would fail. And if the amount of fields is over 1000, it is likely
      // not worth it to cache with the if statement below.
      // Instead, we will only request the needed fields.
      response = await this.client.lead.find(field, [value], { fields: [justInCaseField, ...this.mustHaveFields] });
    } else if (fieldList.join(',').length > 7168) {
      // If the length of the get request would be over 7KB, then the request
      // would fail. Instead, we will split the request every 200 fields, and
      // combine the results.
      response = await this.marketoRequestHelperFuntion(fieldList, field, value);
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
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    const fields = await this.describeLeadFields();
    const fieldList: string[] = fields.result.filter(field => field.rest).map((field: any) => field.rest.name);
    let response:any = {};

    if (fieldList.join(',').length > 7168 && fieldList.length >= 1000) {
      response = await this.client.lead.find('email', [email], { fields: [justInCaseField, ...this.mustHaveFields] });
    } else if (fieldList.join(',').length > 7168) {
      response = await this.marketoRequestHelperFuntion(fieldList, 'email', email);
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

  public async associateLeadById(leadId: string, cookie: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client.lead.associateLead(leadId, cookie);
  }

  public async mergeLeadsById(winningLead: string, losingLeads: string[]) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client.lead.mergeLead(winningLead, losingLeads, { mergeInCrm: null });
  }

  private async marketoRequestHelperFuntion(fieldList, field, value) {
    const response:any = {};
    let allFields:{ [key: string]: string; } = {};

    for (let i = 0; i < fieldList.length && i <= 800; i += 200) {
      const currFields = fieldList.slice(i, i + 200);
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
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    // @todo Contribute this back up to the package.
    return this.client._connection.postJson(
      '/v1/leads.json',
      { input: [{ id: leadId }] },
      { query: { _method: 'DELETE' } },
    );
  }

  public async describeLeadFields() {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    // This safely reduces the number of API calls that might have to be made
    // in lead field check steps, but is an imcomplete solution.
    // @todo Incorporate true caching based on https://github.com/run-crank/cli/pull/40
    if (!this.leadDescription) {
      this.leadDescription = await this.client.lead.describe();
    }

    return this.leadDescription;
  }

  public chunkArrayHelper(leadArray) {
    // Chunk the leads array into subarrays with length 300 or less
    const chunkedLeads = [];
    const leadArrayCopy = [...leadArray];
    let chunkIndex = 0;
    while (leadArrayCopy.length) {
      chunkedLeads[chunkIndex] = leadArrayCopy.splice(0, 300);
      chunkIndex += 1;
    }
    return chunkedLeads;
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
