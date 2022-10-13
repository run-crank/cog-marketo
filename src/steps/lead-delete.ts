/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class DeleteLeadStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Delete a Marketo Lead';
  protected stepExpression: string = 'delete the (?<email>.+) marketo lead';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email', // to prevent breaking previous scenarios, this is will stay as email
    type: FieldDefinition.Type.STRING,
    description: "Lead's email address or id",
  }, {
    field: 'partitionId',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'ID of partition lead belongs to',
    help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'lead',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Marketo ID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const reference = stepData.email;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      if (emailRegex.test(reference)) {
        lookupField = 'email';
      }

      const data: any = await this.client.findLeadByField(lookupField, reference, null, partitionId);

      if (data.success && data.result && data.result[0] && data.result[0].id) {
        const deleteRes: any = await this.client.deleteLeadById(data.result[0].id, reference);

        if (
          deleteRes.success &&
          deleteRes.result &&
          deleteRes.result[0] &&
          deleteRes.result[0].status === 'deleted'
        ) {
          return this.pass(
            'Successfully deleted lead %s',
            [reference],
            [this.keyValue('lead', 'Deleted Lead', { id: data.result[0].id })],
          );
        } else {
          return this.error('Unable to delete lead %s: %s', [reference, data]);
        }
      } else {
        return this.error('Unable to delete lead %s: %s%s', [
          reference,
          'a lead with that email address does not exist',
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }
    } catch (e) {
      return this.error('There was an error deleting %s from Marketo: %s', [
        reference,
        e.toString(),
      ]);
    }
  }

}

export { DeleteLeadStep as Step };
