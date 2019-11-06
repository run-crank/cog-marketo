import * as Marketo from 'node-marketo-rest';
export class SmartCampaignAwareMixin {
  client: Marketo;

  public async addLeadToSmartCampaign(campaignId: string, leadId: Record<string, any>) {
    return this.client.campaign.request(campaignId, [leadId]);
  }

  public async getCampaigns() {
    return this.client.campaign.getCampaigns();
  }
}
