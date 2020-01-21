import * as Marketo from 'node-marketo-rest';
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

  public async queryCustomObject(customObjectName, idField, filterType, filterValue) {
    return this.client._connection.postJson(
      `/v1/customobjects/${customObjectName}.json`,
      {
        filterType: `${filterType}`,
        fields: [
          idField,
        ],
        input: [
          filterValue,
        ],
      },
      {
        query: {
          _method: 'GET' ,
        },
      },
    );
  }

  public async deleteCustomObjectById(customObjectName, object) {
    // @todo Contribute this back up to the package.
    return this.client._connection.postJson(
      `/v1/customobjects/${customObjectName}/delete.json`,
      {
        deleteBy: 'idField',
        input: [object],
      },
    );
  }
}
