/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class BulkLeadFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on multiple Marketo Leads';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo leads should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'leads',
    type: FieldDefinition.Type.MAP,
    description: 'Leads to check',
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
    id: 'passedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'Email of Marketo Lead',
    }, {
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'message',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of pass',
    }],
  }, {
    id: 'failedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'Email of Marketo Lead',
    }, {
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'message',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of fail',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectedValue = stepData.expectation;
    const operator: string = stepData.operator || 'be';
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const field = stepData.field;
    const leads: {[index: string]: {email: string}} = stepData.leads;
    const emailArray = [];

    Object.values(leads).forEach((lead) => {
      emailArray.push(lead.email);
    });

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      const successArray = [];
      const failArray = [];
      const data: any = await this.client.bulkFindLeadsByEmail(emailArray, field, partitionId);

      // Sort each batch of leads into successArray and failArray
      data.forEach((batch, i) => {
        const startingIndex = i * 300;
        const emailSubarray = emailArray.slice(startingIndex, startingIndex + 300);
        if (batch.success && batch.result) {
          // If an email is missing from the response, then add it to the failArray
          emailSubarray.forEach((email) => {
            if (batch.result.filter(result => email === result.email).length === 0) {
              failArray.push({ email, id: null,  message: `Couldn't find lead associated with ${email}` });
            }
          });
          batch.result.forEach((result) => {
            if (result.hasOwnProperty(field)) {
              const assertResult = this.assert(operator, result[field], expectedValue, field, stepData['__piiSuppressionLevel']);
              if (assertResult.valid) {
                successArray.push({ email: result.email, id: result.id, message: assertResult.message });
              } else {
                failArray.push({ email: result.email, id: result.id, message: assertResult.message });
              }
            } else {
              failArray.push({ email: result.email, id: result.id, message: `Found the lead, but there was no ${field} field` });
            }
          });
        } else {
          // The entire batch will go in the failedArray if the response.success isn't truthy
          emailSubarray.forEach((email) => {
            failArray.push({ email, id: null,  message: `Marketo request failed for ${email}` });
          });
        }
      });

      const returnedLeadsCount = successArray.length + failArray.length;
      const records = [];

      if (returnedLeadsCount === 0) {
        // No leads returned from Marketo
        return this.fail('There was an error finding the leads in Marketo', [], []);
      } else if (emailArray.length !== returnedLeadsCount) {
        // Not all leads were returned from Marketo
        records.push(this.createTable('failedLeads', 'Leads Failed', failArray));
        records.push(this.createTable('passedLeads', 'Leads Passed', successArray));
        return this.fail(
          'Found %d of %d leads where the %s field was found to %s %s',
          [successArray.length , emailArray.length, field, operator, expectedValue],
          records,
        );
      } else if (!failArray.length) {
        // If there are no failures, return a pass
        records.push(this.createTable('passedLeads', 'Leads Passed', successArray));
        return this.pass(
          'Successfully checked %d leads',
          [successArray.length],
          records,
        );
      } else {
        records.push(this.createTable('failedLeads', 'Leads Failed', failArray));
        records.push(this.createTable('passedLeads', 'Leads Passed', successArray));
        return this.fail(
          'Found %d of %d leads where the %s field was found to %s %s',
          [successArray.length , emailArray.length, field, operator, expectedValue],
          records,
        );
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

  private createTable(id, name, leads) {
    const headers = {};
    const headerKeys = Object.keys(leads[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table(id, name, headers, leads);
  }
}

export { BulkLeadFieldEqualsStep as Step };
