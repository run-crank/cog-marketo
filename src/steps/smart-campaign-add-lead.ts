/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class AddLeadToSmartCampaignStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add Marketo Lead to Smart Campaign';
  protected stepExpression: string = 'add the (?<email>.+) marketo lead to smart campaign (?<campaign>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.STRING,
    description: "Lead's email address or id",
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
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const reference: string = stepData.email;
    const campaignIdOrName = stepData.campaign;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;
    const isCampaignNameProvided = isNaN(campaignIdOrName);
    let campaignObj: Record<string, any>;
    let campaignRecord;

    try {
      const allCampaigns = await this.client.getCampaigns();
      campaignObj = allCampaigns.find(cam => cam.id == campaignIdOrName);

      if (isCampaignNameProvided) {
        const matchingCampaigns = allCampaigns.filter(c => c.name ? c.name.toLowerCase() == campaignIdOrName.toLowerCase() : false);

        if (matchingCampaigns.length != 1) {
          return this.error("Can't add %s to %s: found %d matching campaigns", [reference, campaignIdOrName, matchingCampaigns.length]);
        }

        campaignObj = matchingCampaigns[0];
      }

      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
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
      return this.error('%s', [e.toString()]);
    }
  }

}

export { AddLeadToSmartCampaignStep as Step };
