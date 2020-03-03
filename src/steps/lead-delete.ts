/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class DeleteLeadStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Delete a Marketo Lead';
  protected stepExpression: string = 'delete the (?<email>.+) marketo lead';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Lead's email address",
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'lead',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.STRING,
      description: "Lead's Marketo ID",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const email = stepData.email;

    try {
      // @todo Consider refactoring this logic into the ClientWrapper.
      const data: any = await this.client.findLeadByEmail(email);

      if (data.success && data.result && data.result[0] && data.result[0].id) {
        const deleteRes: any = await this.client.deleteLeadById(data.result[0].id);

        if (
          deleteRes.success &&
          deleteRes.result &&
          deleteRes.result[0] &&
          deleteRes.result[0].status === 'deleted'
        ) {
          return this.pass(
            'Successfully deleted lead %s',
            [email],
            [this.keyValue('lead', 'Deleted Lead', { id: data.result[0].id })],
          );
        } else {
          return this.error('Unable to delete lead %s: %s', [email, data]);
        }
      } else {
        return this.error('Unable to delete lead %s: %s', [
          email,
          'a lead with that email address does not exist.',
        ]);
      }
    } catch (e) {
      return this.error('There was an error deleting %s from Marketo: %s', [
        email,
        e.toString(),
      ]);
    }
  }

}

export { DeleteLeadStep as Step };
