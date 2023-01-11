/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class MergeLeadsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Merge Marketo leads';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'merge marketo lead (?<losingEmail>.+\@.+\..+) into marketo lead (?<winningEmail>.+\@.+\..+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = [];
  protected targetObject: string = 'Merge Leads';
  protected expectedFields: Field[] = [{
    field: 'losingEmail',
    type: FieldDefinition.Type.STRING,
    description: 'Email or id of the losing lead',
  }, {
    field: 'winningEmail',
    type: FieldDefinition.Type.STRING,
    description: 'Email or id of the winning lead',
  }, {
    field: 'partitionId',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'ID of partition lead belongs to',
    help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'mergedLead',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Marketo Lead's ID",
    }, {
      field: 'email',
      description: "Marketo Lead's Email",
      type: FieldDefinition.Type.STRING,
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const losingReference = stepData.losingEmail;
    const winningReference = stepData.winningEmail;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      if (emailRegex.test(losingReference)) {
        lookupField = 'email';
      }

      const losingLead: any = await this.client.findLeadByField(lookupField, losingReference, null, partitionId);
      if (losingLead.success && losingLead.result && losingLead.result[0] && losingLead.result[0].id) {
        const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
        let lookupField = 'id';
        if (emailRegex.test(losingReference)) {
          lookupField = 'email';
        }

        const winningLead: any = await this.client.findLeadByField(lookupField, winningReference, null, partitionId);
        if (winningLead.success && winningLead.result && winningLead.result[0] && winningLead.result[0].id) {
          const mergedLead: any = await this.client.mergeLeadsById(winningLead.result[0].id, [losingLead.result[0].id]);
          if (mergedLead.success && mergedLead.requestId) {
            return this.pass('Successfully merged Marketo lead %s into Marketo lead %s',
                             [losingReference, winningReference],
                             [this.keyValue('mergedLead', 'Merged Lead', { id: winningLead.result[0].id, email: winningLead.result[0].email })],
            );
          } else {
            return this.fail('Failed to merge Marketo lead %s into Marketo lead %s',
                             [losingReference, winningReference],
                             [this.keyValue('mergedLead', 'Merged Lead', { id: winningLead.result[0].id, email: winningLead.result[0].email })],
            );
          }
        } else {
          return this.fail("Couldn't find a lead associated with %s%s", [
            winningReference,
            partitionId ? ` in partition ${partitionId}` : '',
          ]);
        }
      } else {
        return this.fail("Couldn't find a lead associated with %s%s", [
          losingReference,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }
    } catch (e) {
      return this.error('There was an error merging the leads: %s', [e.message]);
    }
  }
}

export { MergeLeadsStep as Step };
