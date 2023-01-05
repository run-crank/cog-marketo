/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class AddOrRemoveProgramMemberStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add or Remove Marketo Program Members';
  protected stepExpression: string = 'add or remove marketo program members';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
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
      field: 'email',
      type: FieldDefinition.Type.STRING,
      description: "Lead's email or ID",
      bulksupport: true,
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'passedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'email',
      type: FieldDefinition.Type.NUMERIC,
      description: 'email of Marketo Lead',
    }, {
      field: 'status',
      type: FieldDefinition.Type.STRING,
      description: 'status of lead',
    }],
  }, {
    id: 'failedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.NUMERIC,
      description: 'email of Marketo Lead',
    }, {
      field: 'reasons',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of fail',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const partitionId = stepData.partitionId || null;
    const programId = stepData.programId;
    const status = stepData.memberStatus;
    const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
    let leadEmailArray = [];

    if (stepData.multiple_email && Array.isArray(stepData.multiple_email) && stepData.multiple_email.length > 0) {
      // handle bulk tokens

      // If the user provided emails
      if (emailRegex.test(stepData.multiple_email[0])) {
        leadEmailArray = JSON.parse(JSON.stringify(stepData.multiple_email));
        let count = 0;
        const bulkFindLeadResponse = await this.client.bulkFindLeadsByEmail(stepData.multiple_email, null, partitionId);
        await bulkFindLeadResponse.forEach(async (batch) => {
          if (!batch.success) {
            return this.error('There was an error finding some lead IDs in partition %d: %s', [partitionId, batch.message]);
          }
          count += batch.result.length;
        });

        if (count !== stepData.multiple_email.length) {
          return this.error('Could not find all leads provided in partition %d', [partitionId]);
        }

      } else {
        // If the user provided IDs rather than emails, we need to get the lead emails now for a few reasons (despite being inefficient):
        // - that is what the mixins accept, and we can't adjust the mixins wihout also adjusting the other steps that use them
        // - Marketo's API doesn't return the ID or email for failed records, so we need to know the email in advance so we can return it in the step record

        let count = 0;
        const bulkFindLeadResponse = await this.client.bulkFindLeadsById(stepData.multiple_email, null, partitionId);
        await bulkFindLeadResponse.forEach(async (batch) => {
          if (!batch.success) {
            return this.error('There was an error finding some leads in partition %d: %s', [partitionId, batch.message]);
          }

          await batch.result.forEach((lead) => {
            if (!partitionId || (lead.leadPartitionId && lead.leadPartitionId == partitionId)) {
              count += 1;
              leadEmailArray.push(lead.email);
            }
          });
        });

        if (count !== stepData.multiple_email.length) {
          return this.error('Could not find all leads provided in partition %d', [partitionId]);
        }

      }
    } else {
      // handle single email/ID
      if (emailRegex.test(stepData.email)) {
        const response = await this.client.findLeadByEmail(stepData.email, null, partitionId);
        if (!response.success) {
          return this.error('There was an error finding lead %d in partition %d', [stepData.email, partitionId]);
        }
        leadEmailArray.push(stepData.email);
      } else {
        try {
          const response = await this.client.findLeadByField('id', stepData.email, null, partitionId);
          const email = response.result[0].email;
          if (!response.success || !email) {
            return this.error('There was an error finding lead %d in partition %d', [stepData.email, partitionId]);
          }
          leadEmailArray.push(email);
        } catch (e) {
          return this.error('There was an error finding lead %d in partition %d', [stepData.email, partitionId]);
        }
      }
    }

    try {
      const records = [];
      const passedLeadArray = [];
      const failedLeadArray = [];

      let data: any = [];
      if (status === 'Not in Program') {
        data = await this.client.bulkRemoveLeadsFromProgram(leadEmailArray, programId, partitionId);
      } else {
        data = await this.client.bulkSetStatusToLeadsFromProgram(leadEmailArray, programId, status, partitionId);
      }

      if (partitionId && data[0] && data[0].error && !data[0].error.partition) {
        return this.fail('There is no Partition with id %s', [
          partitionId,
        ]);
      }

      // Sort each batch of leads into passed and failed
      data.forEach((batch, i) => {
        const startingIndex = i * 300;
        if (batch.success && batch.result) {
          batch.result.forEach((result, index) => {
            const leadArrayIndex = startingIndex + index;
            if (result.status !== 'skipped') {
              passedLeadArray.push({ email: leadEmailArray[leadArrayIndex], id: result.leadId, status: result.status });
            } else if (result.reasons && result.reasons[0]) {
              failedLeadArray.push({ email: leadEmailArray[leadArrayIndex], message: result.reasons[0].message });
            } else {
              failedLeadArray.push({ email: leadEmailArray[leadArrayIndex], message: result.status });
            }
          });
        } else {
          // if the entire batch failed
          const failedMembers = leadEmailArray.slice(startingIndex, startingIndex + 300);
          failedMembers.forEach((leadEmail) => {
            failedLeadArray.push({ email: leadEmail, message: 'Marketo request failed' });
          });
        }
      });

      const returnedLeadsCount = passedLeadArray.length + failedLeadArray.length;

      if (returnedLeadsCount === 0) {
        return this.fail('No program members were added or removed in Marketo');
      }

      if (passedLeadArray.length === returnedLeadsCount) {
        records.push(this.createTable('passedLeads', `Members ${status === 'Not in Program' ? 'Removed' : 'Added'}`, passedLeadArray));
        return this.pass(
          `Successfully ${status === 'Not in Program' ? 'removed' : 'added'} %d members`,
          [passedLeadArray.length],
          records,
        );
      }

      if (passedLeadArray.length && failedLeadArray.length) {
        records.push(this.createTable('passedLeads', `Members ${status === 'Not in Program' ? 'Removed' : 'Added'}`, passedLeadArray));
        records.push(this.createTable('failedLeads', 'Members Failed', failedLeadArray));
        return this.fail(
          `${status === 'Not in Program' ? 'Removed' : 'Added'} %d out of %d members`,
          [passedLeadArray.length, returnedLeadsCount],
          records,
        );
      }

      if (failedLeadArray.length) {
        records.push(this.createTable('failedLeads', 'Members Failed', failedLeadArray));
        return this.fail(
          `Failed to ${status === 'Not in Program' ? 'remove' : 'add'} %d members`,
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

export { AddOrRemoveProgramMemberStep as Step };
