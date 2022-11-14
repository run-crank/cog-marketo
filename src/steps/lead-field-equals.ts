/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class LeadFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Lead';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+\@.+\..+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'email', // to prevent breaking previous scenarios, this is will stay as email
    type: FieldDefinition.Type.STRING,
    description: "Lead's email address or id",
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
  }, {
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
    const reference = stepData.email;
    const operator: string = stepData.operator || 'be';
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const field = stepData.field;
    let expectedValue = stepData.expectation;
    let dynamicExpectation = false;

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    if (stepData.multiple_email && Array.isArray(stepData.multiple_email) && stepData.multiple_email.length > 0) {
      try {
        // Checking multiple leads
        const emailArray = stepData.multiple_email;
        const successArray = [];
        const failArray = [];
        const data: any = await this.client.bulkFindLeadsByEmail(emailArray, field, partitionId);
        const indexMap = {}; // Only needed if using dynamic multiple leads with different expected values

        // Check if the expectedValue is dynamic
        if (stepData.multiple_expectation && Array.isArray(stepData.multiple_expectation) && stepData.multiple_expectation.length > 0) {
          dynamicExpectation = true;
          expectedValue = stepData.multiple_expectation;

          if (emailArray.length !== expectedValue.length) {
            return this.fail('Number of leads provided did not match number of expected values provided', [], []);
          }

          emailArray.forEach((email: string, index: number) => {
            indexMap[email] = expectedValue[index];
          });
        }

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
            batch.result.forEach((result, j) => {
              if (result.hasOwnProperty(field)) {
                const currExpectedValue = dynamicExpectation ? indexMap[result.email] : expectedValue;
                const assertResult = this.assert(operator, result[field], currExpectedValue, field, stepData['__piiSuppressionLevel']);
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

    } else {
      // Only checking one lead
      try {
        const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
        let lookupField = 'id';
        if (emailRegex.test(reference)) {
          lookupField = 'email';
        }

        const data: any = await this.client.findLeadByField(lookupField, reference, field, partitionId);

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
              [reference, field],
              [record, orderedRecord],
            );
          } else {
            return this.fail("Couldn't find a lead associated with %s%s", [
              reference,
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
  }

  createRecord(lead: Record<string, any>): StepRecord {
    return this.keyValue('lead', 'Checked Lead', lead);
  }

  createOrderedRecord(lead, stepOrder = 1): StepRecord {
    return this.keyValue(`lead.${stepOrder}`, `Created Lead from Step ${stepOrder}`, lead);
  }

  createTable(id: string, name: string, leads: any[]): StepRecord {
    const headers = {};
    const headerKeys = Object.keys(leads[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table(id, name, headers, leads);
  }

}

export { LeadFieldEqualsStep as Step };
