/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../../proto/cog_pb';

export class CreateProgramStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create a Marketo program';
  protected stepExpression: string = 'create a marketo program';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['create'];
  protected targetObject: string = 'Program';
  protected expectedFields: Field[] = [
    {
      field: 'workspace',
      type: FieldDefinition.Type.STRING,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'Name of the workspace the program will be created',
    },
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
          [
            this.createRecord(data.result[0]),
            this.createPassingRecord(data.result[0]),
            this.createOrderedRecord(data.result[0], stepData['__stepOrder']),
          ],
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

  public createRecord(data): StepRecord {
    return this.keyValue('program', 'Created Program', data);
  }

  public createPassingRecord(data): StepRecord {
    const stepRecordFields = [
      'name:',
      'description',
      'workspace',
      'folder',
      'channel',
      'type',
    ];
    const filteredData = {};
    Object.keys(data).forEach((key) => {
      if (stepRecordFields.includes(key)) {
        if (key === 'folder') {
          filteredData[key] = data[key].value;
        } else {
          filteredData[key] = data[key];
        }
      }
    });
    return this.keyValue('exposeOnPass:program', 'Created Program', filteredData);
  }

  public createOrderedRecord(data, stepOrder = 1): StepRecord {
    return this.keyValue(`program.${stepOrder}`, `Created Program from Step ${stepOrder}`, data);
  }
}

export { CreateProgramStep as Step };
