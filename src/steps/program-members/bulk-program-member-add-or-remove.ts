/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class BulkAddOrRemoveProgramMemberStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Bulk add or remove Marketo program members';
  protected stepExpression: string = 'bulk add or remove marketo program members';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['add', 'remove'];
  protected targetObject: string = 'Program Member';
  protected expectedFields: Field[] = [
    {
      field: 'partitionId',
      type: FieldDefinition.Type.NUMERIC,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'ID of partition the lead will be created',
    },
    {
      field: 'programId',
      type: FieldDefinition.Type.STRING,
      description: 'ID of the program',
    },
    {
      field: 'memberStatus',
      type: FieldDefinition.Type.STRING,
      description: 'Status to set on the members',
    },
    {
      field: 'leads',
      type: FieldDefinition.Type.MAP,
      description: 'A map of field names to field values',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'leads',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Marketo ID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const partitionId = stepData.partitionId || 1;
    const programId = stepData.programId;
    const status = stepData.memberStatus;
    const leads: {[index: string]: {email: string}} = stepData.leads;
    const leadArray = [];

    Object.values(leads).forEach((lead) => {
      leadArray.push(lead.email);
    });

    const records = [];
    try {
      const createdLeadArray = [];
      const updatedLeadArray = [];
      const deletedLeadArray = [];
      const failedLeadArray = [];

      // we should parse out the original CSV array if provided, or handle it if missing
      const csvArray = stepData.csvArray ? JSON.parse(stepData.csvArray) : [];
      const csvColumns = csvArray[0];
      const csvRows = csvArray.slice(1);
      const failArrayOriginal = csvColumns ? [csvColumns] : [];

      let data: any = [];
      if (status === 'Not in Program') {
        data = await this.client.bulkRemoveLeadsFromProgram(leadArray, programId, partitionId);
      } else {
        data = await this.client.bulkSetStatusToLeadsFromProgram(leadArray, programId, status, partitionId);
      }

      if (data[0] && data[0].error && !data[0].error.partition) {
        return this.fail('There is no Partition with id %s', [
          partitionId,
        ]);
      }

      // Sort each batch of leads into created, updated, and failed
      data.forEach((batch, i) => {
        const startingIndex = i * 300;
        if (batch.success && batch.result) {
          batch.result.forEach((result, index) => {
            const leadArrayIndex = startingIndex + index;
            if (result.status !== 'skipped') {
              if (result.status === 'updated') {
                updatedLeadArray.push({ email: leadArray[leadArrayIndex], id: result.leadId });
              }
              if (result.status === 'created') {
                createdLeadArray.push({ email: leadArray[leadArrayIndex], id: result.leadId });
              }

              if (result.status === 'deleted') {
                deletedLeadArray.push({ email: leadArray[leadArrayIndex], id: result.leadId });
              }
            } else if (result.reasons && result.reasons[0]) {
              failedLeadArray.push({ email: leadArray[leadArrayIndex], message: result.reasons[0].message });

              // also preserve the original csv entry;
              const match = csvRows[leadArrayIndex];
              if (match) {
                failArrayOriginal.push(match);
              }

            } else {
              failedLeadArray.push({ email: leadArray[leadArrayIndex], message: result.status });

              const match = csvRows[leadArrayIndex];
              if (match) {
                failArrayOriginal.push(match);
              }
            }
          });
        } else {
          // if the entire batch failed
          const failedMembers = leadArray.slice(startingIndex, startingIndex + 300);
          failedMembers.forEach((leadEmail, index) => {
            failedLeadArray.push({ email: leadEmail, message: 'Marketo request failed' });
            const match = csvRows[startingIndex + index];
            if (match) {
              failArrayOriginal.push(match);
            }
          });
        }
      });

      const returnedLeadsCount = updatedLeadArray.length + createdLeadArray.length + failedLeadArray.length + deletedLeadArray.length;
      if (returnedLeadsCount === 0) {
        return this.fail('No program members were add or removed in Marketo', [], []);
      } else if (leadArray.length !== returnedLeadsCount) {
        records.push(this.createTable('createdMembers', 'Members Created', createdLeadArray));
        records.push(this.createTable('updatedMembers', 'Members Updated', updatedLeadArray));
        records.push(this.createTable('deletedMembers', 'Members Deleted', deletedLeadArray));
        records.push(this.createTable('failedMembers', 'Members Failed', failedLeadArray));
        records.push(this.keyValue('failedOriginal', 'Objects Failed (Original format)', { array: JSON.stringify(failArrayOriginal) }));
        return this.fail(
          'Only %d of %d leads were successfully sent to Marketo',
          [returnedLeadsCount, leadArray.length],
          records,
        );
      } else if (!failedLeadArray.length) {
        records.push(this.createTable('createdMembers', 'Members Created', createdLeadArray));
        records.push(this.createTable('updatedMembers', 'Members Updated', updatedLeadArray));
        records.push(this.createTable('deletedMembers', 'Members Deleted', deletedLeadArray));
        return this.pass(
          'Successfully created %d leads updated %d leads and removed %d leads',
          [createdLeadArray.length, updatedLeadArray.length, deletedLeadArray.length],
          records,
        );
      } else {
        records.push(this.createTable('createdMembers', 'Members Created', createdLeadArray));
        records.push(this.createTable('updatedMembers', 'Members Updated', updatedLeadArray));
        records.push(this.createTable('deletedMembers', 'Members Deleted', deletedLeadArray));
        records.push(this.createTable('failedMembers', 'Members Failed', failedLeadArray));
        records.push(this.keyValue('failedOriginal', 'Objects Failed (Original format)', { array: JSON.stringify(failArrayOriginal) }));
        return this.fail(
          'Failed to add or remove %d members',
          [failedLeadArray.length],
          records,
        );
      }
    } catch (e) {
      return this.error('There was an error adding or removing members in Marketo: %s', [
        e.toString(),
      ]);
    }
  }

  private createTable(id, name, leads) {
    const headers = {};
    const headerKeys = Object.keys(leads[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table(id, name, headers, leads);
  }
}

export { BulkAddOrRemoveProgramMemberStep as Step };
