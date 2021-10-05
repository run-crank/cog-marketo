import * as Marketo from 'node-marketo-rest';
import { isObject } from 'util';
export class CustomObjectAwareMixin {
  client: Marketo;
  customObjectDescriptions: any = {};
  delayInSeconds = 3;

  public async createOrUpdateCustomObject(customObjectName, customObject: Record<string, any>) {
    await this.delay(this.delayInSeconds);
    return this.client._connection.postJson(
      `/v1/customobjects/${customObjectName}.json`,
      {
        action: 'createOrUpdate',
        dedupeBy: 'dedupeFields',
        input: [customObject],
      },
      {
        query: {
          _method: 'POST',
        },
      },
    );
  }

  public async getCustomObject(customObjectName) {
    await this.delay(this.delayInSeconds);
    // This safely reduces the number of API calls that might have to be made
    // in custom object field check steps, but is an imcomplete solution.
    // @todo Incorporate true caching based on https://github.com/run-crank/cli/pull/40
    if (!this.customObjectDescriptions || !this.customObjectDescriptions[customObjectName]) {
      this.customObjectDescriptions = this.customObjectDescriptions || {};
      this.customObjectDescriptions[customObjectName] = await this.client._connection.get(
        `/v1/customobjects/${customObjectName}/describe.json`,
        { query: { _method: 'GET' } },
      );
    }
    return this.customObjectDescriptions[customObjectName];
  }

  // @todo Update this method and callees to remove the requestFields argument.
  public async queryCustomObject(customObjectName, filterType, searchFields: any[], requestFields: string[] = []) {
    await this.delay(this.delayInSeconds);
    const fields = await this.getCustomObject(customObjectName);
    if (isObject(searchFields[0])) {
      return this.client._connection.postJson(
        `/v1/customobjects/${customObjectName}.json`,
        {
          filterType: `${filterType}`,
          fields: fields.result[0].fields.map(field => field.name),
          input: searchFields,
        },
        {
          query: {
            _method: 'GET',
          },
        },
      );
    } else {
      return this.client._connection.get(
        `/v1/customobjects/${customObjectName}.json?filterType=${filterType}&filterValues=${searchFields.join(',')}&fields=${fields.result[0].fields.map(field => field.name).join(',')}`,
      );
    }
  }

  public async deleteCustomObjectById(customObjectName, customObjectGUID) {
    await this.delay(this.delayInSeconds);
    // @todo Contribute this back up to the package.
    return this.client._connection.postJson(
      `/v1/customobjects/${customObjectName}/delete.json`,
      {
        deleteBy: 'idField',
        input: [{
          marketoGUID: customObjectGUID,
        }],
      },
    );
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
