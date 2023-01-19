import * as Marketo from 'node-marketo-rest';

export class ProgramAwareMixin {
  client: Marketo;
  delayInSeconds;

  public async createProgram(program) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.post(`/asset/v1/programs.json?${program}`);
  }

  public async updateProgram(id: string, programUpdateString: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.post(`/asset/v1/program/${id}.json?${programUpdateString}`);
  }

  public async getPrograms() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get('/asset/v1/programs.json');
  }

  public async getProgramMembersByFilterValue(programId: string, field: string, fieldValue: string, fields: string[] = []) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get(`/v1/programs/${programId}/members.json?filterType=${field}&filterValues=${fieldValue}&fields=${fields.join(',')}`);
  }

  public async getProgramMembersFields() {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get('/v1/programs/members/describe.json');
  }

  public async findProgramsByName(name: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get(`/asset/v1/program/byName.json?name=${name}&includeCosts=true`);
  }

  public async findProgramsById(id: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.get(`/asset/v1/program/${id}.json`);
  }

  public async deleteProgramById(id: string) {
    if (this.delayInSeconds > 0) {
      await this.delay(this.delayInSeconds)
    }
    return await this.client._connection.post(`/asset/v1/program/${id}/delete.json`);
  }

  public async delay(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
