import * as Marketo from 'node-marketo-rest';

export class ProgramAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async createProgram(program) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.post(`/asset/v1/programs.json?${program}`);
  }

  public async updateProgram(id: string, program: Record<string, any>) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.post(`/asset/v1/program/${id}.json?${program}`);
  }

  public async getPrograms() {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get('/asset/v1/programs.json');
  }

  public async findProgramsByName(name: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/asset/v1/program/byName.json?name=${name}&includeTags=true`);
  }

  public async findProgramsById(id: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.get(`/asset/v1/program/${id}.json`);
  }

  public async deleteProgramById(id: string) {
    this.delayInSeconds > 0 ? await this.delay(this.delayInSeconds) : null;
    return await this.client._connection.post(`/asset/v1/program/${id}/delete.json`);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
