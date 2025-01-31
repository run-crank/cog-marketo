/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../../proto/cog_pb';

export class AddLeadToStaticListStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add Marketo leads to static list';
  protected stepExpression: string = 'add marketo leads to static list (?<staticListName>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['add'];
  protected targetObject: string = 'Leads to Static List';
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
    description: 'Ids of Marketo Leads to be added separated by a comma(,) ',
    bulksupport: true,
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'passedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'status',
      type: FieldDefinition.Type.STRING,
      description: 'status of lead',
    }],
  }, {
    id: 'failedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'status',
      type: FieldDefinition.Type.STRING,
      description: 'status of lead',
    }, {
      field: 'reasons',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of fail',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const staticListName = stepData.staticListName;
    const programId = stepData.programId || null;

    let staticListResponse: any;
    let staticListId: Number;
    try {
      staticListResponse = await this.client.findStaticListsByName(staticListName);
    } catch (e) {
      return this.error('Error finding Static List with name %s: %s', [
        staticListName, JSON.stringify(e),
      ]);
    }

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

    let leadIds = stepData.leadIds ? stepData.leadIds.toString().replace(' ', '').split(',') : null;

    if (stepData.multiple_leadIds && Array.isArray(stepData.multiple_leadIds) && stepData.multiple_leadIds.length > 0) {
      leadIds = stepData.multiple_leadIds;
    }

    leadIds = Array.from(new Set(leadIds)); // remove any duplicates

    if (leadIds.length > 3000) {
      return this.error('Cannot add %d leads, 3000 is the maximum allowed', [stepData.multiple_leadIds.length]);
    }

    try {
      const passedLeads = [];
      const failedLeads = [];

      const batchSize = 300; // max amount of leads per request
      const batches = [];
      for (let i = 0; i < leadIds.length; i += batchSize) {
        batches.push(leadIds.slice(i, i + batchSize));
      }

      await Promise.all(batches.map(batch => new Promise(async (resolve) => {
        try {
          const data: any = await this.client.addLeadToStaticList(staticListId, batch);
          if (!data.success) {
            // If the batch failed, add each individual lead to failed array
            await batch.forEach(leadId => failedLeads.push({ id: leadId, status: 'skipped', reasons: `Batch failed with error: ${JSON.stringify(data.errors)}` }));
          } else {
            // If the batch passed, add leads to corresponding array
            await data.result.forEach((l) => {
              if (l.status === 'added') {
                passedLeads.push(l);
              } else {
                failedLeads.push(l);
              }
            });
          }
          resolve(null);
        } catch (e) {
          // If the batch failed, add each individual lead to failed array
          await batch.forEach(leadId => failedLeads.push({ id: leadId, status: 'skipped', reasons: `Batch failed with error: ${JSON.stringify(e)}` }));
        }
      })));

      const passedLeadRecord = this.createTable('passedLeads', 'Leads Added', passedLeads);
      const failedLeadRecord = this.createTable('failedLeads', 'Leads Not Added', failedLeads);

      if (passedLeads.length === leadIds.length && !failedLeads.length) {
        return this.pass('Successfully added %d leads to static list %s', [passedLeads.length, staticListName], [passedLeadRecord]);
      }

      if (passedLeads.length && failedLeads.length) {
        return this.fail('Successfully added %d out of %d leads to static list %s', [passedLeads.length, leadIds.length, staticListName], [passedLeadRecord, failedLeadRecord]);
      }

      if (failedLeads.length) {
        return this.fail('Failed to add %d leads to static list %s', [failedLeads.length, staticListName], [failedLeadRecord]);
      }

      // Something went wrong, we should have returned before this point
      return this.error('Error adding leads to smart campaign. Please contact Stack Moxie for help resolving this issue.');
    } catch (e) {
      return this.error('Error adding leads to static list %s: %s', [staticListName, JSON.stringify(e)]);
    }
  }

  createTable(id: string, name: string, leads: any[]): StepRecord {
    const headers = {
      id: 'Id',
      status: 'Status',
    };

    if (leads[0] && leads[0]['reasons']) {
      headers['reasons'] = 'Reasons';
      leads.forEach((lead, index) => {
        leads[index]['reasons'] = leads[index]['reasons'] ? JSON.stringify(leads[index]['reasons']) : '-';
      });
    }

    return this.table(id, name, headers, leads);
  }
}

export { AddLeadToStaticListStep as Step };
