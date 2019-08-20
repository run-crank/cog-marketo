import * as grpc from 'grpc';
import * as Marketo from 'node-marketo-rest';
import { Field } from '../core/base-step';
import { FieldDefinition } from '../proto/cog_pb';

export class ClientWrapper {

  public static expectedAuthFields: Field[] = [{
    field: 'endpoint',
    type: FieldDefinition.Type.URL,
    description: 'REST API endpoint (without /rest), e.g. https://abc-123.mktorest.com',
  }, {
    field: 'clientId',
    type: FieldDefinition.Type.STRING,
    description: 'Client ID',
  }, {
    field: 'clientSecret',
    type: FieldDefinition.Type.STRING,
    description: 'Client Secret',
  }];

  private client: Marketo;

  constructor (auth: grpc.Metadata, clientConstructor = Marketo) {
    this.client = new clientConstructor({
      endpoint: `${auth.get('endpoint')[0]}/rest`,
      identity: `${auth.get('endpoint')[0]}/identity`,
      clientId: auth.get('clientId')[0],
      clientSecret: auth.get('clientSecret')[0],
    });
  }

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

}
