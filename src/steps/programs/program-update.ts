/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class UpdateProgramStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Update a Marketo Program';
  protected stepExpression: string = 'update a marketo program';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [
    {
      field: 'name',
      type: FieldDefinition.Type.STRING,
      description: 'Name',
    },
    {
      field: 'description',
      type: FieldDefinition.Type.STRING,
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
    const description = stepData.description;

    try {
      let data;
      const program = `name=${name}&description=${description}`;

      const filteredProgram: any = await this.client.findProgramsByName(name);
      if (filteredProgram.success && filteredProgram.result && filteredProgram.result[0] && filteredProgram.result[0].id) {
        data = await this.client.updateProgram(filteredProgram.result[0].id, program);
      }

      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        return this.pass(
          'Successfully updated program %s',
          [name],
          [this.keyValue('program', 'Updated Program', { id: data.result[0].id })],
        );
      } else {
        if (data.result && data.result[0] && data.result[0].reasons && data.result[0].reasons[0]) {
          return this.fail('Unable to update program: %s', [
            data.result[0].reasons[0].message,
          ]);
        } else {
          return this.fail('Unable to update program: %s', [
            `status was ${data.result[0].status}`,
          ]);
        }
      }
    } catch (e) {
      return this.error('There was an error creating programs in Marketo: %s', [
        e.toString(),
      ]);
    }
  }

}

export { UpdateProgramStep as Step };
