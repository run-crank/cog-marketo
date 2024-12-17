import * as Marketo from 'node-marketo-rest';

export class StaticListAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async findStaticListsByName(name: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get(`/asset/v1/staticList/byName.json?name=${encodeURIComponent(name)}`);
  }

  public async findStaticLists() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get('/asset/v1/staticLists.json');
  }

  public async findStaticListsById(id: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get(`/asset/v1/staticList/${id}.json`);
  }

  public async findStaticListsMembershipByListId(id: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.get(`/v1/lists/${id}/leads.json?batchSize=300`);
  }

  public async addLeadToStaticList(listId: string, leadIds: string[]) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.post(`/v1/lists/${listId}/leads.json?${leadIds.map(id => `id=${id}`).join('&')}`);
  }

  public async removeLeadToStaticList(listId: string, leadIds: string[]) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds);
    }
    return await this.client._connection.del(`/v1/lists/${listId}/leads.json?${leadIds.map(id => `id=${id}`).join('&')}`);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
