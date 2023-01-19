import * as Marketo from 'node-marketo-rest';

export class FolderAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async getFoldersById(id: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get(`/asset/v1/folder/${id}.json?type=Folder`);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
