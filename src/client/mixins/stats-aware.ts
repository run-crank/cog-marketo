import * as Marketo from 'node-marketo-rest';

export class StatsAwareMixin {
  client: Marketo;
  delayInSeconds = 3;

  public async getDailyApiUsage() {
    await this.delay(this.delayInSeconds);
    return await this.client._connection.get('/v1/stats/usage.json');
  }

  public async getWeeklyApiUsage() {
    await this.delay(this.delayInSeconds);
    return await this.client._connection.get('/v1/stats/usage/last7days.json');
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
