/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class AddLeadToSmartCampaignStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Add Marketo Lead to Smart Campaign';
  protected stepExpression: string = 'add the (?<email>.+) marketo lead to smart campaign (?<campaign>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Lead's email address",
  },
  {
    field: 'campaign',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Smart campaign name or numeric id',
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
      description: "Campaign's Marketo Name",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Campaign's Marketo Create Date",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Campaign's Marketo Update Date",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const email = stepData.email;
    const campaign = stepData.campaign;
    let campaigns = [{ id:campaign, isRequestable:true }];

    try {
      if (isNaN(campaign)) {
        const allCampaigns = await this.client.getCampaigns();
        campaigns = allCampaigns.result.filter(c => c.name.toLowerCase() == campaign.toLowerCase());
      }

      if (campaigns.length != 1) {
        return this.error("Can't add %s to %s: found %d matching campaigns", [email, campaign, campaigns.length]);
      }

      const campaignRecord = this.keyValue('campaign', 'Smart Campaign', campaigns[0]);

      const leadResponse: any = await this.client.findLeadByEmail(email, {
        fields: this.expectedRecords[0].fields.map(field => field.field).join(','),
      });

      if (!leadResponse.result[0]) {
        return this.error('Could not find lead %s', [email], [campaignRecord]);
      }

      const enrollmentResponse = await this.client.addLeadToSmartCampaign(campaigns[0].id.toString(), leadResponse.result[0]);
      if (enrollmentResponse.success) {
        const leadRecord = this.keyValue('lead', 'Lead Added', leadResponse.result[0]);
        return this.pass('Successfully added lead %s to smart campaign %s', [email, campaign], [campaignRecord, leadRecord]);
      } else {
        const leadRecord = this.keyValue('lead', 'Lead To Be Added', leadResponse.result[0]);
        return this.fail('Unable to add lead %s to smart campaign %s: %s', [email, campaign, enrollmentResponse.message], [campaignRecord, leadRecord]);
      }
    } catch (e) {
      if (e.message.includes("Trigger campaign needs to have a 'Campaign Requested' trigger")) {
        return this.error("Cannot add lead to smart campaign %s. In order to test this campaign, you must add a 'Campaign is Requested' trigger with 'Source' set to 'Web Service API'", [campaign]);
      }
      return this.error('%s', [e.toString()]);
    }
  }

}

export { AddLeadToSmartCampaignStep as Step };
