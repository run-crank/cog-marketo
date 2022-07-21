import * as Marketo from 'node-marketo-rest';

export class StaticListAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async findStaticListsByName(name: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/asset/v1/staticList/byName.json?name=${name}`);
  }

  public async findStaticLists() {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get('/asset/v1/staticLists.json');
  }

  public async findStaticListsById(id: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/asset/v1/staticList/${id}.json`);
  }

  public async findStaticListsMembershipByListId(id: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/v1/lists/${id}/leads.json?batchSize=300`);
  }

  public async addLeadToStaticList(listId: string, leadIds: string[]) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.post(`/v1/lists/${listId}/leads.json?${leadIds.map(id => `id=${id}`).join('&')}`);
  }

  public async removeLeadToStaticList(listId: string, leadIds: string[]) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.del(`/v1/lists/${listId}/leads.json?${leadIds.map(id => `id=${id}`).join('&')}`);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
