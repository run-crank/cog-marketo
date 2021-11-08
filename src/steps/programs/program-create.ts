/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class CreateProgramStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create a Marketo Program';
  protected stepExpression: string = 'create a marketo program';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [
    {
      field: 'name',
      type: FieldDefinition.Type.STRING,
      description: 'Name',
    },
    {
      field: 'folder',
      type: FieldDefinition.Type.STRING,
      description: 'Folder',
    },
    {
      field: 'type',
      type: FieldDefinition.Type.STRING,
      description: 'Type',
    },
    {
      field: 'channel',
      type: FieldDefinition.Type.STRING,
      description: 'Channel',
    },
    {
      field: 'description',
      type: FieldDefinition.Type.STRING,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'Description',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'program',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Program's Marketo ID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const folder = stepData.folder;
    const type = stepData.type;
    const channel = stepData.channel;
    const description = stepData.description;

    try {
      const filteredFolder: any = await this.client.getFoldersById(folder);
      if (filteredFolder.result && filteredFolder.result[0] && filteredFolder.result[0].reasons && filteredFolder.result[0].reasons[0]) {
        return this.fail('Unable to create program: %s', [
          filteredFolder.result[0].reasons[0].message,
        ]);
      }

      const program = `name=${name}&folder=${JSON.stringify({
        id: filteredFolder.result[0].id,
        type: 'Folder',
      })}&description=${description}&type=${type}&channel=${channel}`;

      const data = await this.client.createProgram(program);
      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        return this.pass(
          'Successfully created program %s',
          [name],
          [this.keyValue('program', 'Created Program', { id: data.result[0].id })],
        );
      } else {
        if (data.result && data.result[0] && data.result[0].reasons && data.result[0].reasons[0]) {
          return this.fail('Unable to create program: %s', [
            data.result[0].reasons[0].message,
          ]);
        } else {
          return this.fail('Unable to create program: %s', [
            `status was ${data.result[0].status}`,
          ]);
        }
      }
    } catch (e) {
      console.log(e);
      return this.error('There was an error creating programs in Marketo: %s', [
        e.toString(),
      ]);
    }
  }

}

export { CreateProgramStep as Step };
