/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';

export class CreateOrUpdateLeadByFieldStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create or Update Marketo Lead';
  protected stepExpression: string = 'create or update a marketo lead';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'lead',
    type: FieldDefinition.Type.MAP,
    description: 'Key/value pairs whose keys correspond to Marketo REST API field names for ' +
      'Lead fields. Must include an email key/value pair.',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const lead = stepData.lead;

    try {
      const data: any = await this.client.createOrUpdateLead(lead);
      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        return this.pass('Successfully created or updated lead %s with status %s', [
          lead.email,
          data.result[0].status,
        ]);
      } else {
        if (data.result && data.result[0] && data.result[0].reasons && data.result[0].reasons[0]) {
          return this.fail('Unable to create or update lead: %s', [
            data.result[0].reasons[0].message,
          ]);
        } else {
          return this.fail('Unable to create or update lead: %s', [
            `status was ${data.result[0].status}`,
          ]);
        }
      }
    } catch (e) {
      return this.error('There was an error creating or updating leads in Marketo: %s', [
        e.toString(),
      ]);
    }
  }

}

export { CreateOrUpdateLeadByFieldStep as Step };
