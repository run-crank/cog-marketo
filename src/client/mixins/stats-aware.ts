import * as Marketo from 'node-marketo-rest';

export class StatsAwareMixin {
  client: Marketo;

  public async getDailyApiUsage() {
    return await this.client._connection.get('/v1/stats/usage.json');
  }
}
