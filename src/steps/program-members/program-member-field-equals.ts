/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class ProgramMemberFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Program Member';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo member (?<email>.+) from program (?<programName>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'programName',
    type: FieldDefinition.Type.STRING,
    description: "Program's Name",
  }, {
    field: 'email', // to prevent breaking previous scenarios, this is will stay as email
    type: FieldDefinition.Type.STRING,
    description: "Lead's email or id",
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
    id: 'programMember',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'leadId',
      type: FieldDefinition.Type.STRING,
      description: "Lead's Marketo ID",
    }, {
      field: 'programId',
      type: FieldDefinition.Type.STRING,
      description: "Program's Marketo ID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectedValue = stepData.expectation;
    const programName = stepData.programName;
    const reference = stepData.email;
    const operator: string = stepData.operator || 'be';
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const field = stepData.field;

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      if (emailRegex.test(reference)) {
        lookupField = 'email';
      }

      // Check if lead exists and also get the id
      const lead: any = await this.client.findLeadByField(lookupField, reference, null, partitionId);
      if (lead.result.length === 0) {
        return this.error('Lead with email %s does not exist%s', [
          reference,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }

      // Check if program exists and also get the id
      const program: any = await this.client.findProgramsByName(programName);
      if (program.result.length === 0) {
        return this.error('Program with name %s does not exist', [
          programName,
        ]);
      }

      // Get all available fields to be included when getting program member
      const memberFields: any = (await this.client.getProgramMembersFields()).result[0]['fields'].map(f => f.name);

      const data: any = await this.client.getProgramMembersByFilterValue(program.result[0].id, 'leadId', lead.result[0].id, memberFields);

      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty(field)) {
        let result;
        result = this.assert(operator, data.result[0][field], expectedValue, field, stepData['__piiSuppressionLevel']);
        const record = this.createRecord(data.result[0]);
        const orderedRecord = this.createOrderedRecord(data.result[0], stepData['__stepOrder']);
        return result.valid ? this.pass(result.message, [], [record, orderedRecord])
          : this.fail(result.message, [], [record, orderedRecord]);

      } else {
        const record = this.createRecord(data.result[0]);
        const orderedRecord = this.createOrderedRecord(data.result[0], stepData['__stepOrder']);
        if (data.result && data.result[0] && !data.result[0][field]) {
          return this.fail(
            'Found the %s program member, but there was no %s field.',
            [reference, field],
            [record, orderedRecord],
          );
        } else {
          return this.fail("Couldn't find a program member associated with %s%s", [
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
      return this.error('There was an error during validation of program field: %s', [e.message]);
    }
  }

  createRecord(programMember: Record<string, any>): StepRecord {
    return this.keyValue('program', 'Checked Program Member', programMember);
  }

  createOrderedRecord(programMember: Record<string, any>, stepOrder = 1): StepRecord {
    return this.keyValue(`program.${stepOrder}`, `Checked Program Member from Step ${stepOrder}`, programMember);
  }
}

export { ProgramMemberFieldEqualsStep as Step };
