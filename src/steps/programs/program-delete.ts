/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class DeleteProgramStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Delete a Marketo program';
  protected stepExpression: string = 'delete the (?<name>.+) marketo program';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['delete'];
  protected targetObject: string = 'Program';
  protected expectedFields: Field[] = [{
    field: 'name',
    type: FieldDefinition.Type.STRING,
    description: "Program's name",
  }];
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

    try {
      // @todo Consider refactoring this logic into the ClientWrapper.
      const data: any = await this.client.findProgramsByName(name);

      if (data.success && data.result && data.result[0] && data.result[0].id) {
        const deleteRes: any = await this.client.deleteProgramById(data.result[0].id);

        if (
          deleteRes.success &&
          deleteRes.result &&
          deleteRes.result[0] &&
          deleteRes.result[0].id
        ) {
          return this.pass(
            'Successfully deleted program %s',
            [name],
            [this.keyValue('program', 'Deleted Program', { id: data.result[0].id })],
          );
        } else {
          return this.error('Unable to delete program %s: %s', [name, data]);
        }
      } else {
        return this.error('Unable to delete program %s: %s', [
          name,
          'a program with that name does not exist',
        ]);
      }
    } catch (e) {
      console.log(e);
      return this.error('There was an error deleting %s from Marketo: %s', [
        name,
        e.toString(),
      ]);
    }
  }

}

export { DeleteProgramStep as Step };
