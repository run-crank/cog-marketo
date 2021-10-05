import * as Marketo from 'node-marketo-rest';

export class ActivityAwareMixin {
  client: Marketo;
  delayInSeconds = 3;

  public async getActivityTypes() {
    await this.delay(this.delayInSeconds);
    return await this.client.activities.getActivityTypes();
  }

  public async getActivityPagingToken(sinceDate) {
    await this.delay(this.delayInSeconds);
    return await this.client._connection.get(`/v1/activities/pagingtoken.json?sinceDatetime=${sinceDate}`);
  }

  public async getActivities(nextPageToken, leadId, activityId) {
    await this.delay(this.delayInSeconds);
    return await this.client._connection.get('/v1/activities.json', {
      query: {
        nextPageToken,
        leadIds: leadId,
        activityTypeIds: activityId,
      },
    });
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
