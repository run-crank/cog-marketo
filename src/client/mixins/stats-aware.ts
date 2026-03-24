import * as Marketo from 'node-marketo-rest';

export class StatsAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async getDailyApiUsage() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get('/v1/stats/usage.json');
  }

  public async getWeeklyApiUsage() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get('/v1/stats/usage/last7days.json');
  }

  public async getBulkExportLeadJobs() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    // Get the base endpoint URL (without /rest) and construct full bulk API URL
    const baseEndpoint = this.client._connection._options.endpoint.replace('/rest', '');
    const fullUrl = `${baseEndpoint}/bulk/v1/leads/export.json`;
    const options = {
      data: { _method: 'GET' },
    };
    return await this.client._connection.get(fullUrl, options);
  }

  public async getBulkExportActivityJobs() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    const baseEndpoint = this.client._connection._options.endpoint.replace('/rest', '');
    const fullUrl = `${baseEndpoint}/bulk/v1/activities/export.json`;
    const options = {
      data: { _method: 'GET' },
    };
    return await this.client._connection.get(fullUrl, options);
  }

  public async getBulkExportProgramMemberJobs() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    const baseEndpoint = this.client._connection._options.endpoint.replace('/rest', '');
    const fullUrl = `${baseEndpoint}/bulk/v1/program/members/export.json`;
    const options = {
      data: { _method: 'GET' },
    };
    return await this.client._connection.get(fullUrl, options);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
