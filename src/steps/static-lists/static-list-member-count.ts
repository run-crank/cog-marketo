/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';

export class StaticListMemberCountStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Count a Marketo Static List';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'check the number of members from marketo static list (?<staticListName>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'staticListName',
    type: FieldDefinition.Type.STRING,
    description: "Static List's Name",
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
    const staticListName = stepData.staticListName;

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
        return this.pass('Static List %s has %s members', [staticListName, data.result.length], [this.createRecord(staticList.result[0].id, data.result.length), this.createOrderedRecord(staticList.result[0].id, data.result.length, stepData['__stepOrder']), this.createTable(data.result)]);
      } else {
        return this.error('There was an error while checking program static list member count');
      }
    } catch (e) {
      return this.error('There was an error while checking program static list member count: %s', [e.message]);
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

  createOrderedRecord(staticListId: string, count: number, stepOrder = 1) {
    const record = {
      staticListId,
      staticListMemberCount: count,
    };
    return this.keyValue(`staticListMember.${stepOrder}`, `Checked Static List Member Count from Step ${stepOrder}`, record);
  }
}

export { StaticListMemberCountStep as Step };
