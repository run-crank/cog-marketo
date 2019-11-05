import * as grpc from 'grpc';
import * as Marketo from 'node-marketo-rest';
import { Field } from '../core/base-step';
import { FieldDefinition } from '../proto/cog_pb';
import { LeadAwareMixin } from './mixins/lead-aware';

class ClientWrapper {

  public static expectedAuthFields: Field[] = [{
    field: 'endpoint',
    type: FieldDefinition.Type.URL,
    description: 'REST API endpoint (without /rest), e.g. https://123-abc-456.mktorest.com',
  }, {
    field: 'clientId',
    type: FieldDefinition.Type.STRING,
    description: 'Client ID',
  }, {
    field: 'clientSecret',
    type: FieldDefinition.Type.STRING,
    description: 'Client Secret',
  }];

  client: Marketo;

  constructor (auth: grpc.Metadata, clientConstructor = Marketo) {
    this.client = new clientConstructor({
      endpoint: `${auth.get('endpoint')[0]}/rest`,
      identity: `${auth.get('endpoint')[0]}/identity`,
      clientId: auth.get('clientId')[0],
      clientSecret: auth.get('clientSecret')[0],
      ...(!!auth.get('partnerId')[0] && { partnerId: auth.get('partnerId')[0] }),
    });
  }
}

interface ClientWrapper extends LeadAwareMixin {}
applyMixins(ClientWrapper, [LeadAwareMixin]);

function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
          // tslint:disable-next-line:max-line-length
      Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
    });
  });
}

export { ClientWrapper as ClientWrapper };
