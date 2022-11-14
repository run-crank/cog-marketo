import * as Marketo from 'node-marketo-rest';

export class ActivityAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async getActivityTypes() {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client.activities.getActivityTypes();
  }

  public async getActivityPagingToken(sinceDate) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/v1/activities/pagingtoken.json?sinceDatetime=${sinceDate}`);
  }

  public async getActivitiesByLeadId(nextPageToken, leadIdInput, activityId) {
    // NOTE: leadId can be either a single ID or an array of IDs
    const leadId = JSON.parse(JSON.stringify(leadIdInput)); // Make a copy since it can be mutated
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;

    const output = {
      success: true,
      result: [],
    };

    try {
      // Handle bulk check of more than 30 leads (endpoint can accept a max of 30 IDs, so we need to batch them)
      if (Array.isArray(leadId) && leadId.length > 30) {
        const batches = [];

        while (leadId.length > 0) {
          batches.push(leadId.splice(0, 30));
        }

        for (let i = 0; i < batches.length; i += 1) {
          let curr = await this.client._connection.get('/v1/activities.json', {
            query: {
              nextPageToken,
              leadIds: batches[i].join(','),
              activityTypeIds: activityId,
            },
          });
          output.result.push(...curr.result);

          let count = 0;
          // Pull activities up to 10 times total (3000 activities) per batch
          while (curr.moreResult && count < 10) {
            curr = await this.client._connection.get('/v1/activities.json', {
              query: {
                nextPageToken: curr.nextPageToken,
                leadIds: Array.isArray(leadId) ? leadId.join(',') : leadId,
                activityTypeIds: activityId,
              },
            });

            output.result.push(...curr.result);
            count += 1;
          }
        }
      } else {
        // Handle single lead check or bulk check of up to 30 leads
        let res = await this.client._connection.get('/v1/activities.json', {
          query: {
            nextPageToken,
            leadIds: Array.isArray(leadId) ? leadId.join(',') : leadId,
            activityTypeIds: activityId,
          },
        });
        output.result.push(...res.result);

        let count = 0;
        // Pull activities up to 10 times total (3000 activities)
        while (res.moreResult && count < 10) {
          res = await this.client._connection.get('/v1/activities.json', {
            query: {
              nextPageToken: res.nextPageToken,
              leadIds: Array.isArray(leadId) ? leadId.join(',') : leadId,
              activityTypeIds: activityId,
            },
          });

          output.result.push(...res.result);
          count += 1;
        }
      }
    } catch (e) {
      output.success = false;
    } finally {
      return output;
    }

  }

  public async getActivities(nextPageToken, activityId) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get('/v1/activities.json', {
      query: {
        nextPageToken,
        activityTypeIds: activityId,
      },
    });
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
