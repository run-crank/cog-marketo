/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class ProgramMemberCountStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check the number of a Marketo Program Members';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the number of members from marketo program (?<programName>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'programName',
    type: FieldDefinition.Type.STRING,
    description: "Program's Name",
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
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'programMember',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'programId',
      type: FieldDefinition.Type.STRING,
      description: "Program's Marketo ID",
    }, {
      field: 'programMemberCount',
      type: FieldDefinition.Type.STRING,
      description: "Program's Member Count",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectedValue = stepData.expectation;
    const programName = stepData.programName;
    const operator: string = stepData.operator || 'be set';

    if ((expectedValue === null || expectedValue === undefined) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      // Check if program exists and also get the id
      const program: any = await this.client.findProgramsByName(programName);
      if (program.result && program.result.length === 0) {
        return this.error('Program with name %s does not exist', [
          programName,
        ]);
      }

      // Get all available fields to be included when getting program member
      const memberFields: any = (await this.client.getProgramMembersFields()).result[0]['fields'].map(f => f.name);

      const data: any = await this.client.getProgramMembersByFilterValue(program.result[0].id, 'reachedSuccess', true, memberFields);

      if (data.success && data.result) {
        let result;
        result = this.assert(operator, data.result.length, expectedValue, 'member count');

        result.message = result.message.replace(' field', ''); // Just to remove the word 'field' in the result message
        return result.valid ? this.pass(result.message, [], [this.createRecord(program.result[0].id, data.result.length), this.createTable(data.result)])
          : this.fail(result.message, [], [this.createRecord(program.result[0].id, data.result.length), this.createTable(data.result)]);
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

  createRecord(programId: string, count: number) {
    const record = {
      programId,
      programMemberCount: count,
    };
    return this.keyValue('programMember', 'Checked Program Member Count', record);
  }

  createTable(programMembers: Record<string, any>[]) {
    const headers = {};
    const headerKeys = Object.keys(programMembers[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table('programMemberList', 'Checked Program Member', headers, programMembers);
  }
}

export { ProgramMemberCountStep as Step };
