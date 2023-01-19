import * as Marketo from 'node-marketo-rest';

export class EmailAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async sendSampleEmail(emailId, email) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.post(`/asset/v1/email/${emailId}/sendSample.json?emailAddress=${email}`);
  }

  public async getEmailByName(name) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get(`/asset/v1/email/byName.json?name=${name}`);
  }

  public async getEmails() {
    const result = [];
    await Promise.all([0, 1, 2, 3, 4].map((i) => {
      return new Promise(async (resolve) => {
        try {
          if (this.delayInSeconds > 0) {
            await this.delay(this.delayInSeconds)
          }
          const response = await this.client._connection.get(`/asset/v1/emails.json?maxReturn=200&offset=${i * 200}`);
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
