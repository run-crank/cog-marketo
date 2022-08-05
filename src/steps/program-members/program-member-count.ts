/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class ProgramMemberCountStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Count a Marketo Program';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'check the number of members from marketo program (?<programName>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'programName',
    type: FieldDefinition.Type.STRING,
    description: "Program's Name",
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
    const programName = stepData.programName;

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
        return this.pass('Program %s has %s members', [programName, data.result.length], [this.createRecord(program.result[0].id, data.result.length), this.createOrderedRecord(program.result[0].id, data.result.length, stepData['__stepOrder']), this.createTable(data.result)]);
      } else {
        return this.error('There was an error while checking program member count');
      }
    } catch (e) {
      return this.error('There was an error while checking program member count: %s', [e.message]);
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

  createOrderedRecord(programId: string, count: number, stepOrder = 1) {
    const record = {
      programId,
      programMemberCount: count,
    };
    return this.keyValue(`programMember.${stepOrder}`, `Checked Program Member Count from Step ${stepOrder}`, record);
  }
}

export { ProgramMemberCountStep as Step };
