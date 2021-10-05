import * as Marketo from 'node-marketo-rest';
export class SmartCampaignAwareMixin {
  client: Marketo;
  delayInSeconds = 3;

  public async addLeadToSmartCampaign(campaignId: string, lead: Record<string, any>) {
    return this.client.campaign.request(campaignId, [lead]);
  }

  public async getCampaigns() {
    const result = [];
    await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((i) => {
      return new Promise(async (resolve) => {
        try {
          await this.delay(this.delayInSeconds);
          const response = await this.client.campaign.getSmartCampaigns({ maxReturn: 200, offset: i * 200 });
          if (response.hasOwnProperty('result')) {
            response.result.forEach((campaign) => {
              result.push(campaign);
            });
          }
          resolve([]);
        } catch (e) {
          resolve(e);
        }
      });
    }));

    result.sort((a, b) => {
      const aDisplay = a.name.toLowerCase();
      const bDisplay = b.name.toLowerCase();
      if (aDisplay < bDisplay) {
        return -1;
      }
      if (aDisplay > bDisplay) {
        return 1;
      }
      return 0;
    });

    return result;
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
