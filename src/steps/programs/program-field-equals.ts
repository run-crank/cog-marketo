/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';
import { isNullOrUndefined } from 'util';

export class ProgramFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Program';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo program (?<name>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'name',
    type: FieldDefinition.Type.STRING,
    description: "Program's name",
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
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'program',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Program's Marketo ID",
    }, {
      field: 'name',
      type: FieldDefinition.Type.EMAIL,
      description: "Program's name",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Program's Create Date",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Program's Update Date",
    }, {
      field: 'folder',
      type: FieldDefinition.Type.STRING,
      description: 'The folder where the program belongs to',
    }, {
      field: 'type',
      type: FieldDefinition.Type.STRING,
      description: 'Type of the program',
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectedValue = stepData.expectation;
    const name = stepData.name;
    const operator: string = stepData.operator || 'be';
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const field = stepData.field;

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      const data: any = await this.client.findProgramsByName(name);
      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty(field)) {
        let result;
        const totalCost = this.getTotalProjectCost(data.result[0]);
        data.result[0].costs = totalCost;
        if (field === 'folder') {
          result = this.assert(operator, data.result[0]['folder']['folderName'], expectedValue, field);
        } else if (field === 'costs') {
          result = this.assert(operator, totalCost.toString(), expectedValue, field);
        } else {
          result = this.assert(operator, data.result[0][field].trim(), expectedValue.trim(), field);
        }

        return result.valid ? this.pass(result.message, [], [this.createRecord(data.result[0])])
          : this.fail(result.message, [], [this.createRecord(data.result[0])]);

      } else {
        if (data.result && data.result[0] && !data.result[0][field]) {
          return this.fail(
            'Found the %s program, but there was no %s field.',
            [name, field],
            [this.createRecord(data.result[0])],
          );
        } else {
          return this.fail("Couldn't find a program associated with %s%s", [
            name,
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

  createRecord(program: Record<string, any>) {
    return this.keyValue('program', 'Checked Program', program);
  }

  getTotalProjectCost(program: Record<string, any>) {
    let result = 0;
    if (program.costs && program.costs.length > 0) {
      program.costs.forEach((c: any) => {
        result += c.cost;
      });
    }

    return result;
  }
}

export { ProgramFieldEqualsStep as Step };
