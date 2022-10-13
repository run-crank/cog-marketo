/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';

export class DiscoverLead extends BaseStep implements StepInterface {

  protected stepName: string = 'Discover fields on a Marketo Lead';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'discover fields on marketo lead (?<email>.+)';
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
    }, {
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: "Lead's Email",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Lead's Create Date",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Lead's Update Date",
    }, {
      field: 'firstName',
      type: FieldDefinition.Type.STRING,
      description: "Lead's First Name",
    }, {
      field: 'lastName',
      type: FieldDefinition.Type.STRING,
      description: "Lead's Last Name",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const reference = stepData.email;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      if (emailRegex.test(reference)) {
        lookupField = 'email';
      }

      const data: any = await this.client.findLeadByField(lookupField, reference, [], partitionId);
      if (data.success && data.result && data.result[0]) {
        const result = data.result[0];
        const record = this.createRecord(result);
        const orderedRecord = this.createOrderedRecord(result, stepData['__stepOrder']);
        return this.pass('Successfully discovered fields on lead', [], [record, orderedRecord]);
      } else if (data.success && data.result.length === 0) {
        return this.fail("Couldn't find a lead associated with %s%s", [
          reference,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }
    } catch (e) {
      return this.error('There was a problem checking the Lead: %s', [e.message]);
    }
  }

  createRecord(lead: Record<string, any>): StepRecord {
    return this.keyValue('discoverLead', 'Discovered Lead', lead);
  }

  createOrderedRecord(lead, stepOrder = 1): StepRecord {
    return this.keyValue(`discoverLead.${stepOrder}`, `Discovered Lead from Step ${stepOrder}`, lead);
  }
}

export { DiscoverLead as Step };
