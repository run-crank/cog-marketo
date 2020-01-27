import * as Marketo from 'node-marketo-rest';
import { isObject } from 'util';
export class CustomObjectAwareMixin {
  client: Marketo;

  public async createOrUpdateCustomObject(customObjectName, customObject: Record<string, any>) {
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
    return this.client._connection.get(
      `/v1/customobjects/${customObjectName}/describe.json`,
      { query: { _method: 'GET' } },
    );
  }

  public async queryCustomObject(customObjectName, filterType, searchFields: any[], requestFields: string[] = []) {
    if (isObject(searchFields[0])) {
      return this.client._connection.postJson(
        `/v1/customobjects/${customObjectName}.json`,
        {
          filterType: `${filterType}`,
          fields: requestFields,
          input: searchFields,
        },
        {
          query: {
            _method: 'GET' ,
          },
        },
      );
    } else {
      return this.client._connection.get(
        `/v1/customobjects/${customObjectName}.json?filterType=${filterType}&filterValues=${searchFields.join(',')}`,
      );
    }
  }

  public async deleteCustomObjectById(customObjectName, customObjectGUID) {
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
}
