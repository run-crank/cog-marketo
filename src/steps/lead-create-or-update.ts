/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';

export class CreateOrUpdateLeadByFieldStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create or update a Marketo lead';
  protected stepExpression: string = 'create or update a marketo lead';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['create', 'update'];
  protected targetObject: string = 'Lead';
  protected expectedFields: Field[] = [
    {
      field: 'partitionId',
      type: FieldDefinition.Type.NUMERIC,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'ID of partition the lead will be created',
    },
    {
      field: 'lead',
      type: FieldDefinition.Type.MAP,
      description: 'A map of field names to field values',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'lead',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Marketo ID",
    }, {
      field: 'email',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Email",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const partitionId = stepData.partitionId || 1;
    const lead = stepData.lead;

    try {
      const data: any = await this.client.createOrUpdateLead(lead, partitionId);
      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        const createdLead: any = await this.client.findLeadByEmail(lead.email, null, partitionId);
        const record = this.createRecord(createdLead.result[0]);
        const orderedRecord = this.createOrderedRecord(createdLead.result[0], stepData['__stepOrder']);
        return this.pass(
          'Successfully created or updated lead %s with status %s',
          [lead.email, data.result[0].status],
          [record, orderedRecord],
        );
      } else if (data && data.error && !data.error.partition) {
        return this.fail('There is no Partition with id %s', [
          partitionId,
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

  public createRecord(lead): StepRecord {
    return this.keyValue('lead', 'Created Lead', lead);
  }

  public createOrderedRecord(lead, stepOrder = 1): StepRecord {
    return this.keyValue(`lead.${stepOrder}`, `Created Lead from Step ${stepOrder}`, lead);
  }

}

export { CreateOrUpdateLeadByFieldStep as Step };
