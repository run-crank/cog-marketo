/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';

export class AddLeadToSmartCampaignStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add Marketo Lead to Smart Campaign';
  protected stepExpression: string = 'add the (?<email>.+) marketo lead to smart campaign (?<campaign>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.STRING,
    description: "Lead's email address or id",
    bulkSupport: true,
  }, {
    field: 'campaign',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Smart campaign name or numeric id',
  }, {
    field: 'partitionId',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'ID of partition lead belongs to',
    help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'lead',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Marketo ID",
    }, {
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: "Lead's Email",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Lead's Create Date",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Lead's Update Date",
    }, {
      field: 'firstName',
      type: FieldDefinition.Type.STRING,
      description: "Lead's First Name",
    }, {
      field: 'lastName',
      type: FieldDefinition.Type.STRING,
      description: "Lead's Last Name",
    }],
    dynamicFields: true,
  }, {
    id: 'campaign',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Campaign's Marketo ID",
    }, {
      field: 'name',
      type: FieldDefinition.Type.STRING,
      description: "Campaign's Name",
    }, {
      field: 'description',
      type: FieldDefinition.Type.STRING,
      description: "Campaign's Description",
    }, {
      field: 'type',
      type: FieldDefinition.Type.STRING,
      description: "Campaign's Type",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Campaign's Update Date",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Campaign's Create Date",
    }],
    dynamicFields: true,
  }, {
    id: 'passedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'Email of Marketo Lead (if provided)',
    }, {
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }],
  }, {
    id: 'failedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'Email of Marketo Lead (if provided)',
    }, {
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'message',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of fail',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const reference: string = stepData.email;
    const campaignIdOrName = stepData.campaign;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const isCampaignNameProvided = isNaN(campaignIdOrName);
    let campaignObj: Record<string, any>;
    let campaignRecord;
    const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
    const allCampaigns = await this.client.getCampaigns();

    if (!allCampaigns.length) {
      return this.error('Failed to get campaigns from Marketo');
    }

    campaignObj = allCampaigns.find(cam => cam.id == campaignIdOrName);

    if (isCampaignNameProvided) {
      const matchingCampaigns = allCampaigns.filter(c => c.name ? c.name.toLowerCase() == campaignIdOrName.toLowerCase() : false);

      if (matchingCampaigns.length != 1) {
        return this.error("Can't add lead(s) to %s: found %d matching campaigns", [campaignIdOrName, matchingCampaigns.length]);
      }

      campaignObj = matchingCampaigns[0];
    }

    // Adding multiple leads
    if (stepData.multiple_email && Array.isArray(stepData.multiple_email) && stepData.multiple_email.length > 0) {
      console.log('found multiple_email, using bulk action')

      stepData.multiple_email = Array.from(new Set(stepData.multiple_email)); // remove any duplicates

      try {
        if (stepData.multiple_email.length > 3000) {
          return this.error('Cannot add %d leads, 3000 is the maximum allowed', [stepData.multiple_email.length]);
        }

        let idsArray = [];
        const idEmailMap = {};

        // If the user provided emails then convert them to IDs
        if (emailRegex.test(stepData.multiple_email[0])) {
          const bulkFindLeadResponse = await this.client.bulkFindLeadsByEmail(stepData.multiple_email, null, partitionId);
          await bulkFindLeadResponse.forEach(async (batch) => {
            if (!batch.success) {
              return this.error('There was an error finding some lead IDs in partition %d: %s', [partitionId, batch.message]);
            }

            await batch.result.forEach((lead) => {
              idsArray.push(lead.id);
              idEmailMap[lead.id] = lead.email;
            });

          });

          if (idsArray.length !== stepData.multiple_email.length) {
            return this.error('Could not find all leads provided in partition %d', [partitionId]);
          }

        } else {
          idsArray = JSON.parse(JSON.stringify(stepData.multiple_email));
        }

        const bulkResponse = await this.client.bulkAddLeadToSmartCampaign(campaignObj.id.toString(), idsArray);
        const successArray = []; // contains objects with id and email (if provided)
        const failArray = []; // contains objects with id, email (if provided), and error message

        // create successArray and failArray from response data
        if (Object.keys(idEmailMap).length) {
          for (const leadId of bulkResponse.passedLeads) { // intentionally using for...of loop since passedLeads is an array
            successArray.push({ id: leadId, email: idEmailMap[leadId] });
          }
          for (const leadId in bulkResponse.failedLeads) { // intentionally using for...in loop since failedLeads is an object
            failArray.push({ id: leadId, email: idEmailMap[leadId], message: bulkResponse.failedLeads[leadId] });
          }
        } else {
          for (const leadId of bulkResponse.passedLeads) {
            successArray.push({ id: leadId });
          }
          for (const leadId in bulkResponse.failedLeads) {
            failArray.push({ id: leadId, message: bulkResponse.failedLeads[leadId] });
          }
        }

        const campaignRecord = this.keyValue('campaign', 'Smart Campaign', campaignObj);
        const passedLeadRecord = this.createTable('passedLeads', 'Leads Added', successArray);
        const failedLeadRecord = this.createTable('failedLeads', 'Leads Not Added', failArray);

        if (successArray.length === stepData.multiple_email.length && !failArray.length) {
          // Every lead passed
          return this.pass('Successfully added %d leads to smart campaign %s', [successArray.length, campaignIdOrName], [campaignRecord, passedLeadRecord]);
        } else if (successArray.length && failArray.length) {
          // Some passed, some failed
          return this.fail('Successfully added %d out of %d leads to smart campaign %s', [successArray.length, stepData.multiple_email.length, campaignIdOrName], [campaignRecord, passedLeadRecord, failedLeadRecord]);
        } else if (failArray.length) {
          // Every lead failed
          return this.fail('Failed to add %d leads to smart campaign %s', [stepData.multiple_email.length, campaignIdOrName], [campaignRecord, failedLeadRecord]);
        } else {
          // Something went wrong
          return this.error('Error adding leads to smart campaign. Please contact Stack Moxie for help resolving this issue.');
        }

      } catch (e) {
        if (e.message.includes("Trigger campaign needs to have a 'Campaign Requested' trigger")) {
          return this.error("Cannot add lead to smart campaign %s. In order to test this campaign, you must add a 'Campaign is Requested' trigger with 'Source' set to 'Web Service API'", [campaignIdOrName]);
        }
        return this.error(e.toString());
      }
    } else {
    // Only adding one lead
      try {
        let lookupField = 'id';
        if (emailRegex.test(reference)) {
          lookupField = 'email';
        }

        const findLeadResponse: any = await this.client.findLeadByField(lookupField, reference, null, partitionId);

        if (!findLeadResponse.result[0]) {
          return this.fail(
            'Couldn\'t find a lead associated with %s%s', [
              findLeadResponse,
              partitionId ? ` in partition ${partitionId}` : '',
            ],
          );
        }

        const leadToBeAdded = findLeadResponse.result[0];
        const leadRecord = this.keyValue('lead', 'Lead To Be Added', leadToBeAdded);
        campaignRecord = this.keyValue('campaign', 'Smart Campaign', campaignObj);

        const result = await this.client.addLeadToSmartCampaign(campaignObj.id.toString(), leadToBeAdded);
        if (result.success) {
          return this.pass('Successfully added lead %s to smart campaign %s', [reference, campaignIdOrName], [campaignRecord, leadRecord]);
        } else {
          return this.fail('Unable to add lead %s to smart campaign %s: %s', [reference, campaignIdOrName, result.message], [campaignRecord, leadRecord]);
        }
      } catch (e) {
        if (e.message.includes("Trigger campaign needs to have a 'Campaign Requested' trigger")) {
          return this.error("Cannot add lead to smart campaign %s. In order to test this campaign, you must add a 'Campaign is Requested' trigger with 'Source' set to 'Web Service API'", [campaignIdOrName]);
        }
        return this.error(e.toString());
      }
    }
  }

  createTable(id: string, name: string, leads: any[]): StepRecord {
    const headers = {};
    const headerKeys = Object.keys(leads[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table(id, name, headers, leads);
  }

}

export { AddLeadToSmartCampaignStep as Step };
