/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class AddLeadToStaticListStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add Marketo Leads to Static List';
  protected stepExpression: string = 'add marketo leads to static list (?<staticListName>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'staticListName',
    type: FieldDefinition.Type.STRING,
    description: "Static List's Name",
  }, {
    field: 'leadIds',
    type: FieldDefinition.Type.STRING,
    description: 'Ids of Marketo Leads to be added separated by a comma(,) ',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'staticListAdd',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const staticListName = stepData.staticListName;
    const leadIds = stepData.leadIds;

    try {
      // Check if staticList exists and also get the id
      const staticList: any = await this.client.findStaticListsByName(staticListName);

      if (!staticList.result || (staticList.result && staticList.result.length === 0)) {
        return this.error('Static List with name %s does not exist', [
          staticListName,
        ]);
      }

      const data: any = await this.client.addLeadToStaticList(staticList.result[0].id, leadIds.replace(' ', '').split(','));

      if (data.success && data.result.find(l => l.status !== 'added')) {
        return this.fail('Failed to add all leads to static list %s', [staticListName], [this.createTable(data.result)]);
      }

      if (data.success && data.result) {
        return this.pass('Successfully added leads to static list %s', [staticListName], [this.createTable(data.result)]);
      }

      return this.error('Failed to add leads to static list %s', [staticListName]);
    } catch (e) {
      return this.error('There was an error adding leads to static list %s : %s', [staticListName, e.message]);
    }
  }

  createTable(staticListMember: Record<string, any>[]) {
    const headers = {
      id: 'Id',
      status: 'Status',
      reasons: 'Reasons',
    };

    staticListMember.forEach((slm, index) => {
      staticListMember[index]['reasons'] = staticListMember[index]['reasons'] ? JSON.stringify(staticListMember[index]['reasons']) : '-';
    });

    return this.table('staticListAdd', 'Static List Members Added', headers, staticListMember);
  }
}

export { AddLeadToStaticListStep as Step };
