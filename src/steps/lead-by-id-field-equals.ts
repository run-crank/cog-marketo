/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class LeadByIdFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo lead by ID';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo lead with id (?<leadId>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected actionList: string[] = ['check'];
  protected targetObject: string = 'Lead by ID';
  protected expectedFields: Field[] = [{
    field: 'leadId',
    type: FieldDefinition.Type.STRING,
    description: "Lead's Id",
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  }, {
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Check Logic (be, not be, contain, not contain, be greater than, be less than, be set, not be set, be one of, or not be one of)',
  }, {
    field: 'expectation',
    type: FieldDefinition.Type.ANYSCALAR,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Expected field value',
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
    const expectedValue = stepData.expectation;
    const leadId = stepData.leadId;
    const operator: string = stepData.operator || 'be';
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const field = stepData.field;

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      const data: any = await this.client.findLeadByField('id', leadId, field, partitionId);

      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty(field)) {
        const result = this.assert(operator, data.result[0][field], expectedValue, field, stepData['__piiSuppressionLevel']);
        const record = this.createRecord(data.result[0]);
        const orderedRecord = this.createOrderedRecord(data.result[0], stepData['__stepOrder']);
        return result.valid ? this.pass(result.message, [], [record, orderedRecord])
          : this.fail(result.message, [], [record, orderedRecord]);

      } else {
        const record = this.createRecord(data.result[0]);
        const orderedRecord = this.createOrderedRecord(data.result[0], stepData['__stepOrder']);
        if (data.result && data.result[0] && !data.result[0][field]) {
          return this.fail(
            'Found the %s lead, but there was no %s field.',
            [leadId, field],
            [record, orderedRecord],
          );
        } else {
          return this.fail("Couldn't find a lead associated with %s%s", [
            leadId,
            partitionId ? ` in partition ${partitionId}` : '',
          ]);
        }
      }
    } catch (e) {
      if (e instanceof util.UnknownOperatorError) {
        return this.error('%s Please provide one of: %s', [e.message, baseOperators.join(', ')]);
      }
      if (e instanceof util.InvalidOperandError) {
        return this.error(e.message);
      }
      return this.error('There was an error during validation of lead field: %s', [e.message]);
    }
  }

  createRecord(lead: Record<string, any>): StepRecord {
    return this.keyValue('lead', 'Checked Lead', lead);
  }

  createOrderedRecord(lead, stepOrder = 1): StepRecord {
    return this.keyValue(`lead.${stepOrder}`, `Created Lead from Step ${stepOrder}`, lead);
  }
}

export { LeadByIdFieldEqualsStep as Step };
