import * as Marketo from 'node-marketo-rest';

export class ActivityAwareMixin {
  client: Marketo;

  public async getActivityTypes() {
    return await this.client.activities.getActivityTypes();
  }

  public async getActivityPagingToken(sinceDate) {
    return await this.client._connection.get(`/v1/activities/pagingtoken.json?sinceDatetime=${sinceDate}`);
  }

  public async getActivities(nextPageToken, leadId, activityId) {
    return await this.client._connection.get('/v1/activities.json', {
      query: {
        nextPageToken,
        leadIds: leadId,
        activityTypeIds: activityId,
      },
    });
  }
}
