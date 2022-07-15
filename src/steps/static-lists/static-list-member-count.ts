/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';

export class StaticListMemberCountStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check the number of a Marketo Static List Members';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the number of members from marketo static list (?<staticListName>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'staticListName',
    type: FieldDefinition.Type.STRING,
    description: "Static List's Name",
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
    id: 'staticListMember',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'staticListId',
      type: FieldDefinition.Type.STRING,
      description: "Static List's Marketo ID",
    }, {
      field: 'staticListMemberCount',
      type: FieldDefinition.Type.STRING,
      description: "Static List's Member Count",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectedValue = stepData.expectation;
    const staticListName = stepData.staticListName;
    const operator: string = stepData.operator || 'be set';

    if ((expectedValue === null || expectedValue === undefined) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      // Check if staticList exists and also get the id
      const staticList: any = await this.client.findStaticListsByName(staticListName);

      if (!staticList.result || (staticList.result && staticList.result.length === 0)) {
        return this.error('Static List with name %s does not exist', [
          staticListName,
        ]);
      }

      const data: any = await this.client.findStaticListsMembershipByListId(staticList.result[0].id);

      if (data.success && data.result) {
        let result;
        result = this.assert(operator, data.result.length, expectedValue, 'member count');

        result.message = result.message.replace(' field', ''); // Just to remove the word 'field' in the result message
        return result.valid ? this.pass(result.message, [], [this.createRecord(staticList.result[0].id, data.result.length), this.createTable(data.result)])
          : this.fail(result.message, [], [this.createRecord(staticList.result[0].id, data.result.length), this.createTable(data.result)]);
      }
    } catch (e) {
      if (e instanceof util.UnknownOperatorError) {
        return this.error('%s Please provide one of: %s', [e.message, baseOperators.join(', ')]);
      }
      if (e instanceof util.InvalidOperandError) {
        return this.error(e.message);
      }
      return this.error('There was an error during validation of staticList field: %s', [e.message]);
    }
  }

  createRecord(staticListId: string, count: number) {
    const record = {
      staticListId,
      staticListMemberCount: count,
    };
    return this.keyValue('staticListMember', 'Checked Static List Member Count', record);
  }

  createTable(staticListMember: Record<string, any>[]) {
    const headers = {};
    const headerKeys = Object.keys(staticListMember[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table('staticListMemberList', 'Checked Static List Member', headers, staticListMember);
  }
}

export { StaticListMemberCountStep as Step };
