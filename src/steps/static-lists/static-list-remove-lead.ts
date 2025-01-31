/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class RemoveLeadToStaticListStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Remove Marketo leads from static list';
  protected stepExpression: string = 'remove marketo leads from static list (?<staticListName>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['remove'];
  protected targetObject: string = 'Leads from Static List';
  protected expectedFields: Field[] = [{
    field: 'staticListName',
    type: FieldDefinition.Type.STRING,
    description: "Static List's Name",
  }, {
    field: 'programId',
    type: FieldDefinition.Type.NUMERIC,
    description: 'Program Id',
    optionality: FieldDefinition.Optionality.OPTIONAL,
    help: 'Used to filter the static lists if there are multiple static lists with the same name',
  }, {
    field: 'leadIds',
    type: FieldDefinition.Type.STRING,
    description: 'Ids of Marketo Leads to be removed separated by a comma(,) ',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'staticListRemove',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const staticListName = stepData.staticListName;
    const programId = stepData.programId || null;
    const leadIds = stepData.leadIds.toString();

    let staticListId: Number;
    try {
      // Check if staticList exists and also get the id
      const staticListResponse: any = await this.client.findStaticListsByName(staticListName);

      if (!staticListResponse.result || (staticListResponse.result && staticListResponse.result.length === 0)) {
        return this.error('Static List with name %s does not exist', [
          staticListName,
        ]);
      }

      if (programId && staticListResponse.result && staticListResponse.result.length > 1) {
        const matchingStaticLists = staticListResponse.result.filter(list => list.folder.id === programId);

        if (matchingStaticLists && matchingStaticLists.length !== 1) {
          return this.error('Multiple Static Lists with name %s exist in Program with id %s', [
            staticListName,
            programId,
          ]);
        }

        staticListId = matchingStaticLists[0].id;
      } else {
        staticListId = staticListResponse.result[0].id;
      }

      const data: any = await this.client.removeLeadToStaticList(staticListId, leadIds.replace(' ', '').split(','));

      if (data.success && data.result.find(l => l.status !== 'removed')) {
        return this.fail('Failed to remove all leads to static list %s', [staticListName], [this.createTable(data.result)]);
      }

      if (data.success && data.result) {
        return this.pass('Successfully removed leads to static list %s', [staticListName], [this.createTable(data.result)]);
      }

      return this.error('Failed to remove leads to static list %s', [staticListName]);
    } catch (e) {
      return this.error('There was an error removing leads to static list %s : %s', [staticListName, e.message]);
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

    return this.table('staticListRemove', 'Static List Members Removed', headers, staticListMember);
  }
}

export { RemoveLeadToStaticListStep as Step };
