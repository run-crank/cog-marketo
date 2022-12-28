import * as Marketo from 'node-marketo-rest';
import * as mailgun from 'mailgun-js';
export class SmartCampaignAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async addLeadToSmartCampaign(campaignId: string, lead: Record<string, any>) {
    return await this.client.campaign.request(campaignId, [lead]);
  }

  public async bulkAddLeadToSmartCampaign(campaignId: string, leadArray: Number[]) {
    // NOTE: This mixin is overly complex and fragile, but the structure of the API response has limited information, so for now it's the best we can do
    const leads = leadArray.map((id) => { return { id }; }); // reformatting to match the format expected

    // Maximum of 100 leads allowed per call according to docs, maximum of 3000 leads total (set in the step)
    const batchSize = 2;
    const batches = [];
    for (let i = 0; i < leads.length; i += batchSize) {
      batches.push(leads.slice(i, i + batchSize));
    }

    const failedLeads = {}; // key is leadId and value is failure message
    const passedLeads = []; // array of leadIds

    // Make the API call for each batch
    await Promise.all(batches.map(batch => new Promise(async (resolve) => {
      try {
        // any issue (even with one record) will throw an error, so if we get a value back we know everything succeeded
        const result = await this.client.campaign.request(campaignId, batch);
        if (result.success) {
          passedLeads.push(...batch.map(leadObj => leadObj.id.toString()));
        } else {
          // the entire request failed, so all leads in it must have failed
          for (const lead of batch) {
            // set error message for each failed lead
            failedLeads[lead.id] = result.errors[0].toString();
          }
        }
        // passedLeads.push(result); not sure how to map passed leads over, if we should use the og batch, or the result, need to see result format
        resolve(null);
      } catch (e) {
        if (e.code === 200) {
          // getting a 200 means the request itself went through, but some individual records failed

          const failedInBatch = []; // array of leadIds that failed in this batch, used later to determine which leads passed

          // loop through all the errors in the current batch and group the leads accordingly
          await e.errors.forEach(async (errorObj) => {
            // errorObj is structured like this: { code: '1004', message: 'Lead [2307666, 2307667] not found' }
            // we are assuming that all errors will have an array with lead IDs in the message
            const leadIdArrayRegex = new RegExp(/\[[\d, ]+\]/); // regex for pulling array out of error message

            // Make sure the error message contains an array with at least one leadId
            const errContainsLeadIdsArray = leadIdArrayRegex.test(errorObj.message);
            if (!errContainsLeadIdsArray) {
              // if it doesn't, we don't know which leads failed, so skip this errorObj for now and send an email so we can investigate further
              if (this.client.mailgunCredentials.apiKey && this.client.mailgunCredentials.domain && this.client.mailgunCredentials.alertEmail) {
                const mg = mailgun({ apiKey: this.client.mailgunCredentials.apiKey, domain: this.client.mailgunCredentials.domain });
                const emailData = {
                  from: `Marketo Cog <noreply@${this.client.mailgunCredentials.domain}>`,
                  to: this.client.mailgunCredentials.alertEmail,
                  subject: 'UNHANDLED ERROR: New error found in Marketo bulkAddLeadToSmartCampaign mixin',
                  text: `The following is the stringified error object returned by marketo, in which the message property does not have the Lead ID array that we depend on: ${JSON.stringify(errorObj)}`,
                };
                mg.messages().send(emailData, (error, body) => {
                  console.log('email sent: ', body);
                });
              }

              return;
            }

            const failedInCurrError = (errorObj.message.match(leadIdArrayRegex)[0]).slice(1, -1).replace(/ /g, '').split(','); // converting the string version to a real array of Ids
            failedInBatch.push(...failedInCurrError);

            // loop through the current array of failed lead Ids
            await failedInCurrError.forEach((leadId) => {
              // add unique message for each one to the failedLeads object
              failedLeads[leadId] = errorObj.message.replace(leadIdArrayRegex, leadId);
            });
          });

          // any leads in this batch that haven't been added to the failedInBatch array yet must have passed
          const passedInBatch = batch.map(leadObj => leadObj.id.toString()).filter(id => !failedInBatch.includes(id));
          passedLeads.push(...passedInBatch);

          resolve(null);
        } else {
          // the entire request failed, so all leads in it must have failed
          for (const lead of batch) {
            // set error message for each
            failedLeads[lead.id] = e.toString();
          }
          resolve(null);
        }
      }
    })));

    return { passedLeads, failedLeads };
  }

  public async getCampaigns() {
    const result = [];
    await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((i) => {
      return new Promise(async (resolve) => {
        try {
          this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
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
